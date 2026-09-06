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

  /*
    distDir is deliberately left at the default. Pointing it elsewhere makes
    `output: "export"` write the site into that directory instead of `out/`,
    which silently strands the deploy target. If a build and a dev server
    fight over `.next`, stop the dev server rather than splitting the dirs.
  */
};

export default nextConfig;
