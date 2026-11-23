import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 20000,
    env: {
      NODE_ENV: 'test',
      APP_NAME: 'SABI',
      JWT_ACCESS_SECRET: 'test-access',
      JWT_REFRESH_SECRET: 'test-refresh',
      ENCRYPTION_KEY: 'test-encryption',
      ALLOW_UNREVIEWED_TRANSLATIONS: 'true',
      LLM_PROVIDER: 'mock',
      SMS_PROVIDER: 'mock',
      // Tests never call Nace: triage falls back to its local rule set.
      NACE_API_KEY: '',
    },
  },
});
