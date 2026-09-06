import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A stray package-lock.json in the home directory makes Next guess the wrong
  // workspace root. Pin it to this project.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  // Static HTML export — no Node server. Deploys to Cloudflare Pages from `out/`.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
