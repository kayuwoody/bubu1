/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Never cache transactional pages at the CDN layer
        source: '/(checkout|order/:path*|orders|vouchers)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
    ];
  },
};
module.exports = nextConfig;

