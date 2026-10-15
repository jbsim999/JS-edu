export function createCounter(initial = 0) {
  // Deliberate defect: factory calls overwrite a shared global binding.
  globalThis.__sharedCounter = initial;
  return () => ++globalThis.__sharedCounter;
}
