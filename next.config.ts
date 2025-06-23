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
};

module.exports = nextConfig;
