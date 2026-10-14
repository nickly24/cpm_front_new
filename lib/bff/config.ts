// Production uses the website origin. The server forwards /bff through SSH.
// Ignore a stale public backend URL left in the hosting build environment.
export const BFF_BASE_URL = process.env.NODE_ENV === "production"
  ? "/bff"
  : (process.env.NEXT_PUBLIC_CPM_BFF_BASE_URL || "/bff").replace(/\/+$/, "");
