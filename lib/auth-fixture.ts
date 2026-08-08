import { test as base, expect } from '@playwright/test';

// No-op fixture: server boots to chat shell via HERMES_WEBUI_SKIP_ONBOARDING=1
// so no auth cookie is needed.
export const test = base;
export { expect };