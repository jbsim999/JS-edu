import { mkdir, readFile, writeFile, copyFile, stat, rename, chmod } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inventory, copyInventory, sha256File, verifyArchive, selectPackageSource, assertHeadSourceBytes } from './desktop-integrity.mjs';
import { unixInventory, copyUnixInventory, compareUnixInventories, extractUnixZip, extractUnixTarGz } from './macos-integrity.mjs';
import { requireNativeMac, inspectVendorSignature, assertMacBinaryArchitecture } from './macos-platform.mjs';
import { inspectOriginalElectronSignatures } from './macos-signatures.mjs';
import { desktopRuntimeTarget } from '../desktop/runtime-target.mjs';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

async function download(vendor, filename) {
  try { await stat(filename); return; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${randomUUID()}.download`;
  const response = await fetch(vendor.downloadUrl, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`Official vendor download failed: ${vendor.archive} HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: 'wx' }));
  if (await sha256File(temporary) !== vendor.sha256) throw new Error('Downloaded Mac vendor checksum does not match the pinned official release.');
  await rename(temporary, filename);
}

export async function packageDesktopMac({ outputDirectory = path.join(root, 'dist'), electronArchive, nodeArchive, allowDirty = false, skipFinalVerification = false } = {}) {
  const nativeHost = requireNativeMac();
  const architecture = nativeHost.architecture;
  const configuration = JSON.parse(await readFile(path.join(root, 'desktop', 'vendors-macos.json'), 'utf8'));
  const choose = vendor => { const { x64, arm64, ...common } = vendor; return { ...common, ...vendor[architecture] }; };
  const electron = choose(configuration.electron), node = choose(configuration.node);
  const sourcePackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9.]+)?$/.test(sourcePackage.version)) throw new Error('A safe application version is required.');
  const sourceCommit = git(['rev-parse', 'HEAD']);
  const trackedPaths = new Set(git(['ls-tree', '-r', '--name-only', '-z', 'HEAD']).split('\0').filter(Boolean));
  const headBlobs = new Map(git(['ls-tree', '-r', '-z', 'HEAD']).split('\0').filter(Boolean).map(line => {
    const match = /^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(line);
    if (!match || match[1] === '120000') throw new Error('Unsupported source tree object/link.');
    return [match[3], match[2]];
  }));
  let sourceDirty = git(['status', '--porcelain=v1', '--untracked-files=normal']).length > 0;
  if (sourceDirty && !allowDirty) throw new Error('Commit reviewed clean source before final Mac packaging.');
  const buildInputNames = ['package.json', 'desktop/PORTABLE-MACOS-README.txt', 'desktop/THIRD-PARTY-MACOS-NOTICES.txt', 'scripts/package-desktop.mjs', 'scripts/package-desktop-macos.mjs', 'scripts/desktop-integrity.mjs', 'scripts/macos-integrity.mjs', 'scripts/macos-platform.mjs', 'scripts/macos-signatures.mjs'];
  const buildInputFiles = await Promise.all(buildInputNames.map(async relative => ({ path: relative, type: 'file', size: (await stat(path.join(root, relative))).size, sha256: await sha256File(path.join(root, relative)) })));
  const output = path.resolve(outputDirectory), baseName = `JavaScript-edu-${sourcePackage.version}-mac-${architecture}`;
  const archivePath = path.join(output, `${baseName}.zip`);
  await mkdir(output, { recursive: true });
  try { await stat(archivePath); throw new Error('Package already exists; never overwrite a verified package.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const cache = path.join(root, 'work', 'desktop-vendors');
  const electronZip = path.resolve(electronArchive || path.join(cache, electron.archive));
  const nodeTar = path.resolve(nodeArchive || path.join(cache, node.archive));
  await download(electron, electronZip); await download(node, nodeTar);
  const electronIdentity = await verifyArchive(electronZip, electron), nodeIdentity = await verifyArchive(nodeTar, node);
  const work = path.join(root, 'work', `desktop-build-mac-${architecture}-${randomUUID()}`);
  await mkdir(work, { recursive: false });
  const diagnostics = path.join(root, 'artifacts', 'macos-vendor-diagnostics', `${architecture}-${randomUUID()}`);
  await mkdir(diagnostics, { recursive: true });
  const electronStage = path.join(work, 'electron'), nodeStage = path.join(work, 'node');
  const electronManifest = await extractUnixZip(electronZip, electronStage), nodeManifest = await extractUnixTarGz(nodeTar, nodeStage);
  for (const required of ['Electron.app/Contents/MacOS/Electron', 'Electron.app/Contents/Info.plist', 'Electron.app/Contents/Resources/default_app.asar', 'LICENSE', 'LICENSES.chromium.html']) if (!electronManifest.some(item => item.path === required && item.type === 'file')) throw new Error(`Incomplete Electron Mac archive: ${required}`);
  const nodeFolder = `node-v24.22.0-darwin-${architecture}`;
  for (const required of ['bin/node', 'LICENSE', 'README.md', 'lib/node_modules/npm/package.json']) if (!nodeManifest.some(item => item.path === `${nodeFolder}/${required}` && item.type === 'file')) throw new Error(`Incomplete Node Mac archive: ${required}`);
  for (const required of ['bin/node']) if (!(nodeManifest.find(item => item.path === `${nodeFolder}/${required}`).mode & 0o111)) throw new Error('Official Node lacks its executable mode.');
  const inspectVendors = async (electronRoot, nodeRoot, phase) => ({
    electron: { architecture: assertMacBinaryArchitecture(path.join(electronRoot, 'Electron.app/Contents/MacOS/Electron'), architecture), signature: await inspectOriginalElectronSignatures(electronRoot, { architecture, version: electron.version, files: electronManifest, scratchParent: work, reportPath: path.join(diagnostics, `${phase}-electron.json`) }) },
    node: { architecture: assertMacBinaryArchitecture(path.join(nodeRoot, nodeFolder, 'bin/node'), architecture), signature: inspectVendorSignature(path.join(nodeRoot, nodeFolder, 'bin/node')) },
  });
  // Independently extract the checksum-verified upstream ZIP with Apple's tool.
  // This distinguishes an upstream unsealed bundle from a parser omission.
  const dittoStage = path.join(work, 'electron-ditto-original');
  execFileSync('/usr/bin/ditto', ['-x', '-k', electronZip, dittoStage], { stdio: 'pipe' });
  const independentExtraction = compareUnixInventories(electronManifest, await unixInventory(dittoStage), 'Independent ditto original Electron extraction');
  await writeFile(path.join(diagnostics, 'original-extraction-comparison.json'), json({ status: 'PASS', scope: 'independent-extraction-bytes-modes-links-only', extractor: '/usr/bin/ditto -x -k', archiveSha256: electronIdentity.sha256, inventory: independentExtraction }));
  const originalVendorVerification = await inspectVendors(electronStage, nodeStage, 'parser-original');
  const independentOriginalVerification = { extractor: '/usr/bin/ditto -x -k', archiveSha256: electronIdentity.sha256, inventory: independentExtraction, ...(await inspectVendors(dittoStage, nodeStage, 'ditto-original')) };
  const actualNode = JSON.parse(execFileSync(path.join(nodeStage, nodeFolder, 'bin/node'), ['--eval', 'console.log(JSON.stringify({version:process.versions.node,platform:process.platform,architecture:process.arch}))'], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: work, TMPDIR: work } }));
  if (actualNode.version !== node.version || actualNode.platform !== 'darwin' || actualNode.architecture !== architecture) throw new Error('Included native Node runtime is not the target version/CPU.');
  const build = path.join(work, baseName), bundle = path.join(build, 'JavaScript-edu.app');
  const resources = path.join(bundle, 'Contents', 'Resources'), appRoot = path.join(resources, 'app');
  await mkdir(path.join(bundle, 'Contents', 'MacOS'), { recursive: true });
  await mkdir(path.join(resources, 'vendor'), { recursive: true });
  await copyUnixInventory(electronStage, path.join(resources, 'vendor', 'electron'), electronManifest);
  await copyUnixInventory(nodeStage, path.join(resources, 'vendor', 'node'), nodeManifest);
  await mkdir(appRoot);
  const desktopSourceNames = ['application.mjs', 'main.mjs', 'policy.mjs', 'runtime-target.mjs', 'service.mjs', 'service-client.mjs', 'README.md', 'vendors-macos.json'];
  const candidatePaths = new Set(desktopSourceNames.map(name => `desktop/${name}`));
  const sourceEntries = [];
  for (const folder of ['web', 'runtime', 'curriculum', 'starter', 'desktop']) {
    const included = relative => !(folder === 'web' && relative.startsWith('execution/qualification')) && !(folder === 'desktop' && !desktopSourceNames.includes(relative));
    const requiredPaths = new Set([...trackedPaths].filter(relative => relative.startsWith(`${folder}/`) && included(relative.slice(folder.length + 1))));
    const files = selectPackageSource((await inventory(path.join(root, folder))).filter(item => included(item.path)), { folder, trackedPaths: requiredPaths, allowDirty, candidatePaths });
    await copyInventory(path.join(root, folder), path.join(appRoot, folder), files);
    sourceEntries.push(...files.map(item => ({ ...item, path: `${folder}/${item.path}` })));
  }
  await copyFile(path.join(root, 'education.config.json'), path.join(appRoot, 'education.config.json'));
  sourceEntries.push({ path: 'education.config.json', type: 'file', size: (await stat(path.join(root, 'education.config.json'))).size, sha256: await sha256File(path.join(root, 'education.config.json')) });
  await writeFile(path.join(appRoot, 'package.json'), json({ name: sourcePackage.name, productName: 'JavaScript-edu', version: sourcePackage.version, private: true, type: 'module', main: 'desktop/main.mjs' }));
  await writeFile(path.join(appRoot, 'desktop', 'runtime-config.json'), json(desktopRuntimeTarget('darwin', architecture)));
  // The unsigned wrapper is ours. The upstream Electron.app keeps its original
  // unsigned/linker-only images and unsealed bundle. No re-signing or resource
  // insertion inside that vendor app is permitted.
  const launcher = '#!/bin/sh\nset -eu\nBASE=$(CDPATH= cd -- "$(dirname "$0")/../Resources" && pwd)\nexec "$BASE/vendor/electron/Electron.app/Contents/MacOS/Electron" "$BASE/app" "$@"\n';
  await writeFile(path.join(bundle, 'Contents', 'MacOS', 'JavaScript-edu'), launcher);
  await chmod(path.join(bundle, 'Contents', 'MacOS', 'JavaScript-edu'), 0o755);
  await writeFile(path.join(bundle, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>CFBundleName</key><string>JavaScript-edu</string><key>CFBundleDisplayName</key><string>JavaScript-edu</string><key>CFBundleIdentifier</key><string>org.junbo.javascriptedu</string><key>CFBundleExecutable</key><string>JavaScript-edu</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>${sourcePackage.version}</string><key>CFBundleVersion</key><string>${sourcePackage.version}</string><key>LSMinimumSystemVersion</key><string>13.5</string><key>NSHighResolutionCapable</key><true/></dict></plist>\n`);
  execFileSync('/usr/bin/plutil', ['-lint', path.join(bundle, 'Contents', 'Info.plist')], { stdio: 'pipe' });
  await mkdir(path.join(build, 'integrity'));
  await writeFile(path.join(build, 'integrity', 'electron.json'), json({ ...electronIdentity, version: electron.version, source: electron.downloadUrl, files: electronManifest }));
  await writeFile(path.join(build, 'integrity', 'node.json'), json({ ...nodeIdentity, version: node.version, source: node.downloadUrl, files: nodeManifest }));
  const sourceManifest = sourceEntries.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const byteChanges = await assertHeadSourceBytes(root, [...sourceManifest, ...buildInputFiles], headBlobs, { allowDirty });
  sourceDirty ||= byteChanges.length > 0;
  const buildInfo = { product: 'JavaScript-edu', version: sourcePackage.version, sourceCommit, sourceDirty, sourceFilesSha256: digest(sourceManifest), builtAt: new Date().toISOString(),
    finalPackageVerification: skipFinalVerification ? 'SKIPPED_BY_REQUEST' : 'Reported in the external package manifest',
    buildHost: { ...nativeHost, node: process.versions.node }, target: { platform: 'darwin', architecture, minimumOs: configuration.minimumOs },
    signing: 'Unsigned application wrapper. Original Electron x64 images are unsigned; arm64 retains linker-only code signatures and its upstream bundle signature check remains FAIL (unsealed). Every embedded code signature is individually verified without changing vendor bytes. No complete Electron bundle signature, Developer ID signing, notarization or Gatekeeper approval claimed.',
    electron, learnerNode: node, actualNode, originalVendorVerification, independentOriginalVerification,
    appRelativePath: 'JavaScript-edu.app/Contents/Resources/app', electronRelativeRoot: 'JavaScript-edu.app/Contents/Resources/vendor/electron',
    executableRelativePath: 'JavaScript-edu.app/Contents/MacOS/JavaScript-edu', runtimePath: `JavaScript-edu.app/Contents/Resources/vendor/node/${nodeFolder}/bin/node`,
    packageTransformations: ['Unsigned outer app wrapper launches untouched official Electron.app with separate application source argument', 'Application package.json and target-specific desktop/runtime-config.json are generated', 'Complete official Electron and Node distributions retain file bytes, executable modes and relative link text', 'Developer qualification, references, tests and repository metadata are excluded'] };
  await writeFile(path.join(build, 'BUILD-INFO.json'), json(buildInfo));
  await writeFile(path.join(build, 'integrity', 'source.json'), json({ sourceCommit, sourceDirty, digest: buildInfo.sourceFilesSha256, files: sourceManifest, buildInputFiles }));
  await copyFile(path.join(root, 'desktop', 'PORTABLE-MACOS-README.txt'), path.join(build, 'START-HERE.txt'));
  await copyFile(path.join(root, 'desktop', 'THIRD-PARTY-MACOS-NOTICES.txt'), path.join(build, 'THIRD-PARTY-NOTICES.txt'));
  const buildManifest = await unixInventory(build);
  compareUnixInventories(electronManifest, await unixInventory(path.join(resources, 'vendor', 'electron')), 'Built Mac Electron vendor');
  compareUnixInventories(nodeManifest, await unixInventory(path.join(resources, 'vendor', 'node')), 'Built Mac Node vendor');
  // -y stores symbolic links as links and preserves Unix modes. Final extraction
  // remains the default; a requested build-only run records that it was skipped.
  execFileSync('/usr/bin/zip', ['-q', '-r', '-y', archivePath, baseName], { cwd: work, stdio: 'pipe', maxBuffer: 1024 * 1024 });
  let extracted = null, comparison = null, extractedManifest = null, finalVendorVerification = null;
  if (!skipFinalVerification) {
    const extractedParent = path.join(work, 'final-zip-extracted');
    await extractUnixZip(archivePath, extractedParent);
    extracted = path.join(extractedParent, baseName);
    extractedManifest = await unixInventory(extracted);
    comparison = compareUnixInventories(buildManifest, extractedManifest, 'Final extracted Mac ZIP');
    const finalResources = path.join(extracted, 'JavaScript-edu.app', 'Contents', 'Resources');
    compareUnixInventories(electronManifest, await unixInventory(path.join(finalResources, 'vendor', 'electron')), 'Final Mac Electron vendor');
    compareUnixInventories(nodeManifest, await unixInventory(path.join(finalResources, 'vendor', 'node')), 'Final Mac Node vendor');
    finalVendorVerification = await inspectVendors(path.join(finalResources, 'vendor', 'electron'), path.join(finalResources, 'vendor', 'node'), 'final-zip');
  }
  for (const item of [...sourceManifest, ...buildInputFiles].filter(item => item.type === 'file')) if (await sha256File(path.join(root, item.path)) !== item.sha256) throw new Error(`Source changed during Mac packaging: ${item.path}`);
  if (git(['rev-parse', 'HEAD']) !== sourceCommit || (!allowDirty && git(['status', '--porcelain=v1', '--untracked-files=normal']))) throw new Error('Source tree changed during final Mac packaging.');
  const hash = await sha256File(archivePath);
  const report = { status: skipFinalVerification ? 'BUILT_UNVERIFIED' : 'PASS',
    scope: skipFinalVerification ? 'build-only-final-package-verification-skipped' : 'final-zip-extraction-and-byte-integrity-only',
    finalArchiveVerification: skipFinalVerification ? 'SKIPPED_BY_REQUEST' : 'PASS',
    package: path.basename(archivePath), sha256: hash, bytes: (await stat(archivePath)).size,
    sourceCommit, sourceDirty, sourceFilesSha256: buildInfo.sourceFilesSha256, target: buildInfo.target, buildPath: build, extractedPath: extracted, files: comparison?.files ?? null,
    electronFiles: electronManifest.filter(item => item.type === 'file').length, nodeFiles: nodeManifest.filter(item => item.type === 'file').length,
    links: extractedManifest?.filter(item => item.type === 'symlink').length ?? null, unixModesVerified: !skipFinalVerification, finalVendorVerification,
    nativeApplicationTest: skipFinalVerification ? 'SKIPPED_BY_REQUEST' : 'Not performed by the packaging command. Run check:desktop:smoke on this exact native CPU and extraction.', inventory: buildManifest };
  await writeFile(path.join(output, `${baseName}.manifest.json`), json(report));
  await writeFile(path.join(output, `${baseName}.sha256`), `${hash}  ${baseName}.zip\n`);
  return { ...report, inventory: undefined, archivePath };
}
