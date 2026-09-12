import { applyScannerFilterToCanvas } from "./image-filters";
import type { ScannerPage } from "./project-store";

export function scannerPageSize(width: number, height: number, rotation: number, maxSide = Infinity) {
  const sideways = rotation % 180 !== 0;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round((sideways ? height : width) * scale)),
    height: Math.max(1, Math.round((sideways ? width : height) * scale)),
  };
}

/** Shared by previews, editors and export; rotation is applied before filters. */
export async function renderScannerPage(page: ScannerPage, options: { maxSide?: number; filters?: boolean } = {}) {
  const bitmap = await createImageBitmap(page.image);
  try {
    const canvas = document.createElement("canvas");
    const size = scannerPageSize(bitmap.width, bitmap.height, page.rotation, options.maxSide);
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d")!;
    const sideways = page.rotation % 180 !== 0;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(page.rotation * Math.PI / 180);
    const width = sideways ? canvas.height : canvas.width;
    const height = sideways ? canvas.width : canvas.height;
    context.drawImage(bitmap, -width / 2, -height / 2, width, height);
    if (options.filters !== false) {
      applyScannerFilterToCanvas(canvas, page.mode, page.brightness, page.contrast);
    }
    return canvas;
  } finally {
    bitmap.close();
  }
}

export function scannerCanvasBlob(canvas: HTMLCanvasElement, quality = .92) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Не удалось сохранить изображение")), "image/jpeg", quality);
  });
}
