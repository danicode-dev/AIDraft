import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth", "pdfjs-dist"],
  // Ensure Turbopack resolves dependencies from this app, not the workspace root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
