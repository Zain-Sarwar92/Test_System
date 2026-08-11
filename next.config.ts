import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Force Turbopack to use this project — ignore parent C:\Users\HP\package-lock.json
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
