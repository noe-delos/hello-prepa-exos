/* eslint-disable @typescript-eslint/no-explicit-any */
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "pdfkit",
    "docx",
    "pdf-parse",
    "pdf-to-img",
    "pdfjs-dist",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (isServer) {
      // Handle pdfjs-dist worker for serverless environment
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };

      // Ignore problematic modules in server builds
      config.externals.push({
        canvas: "canvas",
        "pdfjs-dist/build/pdf.worker.js": "pdfjs-dist/build/pdf.worker.js",
      });
    }
    return config;
  },
};

module.exports = nextConfig;
