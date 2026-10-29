/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// base './' para que el build funcione en GitHub Pages y en cualquier subcarpeta.
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    target: 'es2022'
  },
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'node'
  }
});
