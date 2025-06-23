/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdfkit", "docx", "pdf-parse", "pdf-to-img"],
  experimental: {
    serverComponentsExternalPackages: [
      "pdfkit",
      "docx",
      "pdf-parse",
      "pdf-to-img",
    ],
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  webpack: (config, { nextRuntime }) => {
    // Disable canvas only for Node.js runtime (server-side)
    if (nextRuntime === "nodejs") {
      config.resolve.alias.canvas = false;
    }
    return config;
  },
};

module.exports = nextConfig;
