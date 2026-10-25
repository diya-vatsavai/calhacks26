import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Moss runs on-device inference (onnxruntime) — keep it out of the server bundle.
  serverExternalPackages: ["@inferedge/moss", "@huggingface/transformers", "onnxruntime-node", "sharp"],
  // Allow the second demo participant to open the app on 127.0.0.1 in another tab.
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.trycloudflare.com"],
};

export default nextConfig;
