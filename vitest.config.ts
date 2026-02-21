import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'tinyland-admin-user-repository',
    globals: true,
    environment: 'node',
  },
});
