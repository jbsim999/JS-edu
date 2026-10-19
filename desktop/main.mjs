import { app } from 'electron';
import { startDesktop } from './application.mjs';

// Explicitly selected portable/QA data directory; no test code, execution consent,
// reference answers or grading behavior is enabled by this filesystem option.
// Do not top-level-await whenReady: Electron emits ready after ESM evaluation.
void startDesktop({ userDataDirectory: process.env.JS_EDU_USER_DATA_DIR || undefined })
  // startDesktop awaits service cleanup before rejecting after service creation.
  // Preflight failures have no service to close, but still need an explicit quit:
  // setting Node's exitCode alone leaves Electron's application loop running.
  .catch(error => { console.error(error.message); app.exit(1); });
