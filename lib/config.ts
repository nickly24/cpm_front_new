const DEFAULT_API_BASE_URL = "https://nickly24-cpm-back-c633.twc1.net";
const DEFAULT_HOMEWORK_SERVICE_URL = "https://nickly24-cpm-homework-service-be3b.twc1.net";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

export const HOMEWORK_SERVICE_URL = (
  process.env.NEXT_PUBLIC_HOMEWORK_SERVICE_URL || DEFAULT_HOMEWORK_SERVICE_URL
).replace(/\/+$/, "");
