/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Inlined at build time for both server and browser code; Vercel sets VERCEL=1 during builds.
    CALLSCRIBE_ON_VERCEL: process.env.VERCEL ? '1' : '',
  },
}
export default nextConfig
