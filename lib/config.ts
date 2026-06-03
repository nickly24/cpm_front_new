const DEFAULT_API_BASE_URL = "https://nickly24-cpm-back-c633.twc1.net";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");
