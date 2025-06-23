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
      config.externals.push({
        "pdfjs-dist/build/pdf.worker.js": "pdfjs-dist/build/pdf.worker.js",
      });
    }
    return config;
  },
};

module.exports = nextConfig;
