import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The root .env is shared by the API and the web app.
  envDir: '../..',
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    restoreMocks: true,
  },
});
