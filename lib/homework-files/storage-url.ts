/** Accept only the configured storage endpoint returned by the authorised Homework API. */
export function assertHomeworkStorageURL(value: string): void {
  const production = process.env.NODE_ENV === "production";
  const configured = process.env.NEXT_PUBLIC_CPM_S3_ORIGINS || (production ? "https://s3.twcstorage.ru" : "http://127.0.0.1:19000");
  const allowed = configured.split(",").map(origin => origin.trim()).filter(Boolean);
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error("Недопустимый адрес хранилища"); }
  if (url.username || url.password || !allowed.includes(url.origin) ||
      (production ? url.protocol !== "https:" : !["http:", "https:"].includes(url.protocol))) {
    throw new Error("Недопустимый адрес хранилища");
  }
}
