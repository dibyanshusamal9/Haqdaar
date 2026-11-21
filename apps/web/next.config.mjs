/** @type {import('next').NextConfig} */
const nextConfig = {
  // Every call to the Haqdaar.ai API happens server-side (server components and
  // server actions in app/actions.ts), so the admin code never reaches the browser.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};
export default nextConfig;
