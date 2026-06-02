import type { NextConfig } from "next";

// [SECURITY M4] Content-Security-Policy
// - 'unsafe-inline' tolere pour Tailwind + Next runtime
// - 'unsafe-eval' UNIQUEMENT en dev (React dev mode utilise eval pour les
//   stacktraces / fast refresh). En prod React n'utilise jamais eval.
// - connect-src inclut ws:/wss: en dev (Next HMR / Turbopack)
const IS_DEV = process.env.NODE_ENV !== "production";

const CSP = [
  "default-src 'self'",
  // En dev : https: wildcard pour eviter d'avoir a maintenir une whitelist exhaustive
  // (picsum, sources experimentales, etc.). En prod : whitelist serree.
  `img-src 'self' data: blob:${IS_DEV ? " https:" : " https://*.public.blob.vercel-storage.com https://cdn.shopify.com https://images.unsplash.com https://plus.unsplash.com https://lh3.googleusercontent.com https://picsum.photos https://fastly.picsum.photos https://*.stripe.com"}`,
  `script-src 'self' 'unsafe-inline'${IS_DEV ? " 'unsafe-eval'" : ""} https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `connect-src 'self' https://api.stripe.com https://*.stripe.com${IS_DEV ? " ws: wss:" : ""}`,
  "frame-src https://checkout.stripe.com https://billing.stripe.com https://js.stripe.com",
  "media-src 'self' blob: https://*.public.blob.vercel-storage.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: CSP,
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Next.js 16 bloque par défaut les requêtes cross-origin vers les ressources de dev
  // (chunks JS, HMR, etc.). Cette config autorise l'iPhone à charger les bundles via
  // l'IP locale du PC — indispensable pour tester PWA / mobile sur réseau local.
  // À retirer en prod (Vercel gère ça automatiquement).
  allowedDevOrigins: ["192.168.1.42", "localhost"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return [
      // /v3 sert le nouveau site v3 (URL publique partageable)
      { source: "/v3", destination: "/preview/vertxia-v3" },
    ];
  },
};

export default nextConfig;
