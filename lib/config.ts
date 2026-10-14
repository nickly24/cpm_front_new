// Compatibility names for existing adapters. Production always uses the Go BFF.
export const BFF_DEV = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_CPM_BFF_ENABLED === "1" || process.env.NEXT_PUBLIC_CPM_BFF_DEV === "1";
export const BFF_EXTERNAL_TESTS_DEV = BFF_DEV && (
  process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_CPM_BFF_EXTERNAL_TESTS_ENABLED === "1" || process.env.NEXT_PUBLIC_CPM_BFF_EXTERNAL_TESTS_DEV === "1"
);
const DEFAULT_API_BASE_URL = "https://nickly24-cpm-back-c633.twc1.net";
const DEFAULT_HOMEWORK_SERVICE_URL = "https://nickly24-cpm-homework-service-be3b.twc1.net";

export const API_BASE_URL = (
  BFF_DEV ? "/bff/unconnected" : process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

export const HOMEWORK_SERVICE_URL = (
  BFF_DEV ? "/bff/homework" : process.env.NEXT_PUBLIC_HOMEWORK_SERVICE_URL || DEFAULT_HOMEWORK_SERVICE_URL
).replace(/\/+$/, "");
