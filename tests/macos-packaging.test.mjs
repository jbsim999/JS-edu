import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, chmod, symlink, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { execFileSync, spawn } from 'node:child_process';
import { createServer, createConnection } from 'node:net';
import { createHash } from 'node:crypto';
import { assertDistinctPaths, readZipEntries } from '../scripts/desktop-integrity.mjs';
import { validateUnixLinks, unixInventory, copyUnixInventory, compareUnixInventories, readTarEntries, extractUnixTarGz } from '../scripts/macos-integrity.mjs';
import { desktopRuntimeTarget, validateDesktopRuntime } from '../desktop/runtime-target.mjs';
import { launchLearningService } from '../desktop/service-client.mjs';
import { inspectPinnedElectronMachO, assertPinnedBundleResult } from '../scripts/macos-signatures.mjs';

function linkerImage() {
  const codeLimit = 4113, directoryLength = 160, blobLength = 20 + directoryLength;
  const bytes = Buffer.alloc(codeLimit + blobLength);
  bytes.writeUInt32LE(0xfeedfacf, 0); bytes.writeUInt32LE(0x0100000c, 4);
  bytes.writeUInt32LE(1, 16); bytes.writeUInt32LE(16, 20);
  bytes.writeUInt32LE(0x1d, 32); bytes.writeUInt32LE(16, 36);
  bytes.writeUInt32LE(codeLimit, 40); bytes.writeUInt32LE(blobLength, 44);
  const blob = bytes.subarray(codeLimit), directory = blob.subarray(20);
  blob.writeUInt32BE(0xfade0cc0); blob.writeUInt32BE(blobLength, 4); blob.writeUInt32BE(1, 8); blob.writeUInt32BE(20, 16);
  directory.writeUInt32BE(0xfade0c02); directory.writeUInt32BE(directoryLength, 4);
  directory.writeUInt32BE(0x20400, 8); directory.writeUInt32BE(0x20002, 12);
  directory.writeUInt32BE(96, 16); directory.writeUInt32BE(88, 20); directory.writeUInt32BE(2, 28); directory.writeUInt32BE(codeLimit, 32);
  directory[36] = 32; directory[37] = 2; directory[39] = 12; directory.write('fixture\0', 88);
  for (let index = 0; index < 2; index++) createHash('sha256').update(bytes.subarray(index * 4096, Math.min((index + 1) * 4096, codeLimit))).digest().copy(directory, 96 + index * 32);
  return bytes;
}

test('pinned linker-only image verifies every complete and final partial code page and rejects byte tampering', () => {
  const original = linkerImage(), result = inspectPinnedElectronMachO(original, 'arm64');
  assert.equal(result.codePagesVerified, true); assert.equal(result.codeSlots, 2); assert.equal(result.specialSlots, 0);
  for (const offset of [64, 4112, 4113 + 20 + 96]) {
    const modified = Buffer.from(original); modified[offset] ^= 1;
    assert.throws(() => inspectPinnedElectronMachO(modified, 'arm64'), /hash mismatch/);
  }
  assert.throws(() => inspectPinnedElectronMachO(original.subarray(0, original.length - 1), 'arm64'), /signature/);
});

test('pinned Mach-O classifier refuses resource signatures, different flags, CPUs and unknown native formats', () => {
  for (const [offset, value] of [[4113 + 20 + 12, 2], [4113 + 20 + 24, 1], [4113 + 8, 2], [4113 + 20 + 16, 0xffffffff]]) {
    const modified = linkerImage(); modified.writeUInt32BE(value, offset);
    assert.throws(() => inspectPinnedElectronMachO(modified, 'arm64'));
  }
  assert.throws(() => inspectPinnedElectronMachO(linkerImage(), 'x64'), /CPU mismatch/);
  const unsigned = Buffer.alloc(32); unsigned.writeUInt32LE(0xfeedfacf); unsigned.writeUInt32LE(0x01000007, 4);
  assert.equal(inspectPinnedElectronMachO(unsigned, 'x64').signed, false);
  unsigned.writeUInt32LE(0x0100000c, 4); assert.throws(() => inspectPinnedElectronMachO(unsigned, 'arm64'), /signature/);
  const fat = Buffer.alloc(4); fat.writeUInt32LE(0xbebafeca); assert.throws(() => inspectPinnedElectronMachO(fat, 'arm64'), /format/);
  assert.equal(inspectPinnedElectronMachO(Buffer.from('plain resource'), 'arm64'), undefined);
});

test('original bundle signature failure stays explicit and unrelated native codesign failures never become accepted', () => {
  const filename = '/owned/Electron.app';
  const failed = message => ({ args: [filename], exitCode: 1, signal: null, stdout: '', stderr: `${filename}: ${message}\n` });
  const unsigned = failed('code object is not signed at all');
  assert.equal(assertPinnedBundleResult('x64', unsigned, unsigned), 'UNSIGNED');
  const withCpu = (result, cpu) => ({ ...result, args: ['--all-architectures', filename], stderr: result.stderr + `In architecture: ${cpu}\n` });
  assert.equal(assertPinnedBundleResult('x64', unsigned, withCpu(unsigned, 'x86_64')), 'UNSIGNED');
  assert.throws(() => assertPinnedBundleResult('x64', unsigned, withCpu(unsigned, 'arm64')));
  assert.throws(() => assertPinnedBundleResult('x64', unsigned, { ...withCpu(unsigned, 'x86_64'), args: [filename] }));
  const display = { args: [filename], exitCode: 0, signal: null, stdout: '', stderr: 'Signature=adhoc\nInfo.plist=not bound\nSealed Resources=none\n' };
  const unsealed = failed('code has no resources but signature indicates they must be present');
  assert.equal(assertPinnedBundleResult('arm64', display, unsealed), 'FAIL_UNSEALED_ORIGINAL_BUNDLE');
  assert.equal(assertPinnedBundleResult('arm64', display, withCpu(unsealed, 'arm64')), 'FAIL_UNSEALED_ORIGINAL_BUNDLE');
  assert.throws(() => assertPinnedBundleResult('arm64', display, withCpu(unsealed, 'x86_64')));
  for (const bad of [failed('invalid signature (code or signature have been modified)'), { ...unsealed, exitCode: null, signal: 'SIGTERM' }, { ...unsealed, error: 'ETIMEDOUT' }, { ...unsealed, exitCode: 0 }, { ...unsealed, stderr: unsealed.stderr + 'additional unexpected failure\n' }]) assert.throws(() => assertPinnedBundleResult('arm64', display, bad));
  assert.throws(() => assertPinnedBundleResult('arm64', { ...display, stderr: display.stderr.replace('none', 'version=2 files=100') }, unsealed));
  assert.throws(() => assertPinnedBundleResult('x64', unsigned, unsealed));
});

async function directory(t) {
  const parent = await realpath(tmpdir());
  const base = await mkdtemp(path.join(parent, 'javascript-edu-mac-test-'));
  t.after(async () => {
    const actual = await realpath(base), relative = path.relative(parent, actual);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(actual).startsWith('javascript-edu-mac-test-'));
    await rm(actual, { recursive: true, force: true });
  });
  return base;
}

function tar(entries) {
  const blocks = [];
  for (const item of entries) {
    const body = Buffer.from(item.body || ''), header = Buffer.alloc(512);
    header.write(item.path, 0, 100);
    header.write((item.mode ?? (item.type === '2' ? 0o777 : 0o755)).toString(8).padStart(7, '0') + '\0', 100, 8);
    header.write('0000000\0', 108, 8); header.write('0000000\0', 116, 8);
    header.write(body.length.toString(8).padStart(11, '0') + '\0', 124, 12);
    header.write('00000000000\0', 136, 12); header.fill(32, 148, 156);
    header.write(item.type || '0', 156, 1); header.write(item.target || '', 157, 100);
    header.write('ustar\0', 257, 6); header.write('00', 263, 2);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
    blocks.push(header, body, Buffer.alloc((512 - body.length % 512) % 512));
  }
  return Buffer.concat([...blocks, Buffer.alloc(1024)]);
}

test('desktop runtime target pins host, architecture, Node version and relative home independently', () => {
  for (const [platform, architecture] of [['win32', 'x64'], ['darwin', 'x64'], ['darwin', 'arm64']]) {
    const config = desktopRuntimeTarget(platform, architecture);
    assert.deepEqual(validateDesktopRuntime(config, platform, architecture), config);
    for (const patch of [{ nodeVersion: '22.17.0' }, { architecture: 'universal' }, { platform: 'linux' }, { nodeRelativePath: '/external/node' }]) assert.throws(() => validateDesktopRuntime({ ...config, ...patch }, platform, architecture));
  }
  assert.throws(() => desktopRuntimeTarget('darwin', 'ia32'));
  assert.throws(() => desktopRuntimeTarget('win32', 'arm64'));
  assert.throws(() => validateDesktopRuntime(desktopRuntimeTarget('darwin', 'arm64'), 'darwin', 'x64'));
});

test('Unix framework and npm relative links resolve through recorded intermediate aliases', () => {
  const entries = [
    { path: 'framework/Versions/A/binary', type: 'file' },
    { path: 'framework/Versions/Current', type: 'symlink', target: 'A' },
    { path: 'framework/binary', type: 'symlink', target: 'Versions/Current/binary' },
    { path: 'node/lib/npm/cli.js', type: 'file' },
    { path: 'node/bin/npm', type: 'symlink', target: '../lib/npm/cli.js' },
  ];
  assert.equal(validateUnixLinks(entries), entries);
});

test('Unix links reject escapes, missing targets, cycles, file traversal and link parents before extraction', () => {
  const base = [{ path: 'vendor/lib/file', type: 'file' }];
  for (const target of ['/outside', '../../outside', '../missing', 'lib/file/../file', 'lib/file/child', 'lib\\file', 'C:/outside']) assert.throws(() => validateUnixLinks([...base, { path: 'vendor/link', type: 'symlink', target }]));
  assert.throws(() => validateUnixLinks([{ path: 'a', type: 'symlink', target: 'b' }, { path: 'b', type: 'symlink', target: 'a' }]), /Cyclic/);
  assert.throws(() => validateUnixLinks([{ path: 'a', type: 'symlink', target: 'dir' }, { path: 'a/file', type: 'file' }, { path: 'dir', type: 'directory' }]), /parent directory/);
  assert.throws(() => validateUnixLinks([{ path: 'a', type: 'symlink', target: 'a/child' }]), /Cyclic/);
  assert.throws(() => assertDistinctPaths([{ path: 'caf\u00e9/a', type: 'file' }, { path: 'cafe\u0301/b', type: 'file' }]), /Case-colliding/);
});

test('Unix manifest detects executable bit changes and link retargeting with unchanged file bytes', () => {
  const file = { path: 'bin/node', type: 'file', mode: 0o755, size: 1, sha256: 'x' };
  const link = { path: 'bin/npm', type: 'symlink', mode: 0o755, target: '../lib/npm.js' };
  assert.throws(() => compareUnixInventories([file], [{ ...file, mode: 0o644 }]), /mode\/link/);
  assert.throws(() => compareUnixInventories([link], [{ ...link, target: '../lib/changed.js' }]), /mode\/link/);
  assert.throws(() => compareUnixInventories([link], [{ ...link, type: 'file', size: 1, sha256: 'x' }]), /inventory mismatch/);
});

test('tar parser preserves original Unix modes and link text and rejects malformed/special archives', () => {
  const good = tar([{ path: 'vendor/', type: '5' }, { path: 'vendor/node', body: 'native', mode: 0o755 }, { path: 'vendor/alias', type: '2', target: 'node' }]);
  const entries = readTarEntries(good);
  assert.equal(entries.length, 3); assert.equal(entries[1].mode, 0o755); assert.equal(entries[2].target, 'node');
  for (const invalid of [
    tar([{ path: '../outside', body: 'bad' }]), tar([{ path: 'setuid', mode: 0o4755, body: 'bad' }]),
    tar([{ path: 'device', type: '3' }]), tar([{ path: 'hard-link', type: '1', target: 'other' }]),
    tar([{ path: 'link', type: '2', target: '../escape' }]), tar([{ path: 'same', body: 'a' }, { path: 'same', body: 'b' }]),
    Buffer.concat([good, Buffer.from('trailing unrecorded data')]), good.subarray(0, 1000),
  ]) assert.throws(() => readTarEntries(invalid));
  const corrupt = Buffer.from(good); corrupt[1] ^= 1; assert.throws(() => readTarEntries(corrupt), /checksum/);
});

test('actual Unix inventory/copy retains links and executable permissions without following outside links', { skip: process.platform === 'win32' }, async t => {
  const base = await directory(t), source = path.join(base, 'source');
  await mkdir(path.join(source, 'bin'), { recursive: true });
  await mkdir(path.join(source, 'lib'));
  await writeFile(path.join(source, 'lib', 'cli'), 'original'); await chmod(path.join(source, 'lib', 'cli'), 0o755);
  await symlink('../lib/cli', path.join(source, 'bin', 'cli'));
  const expected = await unixInventory(source);
  const copied = path.join(base, 'copied'); await copyUnixInventory(source, copied, expected);
  compareUnixInventories(expected, await unixInventory(copied));
  await chmod(path.join(copied, 'lib', 'cli'), 0o644);
  assert.throws(() => compareUnixInventories(expected, expected.map(item => item.path === 'lib/cli' ? { ...item, mode: 0o644 } : item)), /mode\/link/);
  await symlink('../../outside', path.join(source, 'bin', 'outside'));
  await assert.rejects(unixInventory(source), /Dangling|escapes/);
});

test('actual tar extraction is fresh-only and preserves an executable plus a relative link', { skip: process.platform === 'win32' }, async t => {
  const base = await directory(t), filename = path.join(base, 'vendor.tar.gz');
  await writeFile(filename, gzipSync(tar([{ path: 'vendor/', type: '5' }, { path: 'vendor/bin/', type: '5' }, { path: 'vendor/bin/node', body: 'native', mode: 0o755 }, { path: 'vendor/bin/alias', type: '2', target: 'node' }])));
  const destination = path.join(base, 'extracted'), entries = await extractUnixTarGz(filename, destination);
  assert.equal(await readFile(path.join(destination, 'vendor/bin/alias'), 'utf8'), 'native');
  assert.equal(entries.find(item => item.path === 'vendor/bin/node').mode, 0o755);
  await assert.rejects(extractUnixTarGz(filename, destination), { code: 'EEXIST' });
});

test('Windows-only ZIP metadata is not silently accepted as a Unix executable distribution', async t => {
  const base = await directory(t), filename = path.join(base, 'metadata.zip');
  const name = Buffer.from('node'), data = Buffer.from('bytes'), local = Buffer.alloc(30), central = Buffer.alloc(46), end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
  central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length + name.length + data.length, 16);
  await writeFile(filename, Buffer.concat([local, name, data, central, name, end]));
  assert.equal((await readZipEntries(filename)).length, 1);
  await assert.rejects(readZipEntries(filename, { unix: true }), /Unsupported ZIP|Unix ZIP/);
});

test('POSIX timeout reproduces ignored SIGTERM then actually SIGKILLs the owned service and confirms exit', { skip: process.platform === 'win32' }, async t => {
  const base = await directory(t), marker = path.join(base, 'sigterm-received.json');
  await mkdir(path.join(base, 'desktop'));
  await writeFile(path.join(base, 'desktop', 'service.mjs'), `import {writeFileSync} from 'node:fs';
process.on('SIGTERM',()=>writeFileSync(${JSON.stringify(marker)},JSON.stringify({pid:process.pid,sigtermIgnored:true})));
process.on('message',()=>{});setInterval(()=>{},1000);
process.send({type:'ready',port:42424,runtime:'24.22.0'});\n`);
  const service = launchLearningService({ executable: process.execPath, projectRoot: base, port: 0, shutdownTimeoutMs: 75 });
  const alive = () => { try { process.kill(service.child.pid, 0); return true; } catch { return false; } };
  try {
    await service.ready;
    service.child.kill('SIGTERM');
    let observed;
    const deadline = Date.now() + 3000;
    while (!observed && Date.now() < deadline) { try { observed = JSON.parse(await readFile(marker, 'utf8')); } catch { await new Promise(resolve => setTimeout(resolve, 25)); } }
    assert.deepEqual(observed, { pid: service.child.pid, sigtermIgnored: true });
    assert.equal(alive(), true, 'Baseline SIGTERM leaves the stalled owned service alive.');
    const result = await service.close();
    assert.equal(result.ok, false, 'Forced termination must not be mislabeled graceful cleanup.');
    assert.match(result.error, /종료 제한 시간/);
    assert.equal((await service.exit).signal, 'SIGKILL');
    assert.equal(alive(), false);
  } finally { if (alive()) { service.child.kill('SIGKILL'); await service.exit; } }
});

test('POSIX service SIGKILL closes IPC and reclaims the real detached supervisor, its same-group child and listening port', { skip: process.platform === 'win32', timeout: 20000 }, async t => {
  const base = await directory(t), marker = path.join(base, 'owned-processes.json');
  const trusted = path.join(base, 'trusted'), dataRoot = path.join(base, 'data');
  await mkdir(trusted); await mkdir(dataRoot); await mkdir(path.join(base, 'desktop'));
  await writeFile(path.join(trusted, 'node-supervisor.mjs'), await readFile(new URL('../runtime/node-supervisor.mjs', import.meta.url)));
  const childSource = `import {createServer} from 'node:net';
const server=createServer(socket=>socket.end('owned fixture'));
server.listen(0,'127.0.0.1',()=>process.send({pid:process.pid,port:server.address().port}));\n`;
  // A trusted, deliberately unrestricted test Worker creates a real same-PGID
  // child. The supervisor and its IPC-disconnect handler are the actual source.
  // This tests lifecycle containment, not the learner Permission Model.
  await writeFile(path.join(trusted, 'node-worker.mjs'), `import {parentPort} from 'node:worker_threads';
import {spawn} from 'node:child_process';import {writeFileSync} from 'node:fs';
parentPort.once('message',()=>{
 const child=spawn(process.execPath,['--input-type=module','--eval',${JSON.stringify(childSource)}],{detached:false,stdio:['ignore','ignore','ignore','ipc']});
 child.once('message',message=>writeFileSync(${JSON.stringify(marker)},JSON.stringify({...message,supervisorPid:process.pid})));
});\n`);
  const job = { mode: 'run', dataRoots: [dataRoot], workerArgs: [], limits: { heapMb: 64, outputLines: 200, outputBytes: 65536 }, caseTimeoutMs: 30000, valueLimits: {} };
  await writeFile(path.join(base, 'desktop', 'service.mjs'), `import {spawn} from 'node:child_process';
const supervisor=spawn(process.execPath,[${JSON.stringify(path.join(trusted, 'node-supervisor.mjs'))}],{detached:true,stdio:['ignore','ignore','ignore','ipc']});
supervisor.send({protocol:'javascript-edu-node-v1',auth:'a'.repeat(64),job:${JSON.stringify(job)}});
process.on('SIGTERM',()=>{});process.on('message',()=>{});setInterval(()=>{},1000);
process.send({type:'ready',port:42424,runtime:'24.22.0'});\n`);
  const service = launchLearningService({ executable: process.execPath, projectRoot: base, port: 0, shutdownTimeoutMs: 75 });
  const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
  const control = spawn(process.execPath, ['--input-type=module', '--eval', childSource], { detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const controlExit = new Promise(resolve => control.once('exit', resolve));
  const controlReady = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Independent control server did not start.')), 4000);
    control.once('message', value => { clearTimeout(timer); resolve(value); });
    control.once('error', error => { clearTimeout(timer); reject(error); });
  });
  let owned, verifiedGroup;
  try {
    const [, sibling] = await Promise.all([service.ready, controlReady]);
    const readyDeadline = Date.now() + 7000;
    while (!owned && Date.now() < readyDeadline) { try { owned = JSON.parse(await readFile(marker, 'utf8')); } catch { await new Promise(resolve => setTimeout(resolve, 25)); } }
    assert.ok(owned && Number.isInteger(owned.pid) && Number.isInteger(owned.supervisorPid) && owned.port > 0, 'Real Worker child must open its port before termination.');
    const pgid = pid => Number(execFileSync('/bin/ps', ['-o', 'pgid=', '-p', String(pid)], { encoding: 'utf8' }).trim());
    assert.equal(pgid(owned.supervisorPid), owned.supervisorPid, 'Detached supervisor owns its exact PGID.');
    assert.equal(pgid(owned.pid), owned.supervisorPid, 'Port-holding child belongs to that same owned group.');
    assert.notEqual(pgid(service.child.pid), owned.supervisorPid, 'Service and supervisor are in separate groups.');
    assert.equal(pgid(control.pid), control.pid, 'Control server has a different, explicitly owned sibling group.');
    assert.notEqual(control.pid, owned.supervisorPid);
    verifiedGroup = owned.supervisorPid;
    assert.ok(alive(owned.supervisorPid) && alive(owned.pid));
    const result = await service.close();
    assert.equal(result.ok, false, 'The stalled service shutdown remains a failure even after forced process reclamation.');
    assert.equal((await service.exit).signal, 'SIGKILL');
    const stoppedDeadline = Date.now() + 7000;
    while ((alive(owned.supervisorPid) || alive(owned.pid)) && Date.now() < stoppedDeadline) await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(alive(service.child.pid), false);
    assert.equal(alive(owned.supervisorPid), false, 'Orphan supervisor was reaped.');
    assert.equal(alive(owned.pid), false, 'Same-group port-holding child was reaped.');
    assert.equal(alive(control.pid), true, 'The independent sibling group must remain alive.');
    const controlResponse = await new Promise((resolve, reject) => {
      const socket = createConnection({ host: '127.0.0.1', port: sibling.port });
      let text = '';
      socket.setTimeout(2000, () => { socket.destroy(); reject(new Error('Control server response timeout.')); });
      socket.on('data', chunk => { text += chunk.toString(); });
      socket.once('error', reject); socket.once('end', () => resolve(text));
    });
    assert.equal(controlResponse, 'owned fixture', 'The independent sibling port is still usable.');
    const probe = createServer();
    await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(owned.port, '127.0.0.1', resolve); });
    await new Promise(resolve => probe.close(resolve));
  } finally {
    if (alive(service.child.pid)) { service.child.kill('SIGKILL'); await service.exit; }
    if (verifiedGroup && (alive(owned.supervisorPid) || alive(owned.pid))) { try { process.kill(-verifiedGroup, 'SIGKILL'); } catch {} }
    if (control.exitCode === null && control.signalCode === null) { control.kill('SIGKILL'); await controlExit; }
  }
});

test('POSIX supervisor refuses to run in its caller group and never signals an unowned group', { skip: process.platform === 'win32', timeout: 10000 }, async t => {
  const base = await directory(t), supervisorFile = path.join(base, 'node-supervisor.mjs');
  await writeFile(supervisorFile, await readFile(new URL('../runtime/node-supervisor.mjs', import.meta.url)));
  const child = spawn(process.execPath, [supervisorFile], { detached: false, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  try {
    const message = new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Supervisor did not reject an unowned group.')), 4000); child.once('message', value => { clearTimeout(timer); resolve(value); }); child.once('error', error => { clearTimeout(timer); reject(error); }); });
    child.send({ protocol: 'javascript-edu-node-v1', auth: 'a'.repeat(64), job: {} });
    const result = await message;
    assert.equal(result.payload.status, 'infrastructure-error');
    assert.match(result.payload.error, /프로세스 그룹/);
    child.disconnect();
    assert.deepEqual(await exited, { code: 1, signal: null });
    assert.equal(process.kill(process.pid, 0), true);
  } finally { if (child.exitCode === null) { child.kill('SIGKILL'); await exited; } }
});
