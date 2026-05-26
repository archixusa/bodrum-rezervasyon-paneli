/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    // Tree-shake heavy barrel-export packages — cuts client bundle drastically
    optimizePackageImports: [
      "lucide-react",
      "clsx",
      "date-fns",
      "@supabase/supabase-js",
      "@supabase/ssr",
    ],
  },
  // Lighter logging in production
  logging: {
    fetches: { fullUrl: false },
  },
};

export default nextConfig;
