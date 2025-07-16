/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Ignore canvas in webpack bundling for serverless environments
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('canvas');
    }
    
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    
    return config;
  },
  // Enable output standalone for better Vercel deployment
  output: 'standalone',
};

module.exports = nextConfig;