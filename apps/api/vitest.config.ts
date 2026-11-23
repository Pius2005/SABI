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
      STT_PROVIDER: 'mock',
      TTS_PROVIDER: 'mock',
      LLM_PROVIDER: 'mock',
      SMS_PROVIDER: 'mock',
    },
  },
});
