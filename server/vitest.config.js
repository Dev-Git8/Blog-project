import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 20000,
    hookTimeout: 60000,
    setupFiles: ['tests/setup.js'],
    env: { NODE_ENV: 'test' },
  },
})
