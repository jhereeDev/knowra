import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Dev convenience: load packages/db/.env into process.env so we don't
// have to duplicate values across each app's own .env. dotenv does NOT
// override existing values, so anything Vercel already injected wins —
// this is a no-op in production. We always run this (not gated on
// DATABASE_URL being unset) so vars added to the .env after the first
// run — like CF_IMAGES_* — get picked up.
{
  const here = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(here, '../../packages/db/.env') });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@knowra/shared', '@knowra/db'],
  typedRoutes: true,
};

export default nextConfig;
