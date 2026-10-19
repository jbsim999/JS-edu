import { execFileSync, spawnSync } from 'node:child_process';
import { desktopRuntimeTarget } from '../desktop/runtime-target.mjs';

export function requireNativeMac() {
  const target = desktopRuntimeTarget(process.platform, process.arch);
  if (target.platform !== 'darwin') throw new Error('A native macOS host is required; a Windows cross-build is not a Mac execution result.');
  const architecture = execFileSync('/usr/bin/uname', ['-m'], { encoding: 'utf8' }).trim();
  const translated = spawnSync('/usr/sbin/sysctl', ['-in', 'sysctl.proc_translated'], { encoding: 'utf8' });
  if (translated.stdout?.trim() === '1' || architecture !== (target.architecture === 'arm64' ? 'arm64' : 'x86_64')) throw new Error('CPU emulation or a mismatched native host is not accepted.');
  return { platform: process.platform, architecture: process.arch, osVersion: execFileSync('/usr/bin/sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim(), kernelArchitecture: architecture, translated: false };
}

export function inspectVendorSignature(filename, { bundle = false } = {}) {
  const options = { encoding: 'utf8', env: { ...process.env, LANG: 'C', LC_ALL: 'C' }, maxBuffer: 1024 * 1024 };
  const display = spawnSync('/usr/bin/codesign', ['--display', '--verbose=4', filename], options);
  const details = `${display.stdout || ''}${display.stderr || ''}`;
  if (display.status !== 0) {
    if (details.includes('code object is not signed at all')) return { signed: false, verification: 'not-applicable-original-vendor-unsigned', details };
    throw new Error(`Cannot inspect original vendor signature: ${details}`);
  }
  const verification = spawnSync('/usr/bin/codesign', ['--verify', ...(bundle ? ['--deep'] : []), '--strict', '--verbose=2', filename], options);
  if (verification.status !== 0) throw new Error(`Original vendor signature is invalid: ${verification.stderr || verification.stdout}`);
  return { signed: true, kind: /Signature=adhoc/.test(details) ? 'ad-hoc' : 'upstream-signature-see-details', verification: 'codesign-strict-pass', details, verificationOutput: `${verification.stdout || ''}${verification.stderr || ''}` };
}

export function assertMacBinaryArchitecture(filename, architecture) {
  const actual = execFileSync('/usr/bin/lipo', ['-archs', filename], { encoding: 'utf8' }).trim().split(/\s+/u);
  const expected = architecture === 'arm64' ? 'arm64' : architecture === 'x64' ? 'x86_64' : '';
  if (actual.length !== 1 || actual[0] !== expected) throw new Error(`Vendor binary CPU does not match native target: ${actual.join(',')}`);
  return actual[0];
}

export function closeOwnedMacApplication(pid) {
  if (process.platform !== 'darwin' || !Number.isInteger(pid) || pid <= 1) throw new Error('A valid owned macOS application PID is required.');
  // AppKit targets only the owned PID and sends a normal termination request.
  // This does not use accessibility automation or match/quit unrelated Electron apps.
  const script = `ObjC.import('AppKit'); $.NSRunningApplication.runningApplicationWithProcessIdentifier(${pid}).terminate ? 'true' : 'false';`;
  return execFileSync('/usr/bin/osascript', ['-l', 'JavaScript', '-e', script], { encoding: 'utf8', timeout: 10000 }).trim() === 'true';
}

export function findOwnedMacApplication(executable) {
  if (process.platform !== 'darwin' || !executable.startsWith('/')) throw new Error('An absolute owned macOS executable path is required.');
  const processes = execFileSync('/bin/ps', ['-axww', '-o', 'pid=', '-o', 'comm='], { encoding: 'utf8' });
  const found = processes.split('\n').flatMap(line => {
    const match = /^\s*(\d+)\s+(.+)$/.exec(line);
    return match && match[2].normalize('NFC') === executable.normalize('NFC') ? [Number(match[1])] : [];
  });
  if (found.length > 1) throw new Error('More than one process uses the dedicated test app path.');
  return found[0];
}
