import type { NextConfig } from "next";

// The Base44 preview serves the app from a per-sandbox host on port 3000. Next gates dev assets
// and HMR by origin, and a bare "*" wildcard does not cover that host, so the preview origin is
// appended while the sandbox flag is on. With the flag unset this is exactly the list above.
const previewOrigin =
  process.env.BASE44_PREVIEW_MODE === "1" && process.env.BASE44_PUBLIC_HOST_SUFFIX
    ? [`3000-${process.env.BASE44_PUBLIC_HOST_SUFFIX}`]
    : [];

const nextConfig: NextConfig = {
  // Moss runs on-device inference (onnxruntime) — keep it out of the server bundle.
  serverExternalPackages: ["@inferedge/moss", "@huggingface/transformers", "onnxruntime-node", "sharp"],
  // Allow the second demo participant to open the app on 127.0.0.1 in another tab.
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.trycloudflare.com", ...previewOrigin],
};

export default nextConfig;
