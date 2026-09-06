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
    Keep dev and build artifacts apart. `next build` wipes and rewrites its
    dist dir; sharing one with a running `next dev` corrupts the dev server's
    chunk cache and every lazy-loaded scene 500s until you clear it.
  */
  distDir: process.env.NODE_ENV === "production" ? ".next-build" : ".next",
};

export default nextConfig;
