import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // image Docker minimale
  transpilePackages: ['@eact/shared'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // BF-18 : même limite que client_max_body_size dans nginx.
  experimental: { proxyClientMaxBodySize: '25mb' },
  // Mode léger : /api/* relayé vers l'API comme le fait nginx → même origine, cookies SameSite sans CORS.
  async rewrites() {
    return [{ source: '/api/:chemin*', destination: `${process.env.API_INTERNAL_URL ?? 'http://localhost:3000'}/:chemin*` }];
  },
};

export default nextConfig;
