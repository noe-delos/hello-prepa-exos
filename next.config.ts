/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdfkit", "docx", "pdf-parse", "pdf-to-img"],
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

module.exports = nextConfig;
