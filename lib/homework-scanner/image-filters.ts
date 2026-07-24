import type { ScannerPage } from "./project-store";

export type ScannerFilterMode = ScannerPage["mode"];

export const scannerFilterLabels: Record<ScannerFilterMode, string> = {
  auto: "Оригинал",
  color: "Цвет",
  gray: "Серый",
  bw: "Документ",
};

export function scannerCanvasFilter(
  mode: ScannerFilterMode,
  brightness: number,
  contrast: number,
) {
  const effects = [
    `brightness(${Math.max(40, 100 + brightness)}%)`,
    `contrast(${Math.max(40, 100 + contrast)}%)`,
  ];
  if (mode === "color") effects.push("saturate(118%)");
  if (mode === "gray") effects.push("grayscale(100%)");
  if (mode === "bw") effects.push("grayscale(100%)", "contrast(175%)");
  return effects.join(" ");
}

