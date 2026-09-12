import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderScannerPage, scannerPageSize } from "./page-render";
import type { ScannerPage } from "./project-store";

const page: ScannerPage = { id: "page", image: new Blob(["image"]), rotation: 90, mode: "gray", brightness: 0, contrast: 0 };

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("scanner page orientation", () => {
  it("keeps the complete image and swaps dimensions for quarter turns", () => {
    expect(scannerPageSize(1200, 1800, 0)).toEqual({ width: 1200, height: 1800 });
    expect(scannerPageSize(1200, 1800, 90)).toEqual({ width: 1800, height: 1200 });
    expect(scannerPageSize(1200, 1800, 180)).toEqual({ width: 1200, height: 1800 });
    expect(scannerPageSize(1200, 1800, 270, 600)).toEqual({ width: 600, height: 400 });
  });

  it("uses the same orientation and pixel treatment for preview and export", async () => {
    const bitmap = { width: 1200, height: 1800, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const contexts: Array<{ rotate: ReturnType<typeof vi.fn>; drawImage: ReturnType<typeof vi.fn>; pixels: Uint8ClampedArray; putImageData: ReturnType<typeof vi.fn> }> = [];
    vi.stubGlobal("document", { createElement: () => {
      const pixels = new Uint8ClampedArray([180, 80, 20, 255]);
      const context = { fillStyle: "", fillRect: vi.fn(), translate: vi.fn(), rotate: vi.fn(), drawImage: vi.fn(), getImageData: () => ({ data: pixels }), putImageData: vi.fn(), pixels };
      contexts.push(context);
      return { width: 0, height: 0, getContext: () => context };
    } });
    const preview = await renderScannerPage(page, { maxSide: 600 });
    const exported = await renderScannerPage(page);
    expect([preview.width, preview.height]).toEqual([600, 400]);
    expect([exported.width, exported.height]).toEqual([1800, 1200]);
    expect(contexts[0].pixels).toEqual(contexts[1].pixels);
    expect(contexts[0].pixels[0]).toBe(contexts[0].pixels[1]);
    for (const context of contexts) {
      expect(context.rotate).toHaveBeenCalledExactlyOnceWith(Math.PI / 2);
      expect(context.drawImage).toHaveBeenCalledTimes(1);
      expect(context.putImageData).toHaveBeenCalledTimes(1);
    }
    expect(bitmap.close).toHaveBeenCalledTimes(2);
  });

  it("supplies the crop editor with rotated source pixels without baking filters", async () => {
    const bitmap = { width: 100, height: 200, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const context = { fillRect: vi.fn(), translate: vi.fn(), rotate: vi.fn(), drawImage: vi.fn(), getImageData: vi.fn() };
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
    const rendered = await renderScannerPage(page, { filters: false });
    expect([rendered.width, rendered.height]).toEqual([200, 100]);
    expect(context.getImageData).not.toHaveBeenCalled();
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});
