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

const clamp=(value:number)=>Math.max(0,Math.min(255,Math.round(value)));

export function applyScannerFilterToPixels(
  pixels:Uint8ClampedArray,
  mode:ScannerFilterMode,
  brightness:number,
  contrast:number,
){
  const brightnessOffset=brightness*2.2;
  const contrastValue=Math.max(-200,Math.min(200,contrast*2));
  const contrastFactor=(259*(contrastValue+255))/(255*(259-contrastValue));

  for(let index=0;index<pixels.length;index+=4){
    let red=clamp(contrastFactor*(pixels[index]-128)+128+brightnessOffset);
    let green=clamp(contrastFactor*(pixels[index+1]-128)+128+brightnessOffset);
    let blue=clamp(contrastFactor*(pixels[index+2]-128)+128+brightnessOffset);

    if(mode==="color"){
      const light=.299*red+.587*green+.114*blue;
      red=clamp(light+(red-light)*1.2);
      green=clamp(light+(green-light)*1.2);
      blue=clamp(light+(blue-light)*1.2);
    }else if(mode==="gray"){
      const gray=clamp(.299*red+.587*green+.114*blue);
      red=gray;green=gray;blue=gray;
    }else if(mode==="bw"){
      const gray=.299*red+.587*green+.114*blue;
      const documentValue=gray>=168
        ?255
        :clamp(Math.pow(gray/168,1.35)*118);
      red=documentValue;green=documentValue;blue=documentValue;
    }

    pixels[index]=red;
    pixels[index+1]=green;
    pixels[index+2]=blue;
  }
  return pixels;
}

export function applyScannerFilterToCanvas(
  canvas:HTMLCanvasElement,
  mode:ScannerFilterMode,
  brightness:number,
  contrast:number,
){
  if(mode==="auto"&&brightness===0&&contrast===0)return canvas;
  const context=canvas.getContext("2d",{willReadFrequently:true});
  if(!context)return canvas;
  const image=context.getImageData(0,0,canvas.width,canvas.height);
  applyScannerFilterToPixels(image.data,mode,brightness,contrast);
  context.putImageData(image,0,0);
  return canvas;
}
