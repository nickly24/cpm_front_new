// NEXT_PUBLIC values are embedded by Next.js at build time. Keep /bff for local rewrites.
export const BFF_BASE_URL = (process.env.NEXT_PUBLIC_CPM_BFF_BASE_URL || "/bff").replace(/\/+$/, "");
