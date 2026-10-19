const baseRuntime = ['timeout', 'cancel', 'output-limit', 'recovery-after-termination', 'worker-csp-header', 'worker-csp-enforcement'];
const moduleRuntime = ['module-fresh-case-state', 'module-export-then', 'module-prototype-then', 'module-tla-timeout', 'module-cancel', 'module-recovery', 'module-namespace-csp', 'module-namespace-csp-headers'];
const domRuntime = ['dom-cross-origin-and-fixture-isolation', 'dom-limits-disclosed'];
const exerciseTests = ['reference-run', 'reference-submit', 'starter-rejected', 'incorrect-rejected'];

function completePassed(items, expected, key) {
  return Array.isArray(items) && items.length === expected.length && new Set(expected).size === expected.length
    && expected.every(id => items.filter(item => item?.[key] === id && item.passed === true).length === 1);
}

// A missing expected record is failure, even when every present record passed.
export function qualificationPassed(report, exercises, stopped = false) {
  if (stopped || report?.error || !Array.isArray(exercises) || !exercises.length) return false;
  const ids = exercises.map(exercise => exercise.id);
  const domIds = exercises.filter(exercise => exercise.hostRequirements?.includes('browser-dom')).map(exercise => exercise.id);
  const runtime = [...baseRuntime,
    ...(exercises.some(exercise => exercise.runner?.kind === 'module-files') ? moduleRuntime : []),
    ...(domIds.length ? domRuntime : [])];
  return completePassed(report?.exercises, ids, 'exerciseId')
    && report.exercises.every(exercise => !exercise.error && completePassed(exercise.tests, exerciseTests, 'name'))
    && completePassed(report.examples, domIds, 'exerciseId')
    && report.examples.every(example => !example.error)
    && completePassed(report.runtime, runtime, 'name');
}
