export function classifyApis(requested, provided) {
  const language = ['Promise', 'Map', 'JSON'];
  const web = ['document', 'fetch'];
  const node = ['node:fs', 'node:path'];
  return requested.map((name) => {
    let layer = 'unknown';
    if (language.includes(name)) layer = 'language';
    else if (web.includes(name)) layer = 'web';
    else if (node.includes(name)) layer = 'node';
    else if (name === 'setTimeout') layer = 'host';
    return { name, layer, available: layer !== 'unknown' && provided.includes(name) };
  });
}
