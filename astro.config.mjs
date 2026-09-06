import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://wardogspilot.com",
  output: "static",
  build: { format: "directory" },
});
