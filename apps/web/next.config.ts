import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // image Docker minimale
  transpilePackages: ['@eact/shared'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Mode léger (npm run dev:web) : /api/* est relayé vers l'API sur le poste, comme nginx le fait en conteneurs.
  // Même origine pour le navigateur → cookies httpOnly SameSite sans CORS.
  async rewrites() {
    return [{ source: '/api/:chemin*', destination: `${process.env.API_INTERNAL_URL ?? 'http://localhost:3000'}/:chemin*` }];
  },
};

export default nextConfig;
