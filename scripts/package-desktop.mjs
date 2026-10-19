import { mkdir, readFile, writeFile, copyFile, stat, rename } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inventory, copyInventory, compareInventories, extractZip, sha256File, verifyArchive, selectPackageSource, assertHeadSourceBytes } from './desktop-integrity.mjs';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
// PowerShell 7/.NET supports the long vendor paths that legacy Windows PowerShell
// 5/.NET Framework truncates. CI installs/checks this build dependency explicitly.
const powershell = () => 'pwsh.exe';
const quotePowerShell = value => `'${value.replaceAll("'", "''")}'`;
const hashManifest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function downloadArchive(vendor, filename) {
  try { await stat(filename); return; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${randomUUID()}.download`;
  const response = await fetch(vendor.downloadUrl, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`Official vendor download failed: ${vendor.archive} HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: 'wx' }));
  if (await sha256File(temporary) !== vendor.sha256) throw new Error('Downloaded archive checksum does not match the pinned official release.');
  await rename(temporary, filename);
}

export async function packageDesktop({ outputDirectory = path.join(root, 'dist'), electronArchive, nodeArchive, allowDirty = false } = {}) {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Windows x64 native packaging is required; other host/CPU results are not equivalent.');
  const configuration = JSON.parse(await readFile(path.join(root, 'desktop', 'vendors.json'), 'utf8'));
  const sourcePackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  const trackedPaths = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).split('\0').filter(Boolean));
  const headBlobs = new Map(execFileSync('git', ['ls-tree', '-r', '-z', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).split('\0').filter(Boolean).map(line => {
    const match = /^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(line);
    if (!match || match[1] === '120000') throw new Error('The source tree contains an unsupported object/link.');
    return [match[3], match[2]];
  }));
  const desktopSourceNames = ['application.mjs', 'main.mjs', 'policy.mjs', 'service.mjs', 'service-client.mjs', 'README.md', 'vendors.json'];
  const candidatePaths = new Set(desktopSourceNames.map(name => `desktop/${name}`));
  let sourceDirty = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=normal'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim().length !== 0;
  if (sourceDirty && !allowDirty) throw new Error('Commit the reviewed source before final packaging. --allow-dirty creates an explicitly marked local candidate only.');
  const buildInputFiles = await Promise.all(['package.json', 'desktop/PORTABLE-README.txt', 'desktop/THIRD-PARTY-NOTICES.txt', 'scripts/package-desktop.mjs', 'scripts/desktop-integrity.mjs'].map(async relative => ({ path: relative, type: 'file', size: (await stat(path.join(root, relative))).size, sha256: await sha256File(path.join(root, relative)) })));
  const output = path.resolve(outputDirectory);
  const baseName = `JavaScript-edu-${sourcePackage.version}-win-x64`;
  const archivePath = path.join(output, `${baseName}.zip`);
  await mkdir(output, { recursive: true });
  try { await stat(archivePath); throw new Error('Package already exists; use a new output directory instead of overwriting verified artifacts.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const cache = path.join(root, 'work', 'desktop-vendors');
  const electronZip = path.resolve(electronArchive || path.join(cache, configuration.electron.archive));
  const nodeZip = path.resolve(nodeArchive || path.join(root, 'work', 'runtimes', configuration.node.archive));
  await downloadArchive(configuration.electron, electronZip);
  await downloadArchive(configuration.node, nodeZip);
  const electronIdentity = await verifyArchive(electronZip, configuration.electron);
  const nodeIdentity = await verifyArchive(nodeZip, configuration.node);
  const work = path.join(root, 'work', `desktop-build-${randomUUID()}`);
  await mkdir(work, { recursive: false });
  const electronStage = path.join(work, 'electron');
  const nodeStage = path.join(work, 'node');
  const electronManifest = await extractZip(electronZip, electronStage);
  const nodeManifest = await extractZip(nodeZip, nodeStage);
  for (const required of ['electron.exe', 'LICENSE', 'LICENSES.chromium.html', 'resources/default_app.asar', 'icudtl.dat']) if (!electronManifest.some(item => item.path === required && item.type === 'file')) throw new Error(`Incomplete Electron distribution: ${required}`);
  for (const required of ['node.exe', 'LICENSE', 'README.md', 'npm.cmd', 'node_modules/npm/package.json']) if (!nodeManifest.some(item => item.path === `node-v24.22.0-win-x64/${required}` && item.type === 'file')) throw new Error(`Incomplete Node distribution: ${required}`);
  const build = path.join(work, baseName);
  await copyInventory(electronStage, build, electronManifest);
  // The branded entry point is a byte-identical additional copy. electron.exe and every
  // upstream file stay present, so no resource editor or re-signing mutates the vendor.
  await copyFile(path.join(build, 'electron.exe'), path.join(build, 'JavaScript-edu.exe'));
  await mkdir(path.join(build, 'resources', 'vendor'), { recursive: true });
  await copyInventory(nodeStage, path.join(build, 'resources', 'vendor', 'node'), nodeManifest);

  const appRoot = path.join(build, 'resources', 'app');
  await mkdir(appRoot);
  const sourceEntries = [];
  for (const folder of ['web', 'runtime', 'curriculum', 'starter', 'desktop']) {
    const included = relative => {
      if (folder === 'web' && relative.startsWith('execution/qualification')) return false;
      if (folder === 'desktop' && !desktopSourceNames.includes(relative)) return false;
      return true;
    };
    // Derive the required set independently from HEAD using exactly the same
    // product-boundary rules. A hidden skip-worktree deletion must not disappear
    // from the expected input merely because it is absent from disk inventory.
    const requiredPaths = new Set([...trackedPaths].filter(relative => relative.startsWith(`${folder}/`) && included(relative.slice(folder.length + 1))));
    const files = selectPackageSource((await inventory(path.join(root, folder))).filter(item => included(item.path)), { folder, trackedPaths: requiredPaths, allowDirty, candidatePaths });
    await copyInventory(path.join(root, folder), path.join(appRoot, folder), files);
    sourceEntries.push(...files.map(item => ({ ...item, path: `${folder}/${item.path}` })));
  }
  await copyFile(path.join(root, 'education.config.json'), path.join(appRoot, 'education.config.json'));
  sourceEntries.push({ path: 'education.config.json', type: 'file', size: (await stat(path.join(root, 'education.config.json'))).size, sha256: await sha256File(path.join(root, 'education.config.json')) });
  await writeFile(path.join(appRoot, 'package.json'), json({ name: sourcePackage.name, productName: 'JavaScript-edu', version: sourcePackage.version, private: true, type: 'module', main: 'desktop/main.mjs' }));
  await writeFile(path.join(appRoot, 'desktop', 'runtime-config.json'), json({ nodeVersion: '24.22.0', nodeRelativePath: '../vendor/node/node-v24.22.0-win-x64/node.exe' }));
  await mkdir(path.join(build, 'integrity'));
  await writeFile(path.join(build, 'integrity', 'electron.json'), json({ ...electronIdentity, version: configuration.electron.version, source: configuration.electron.downloadUrl, files: electronManifest }));
  await writeFile(path.join(build, 'integrity', 'node.json'), json({ ...nodeIdentity, version: configuration.node.version, source: configuration.node.downloadUrl, files: nodeManifest }));
  const sourceManifest = sourceEntries.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const sourceByteChanges = await assertHeadSourceBytes(root, [...sourceManifest, ...buildInputFiles], headBlobs, { allowDirty });
  sourceDirty ||= sourceByteChanges.length > 0;
  const buildInfo = { product: 'JavaScript-edu', version: sourcePackage.version, sourceCommit, sourceDirty,
    sourceFilesSha256: hashManifest(sourceManifest), builtAt: new Date().toISOString(),
    buildHost: { platform: process.platform, architecture: process.arch, node: process.versions.node },
    target: configuration.target, signing: 'Unsigned application; vendor files are byte-preserved, not re-signed',
    electron: configuration.electron, learnerNode: configuration.node,
    runtimePath: 'resources/vendor/node/node-v24.22.0-win-x64/node.exe',
    packageTransformations: ['Application package.json is a recorded minimal Electron entry point', 'desktop/runtime-config.json is generated with the pinned relative Node path', 'JavaScript-edu.exe is an extra byte-identical copy of electron.exe; all original vendor entries remain', 'Developer qualification routes/source, references, tests, repository metadata and development artifacts are excluded'] };
  await writeFile(path.join(build, 'BUILD-INFO.json'), json(buildInfo));
  await writeFile(path.join(build, 'integrity', 'source.json'), json({ sourceCommit, sourceDirty, digest: buildInfo.sourceFilesSha256, files: sourceManifest, buildInputFiles }));
  await copyFile(path.join(root, 'desktop', 'PORTABLE-README.txt'), path.join(build, 'START-HERE.txt'));
  await copyFile(path.join(root, 'desktop', 'THIRD-PARTY-NOTICES.txt'), path.join(build, 'THIRD-PARTY-NOTICES.txt'));
  const buildManifest = await inventory(build);
  // Vendor comparison is against the already-recorded official extraction, not a
  // freshly regenerated manifest after build transformations.
  compareInventories(electronManifest, buildManifest.filter(item => electronManifest.some(original => original.path === item.path)), 'Built Electron vendor');
  compareInventories(nodeManifest, await inventory(path.join(build, 'resources', 'vendor', 'node')), 'Built Node vendor');
  if (await sha256File(path.join(build, 'JavaScript-edu.exe')) !== electronManifest.find(item => item.path === 'electron.exe').sha256) throw new Error('Branded executable differs from the official Electron binary.');

  const command = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory(${quotePowerShell(build)}, ${quotePowerShell(archivePath)}, [System.IO.Compression.CompressionLevel]::Optimal, $true)`;
  execFileSync(powershell(), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, stdio: 'pipe', maxBuffer: 1024 * 1024 });
  const extractedParent = path.join(work, 'final-zip-extracted');
  await extractZip(archivePath, extractedParent);
  const extracted = path.join(extractedParent, baseName);
  const extractedManifest = await inventory(extracted);
  const comparison = compareInventories(buildManifest, extractedManifest, 'Final extracted ZIP');
  compareInventories(electronManifest, extractedManifest.filter(item => electronManifest.some(original => original.path === item.path)), 'Final ZIP Electron vendor');
  compareInventories(nodeManifest, await inventory(path.join(extracted, 'resources', 'vendor', 'node')), 'Final ZIP Node vendor');
  // Pin the complete app snapshot again after copying/archiving to catch concurrent edits.
  for (const item of [...sourceManifest, ...buildInputFiles].filter(item => item.type === 'file')) if (await sha256File(path.join(root, item.path)) !== item.sha256) throw new Error(`Source changed while packaging: ${item.path}`);
  if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim() !== sourceCommit) throw new Error('Source commit changed during packaging.');
  if (!allowDirty && execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=normal'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim()) throw new Error('Source tree changed during final packaging.');
  const digest = await sha256File(archivePath);
  const report = { status: 'PASS', scope: 'final-zip-extraction-and-byte-integrity-only', package: path.basename(archivePath), sha256: digest,
    bytes: (await stat(archivePath)).size, sourceCommit, sourceDirty, sourceFilesSha256: buildInfo.sourceFilesSha256,
    target: configuration.target, buildPath: build, extractedPath: extracted, files: comparison.files,
    electronFiles: electronManifest.filter(item => item.type === 'file').length, nodeFiles: nodeManifest.filter(item => item.type === 'file').length,
    nativeApplicationTest: 'Not performed by the packaging command. Run check:desktop:smoke against this exact extracted path.',
    inventory: buildManifest };
  await writeFile(path.join(output, `${baseName}.manifest.json`), json(report));
  await writeFile(path.join(output, `${baseName}.sha256`), `${digest}  ${baseName}.zip\n`);
  return { ...report, inventory: undefined, archivePath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--allow-dirty') options.allowDirty = true;
    else if (['--output-dir', '--electron-archive', '--node-archive'].includes(args[index]) && args[index + 1]) options[({ '--output-dir': 'outputDirectory', '--electron-archive': 'electronArchive', '--node-archive': 'nodeArchive' })[args[index]]] = args[++index];
    else throw new Error('Usage: node scripts/package-desktop.mjs [--output-dir path] [--electron-archive path] [--node-archive path] [--allow-dirty]');
  }
  console.log(JSON.stringify(await packageDesktop(options), null, 2));
}
