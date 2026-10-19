import test from 'node:test';
import assert from 'node:assert/strict';
import { qualificationPassed } from '../web/execution/qualification-completion.mjs';

const names = ['timeout', 'cancel', 'output-limit', 'recovery-after-termination', 'worker-csp-header', 'worker-csp-enforcement'];
const moduleNames = ['module-fresh-case-state', 'module-export-then', 'module-prototype-then', 'module-tla-timeout', 'module-cancel', 'module-recovery', 'module-namespace-csp', 'module-namespace-csp-headers'];
function fixture({ dom = true, modules = false } = {}) {
  const exercise = { id: 'selected', runner: { kind: modules ? 'module-files' : 'function-body' }, hostRequirements: dom ? ['browser-dom'] : [] };
  const report = { exercises: [{ exerciseId: exercise.id, passed: true, tests: ['reference-run','reference-submit','starter-rejected','incorrect-rejected'].map(name => ({ name, passed: true })) }],
    examples: dom ? [{ exerciseId: exercise.id, passed: true }] : [],
    runtime: [...names, ...(modules ? moduleNames : []), ...(dom ? ['dom-cross-origin-and-fixture-isolation','dom-limits-disclosed'] : [])].map(name => ({ name, passed: true })) };
  return { exercise, report };
}
test('complete browser, DOM and module qualification records pass', () => {
  for (const options of [{}, { dom: false }, { dom: false, modules: true }]) {
    const { exercise, report } = fixture(options);
    assert.equal(qualificationPassed(report, [exercise]), true);
  }
});
test('an absent or wrong DOM example cannot turn every-present-record success into PASS', () => {
  for (const examples of [[], [{ exerciseId: 'other', passed: true }], [{ exerciseId: 'selected', passed: false }], [{ exerciseId: 'selected', passed: true, error: 'HTTP 404' }]]) {
    const { exercise, report } = fixture(); report.examples = examples;
    assert.equal(qualificationPassed(report, [exercise]), false);
  }
});
test('duplicate exercise and example identities cannot cover a missing selection', () => {
  const { exercise, report } = fixture();
  report.exercises.push(structuredClone(report.exercises[0]));
  report.examples.push(structuredClone(report.examples[0]));
  assert.equal(qualificationPassed(report, [exercise, { ...exercise, id: 'missing' }]), false);
});
test('runtime and exercise test omissions remain failures even when counts are replaced', () => {
  const { exercise, report } = fixture({ dom: false, modules: true });
  report.runtime.at(-1).name = report.runtime[0].name;
  assert.equal(qualificationPassed(report, [exercise]), false);
  const second = fixture(); second.report.exercises[0].tests[3].name = 'reference-run';
  assert.equal(qualificationPassed(second.report, [second.exercise]), false);
});
test('record errors and cancellation cannot pass after successful earlier checks', () => {
  const { exercise, report } = fixture();
  assert.equal(qualificationPassed(report, [exercise], true), false);
  report.exercises[0].error = 'Example failed';
  assert.equal(qualificationPassed(report, [exercise]), false);
});
