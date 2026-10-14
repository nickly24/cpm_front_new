// NEXT_PUBLIC values are embedded at build time. Only development defaults to a local rewrite.
const defaultBaseURL = process.env.NODE_ENV === "production" ? "https://back1.cpm-lms.ru/bff" : "/bff";
export const BFF_BASE_URL = (process.env.NEXT_PUBLIC_CPM_BFF_BASE_URL || defaultBaseURL).replace(/\/+$/, "");
