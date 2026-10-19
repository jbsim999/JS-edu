import { serializeNodeSource, validateNodeSnapshot } from '../runtime/node-contract.mjs';

// Authored metadata only. This check does not execute code or enable the runtime.
export function validateNodeExercise(exercise) {
  const errors = [];
  const id = exercise?.id ?? 'node';
  const need = (condition, message) => { if (!condition) errors.push(`${message}: ${id}`); };
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  need(exercise?.mode === 'files' && exercise?.profileId === 'node-native', 'Invalid Node exercise profile/mode');
  need(exercise?.hostRequirements?.includes('node-native'), 'Node host requirement missing');
  need(exercise?.editable === undefined, 'Node modules cannot use a body template');
  const workspace = exercise?.workspace;
  need(record(workspace) && Object.keys(workspace).sort().join(',') === 'entry,files', 'Invalid Node workspace manifest');
  const files = Array.isArray(workspace?.files) ? workspace.files : [];
  const entry = files.find(file => file?.path === workspace?.entry);
  need(entry?.editable === true, 'Node entry must be editable');
  need(typeof exercise?.template === 'string' && typeof entry?.source === 'string' &&
    exercise.template.replace(/\r\n/g, '\n') === entry.source.replace(/\r\n/g, '\n'), 'Node entry source/template mismatch');
  need(typeof exercise?.runner?.runProbe === 'string' && exercise.runner.runProbe.trim(), 'Node runProbe is required');
  const names = [];
  for (const file of files) {
    need(record(file) && Object.keys(file).sort().join(',') === 'editable,path,source', 'Invalid Node file declaration');
    if (typeof file?.path === 'string') {
      const current = file.path.toLowerCase();
      need(!names.some(other => current.startsWith(`${other}/`) || other.startsWith(`${current}/`)), 'Node file/directory path collision');
      names.push(current);
    }
  }
  try {
    const source = serializeNodeSource({ entry: workspace?.entry,
      files: Object.fromEntries(files.map(file => [file?.path, file?.source])) });
    validateNodeSnapshot(exercise, source);
  } catch (error) { errors.push(`Invalid Node module manifest: ${id}: ${error.message}`); }
  return errors;
}
