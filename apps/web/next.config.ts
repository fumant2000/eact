import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // image Docker minimale
  transpilePackages: ['@eact/shared'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
