export function resolveSettings(options, loadDefaults) {
  const retries = options?.retries;
  const ui = options?.ui;
  const enabled = ui?.enabled;
  const label = ui?.label;
  const needsDefaults = retries === null || retries === undefined
    || enabled === null || enabled === undefined
    || label === null || label === undefined;
  const defaults = needsDefaults ? loadDefaults() : undefined;
  return {
    retries: retries ?? defaults.retries,
    enabled: enabled ?? defaults.enabled,
    label: label ?? defaults.label,
  };
}
