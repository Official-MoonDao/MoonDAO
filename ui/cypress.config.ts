import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: 'https://app.moondao.org',
    supportFile: false
  }
});
