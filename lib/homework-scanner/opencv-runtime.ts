import cv from "@techstark/opencv-js";

/** Keep the Promise-valued CommonJS export behind a normal ESM function.
 * Importing it directly with import() can expose Promise.then on the module namespace.
 */
export async function loadOpenCv() {
  return await (cv as unknown as Promise<typeof globalThis.cv>);
}
