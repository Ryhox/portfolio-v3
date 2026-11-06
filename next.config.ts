import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // the styles come inside the page itself: no stylesheet to wait for before the first paint
  experimental: { inlineCss: true },
  // the scripts' source maps are published too (PageSpeed's Best Practices asks for them; they also make the
  // browser's error messages readable). Anyone can read the site's source in DevTools with them
  productionBrowserSourceMaps: true,
  async headers() {
    return [{ source: '/screens/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }];
  },
};

export default nextConfig;
