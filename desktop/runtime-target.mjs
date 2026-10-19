export function desktopRuntimeTarget(platform, architecture) {
  if (platform === 'win32' && architecture === 'x64') return { platform, architecture, nodeVersion: '24.22.0', nodeRelativePath: '../vendor/node/node-v24.22.0-win-x64/node.exe' };
  if (platform === 'darwin' && ['x64', 'arm64'].includes(architecture)) return { platform, architecture, nodeVersion: '24.22.0', nodeRelativePath: `../vendor/node/node-v24.22.0-darwin-${architecture}/bin/node` };
  throw new Error('지원하는 플랫폼과 CPU 전용 패키지가 필요합니다.');
}

export function validateDesktopRuntime(config, platform = process.platform, architecture = process.arch) {
  const expected = desktopRuntimeTarget(platform, architecture);
  if (config.nodeVersion !== expected.nodeVersion || config.nodeRelativePath !== expected.nodeRelativePath
    || config.platform !== expected.platform || config.architecture !== expected.architecture) throw new Error('이 패키지의 플랫폼·CPU와 포함 Node.js 24.22.0 구성이 일치하지 않습니다.');
  return expected;
}
