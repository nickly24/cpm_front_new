export interface PagePoint { x:number; y:number }
type OpenCv=typeof globalThis.cv;
let cvPromise:Promise<OpenCv>|null=null;
function getCv(){
 if(cvPromise)return cvPromise;
 cvPromise=import("@techstark/opencv-js").then(async module=>{
  const ready=(module as unknown as {default:OpenCv|Promise<OpenCv>}).default;
  const cv=await ready;
  if(typeof cv.getBuildInformation!=="function")throw new Error("opencv_unavailable");
  return cv;
 });
 return cvPromise;
}
const distance=(a:PagePoint,b:PagePoint)=>Math.hypot(a.x-b.x,a.y-b.y);
function order(points:PagePoint[]){const bySum=[...points].sort((a,b)=>a.x+a.y-(b.x+b.y)),byDiff=[...points].sort((a,b)=>a.y-a.x-(b.y-b.x));return[bySum[0],byDiff[0],bySum[3],byDiff[3]] as [PagePoint,PagePoint,PagePoint,PagePoint]}

export async function detectPageCorners(source:HTMLCanvasElement):Promise<PagePoint[]|null>{
 const cv=await getCv();
 const input=cv.imread(source),gray=new cv.Mat(),blurred=new cv.Mat(),edges=new cv.Mat(),contours=new cv.MatVector(),hierarchy=new cv.Mat();
 try{
  cv.cvtColor(input,gray,cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray,blurred,new cv.Size(7,7),0);
  cv.Canny(blurred,edges,45,150);
  cv.findContours(edges,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
  let best:PagePoint[]|null=null,bestArea=source.width*source.height*.1;
  for(let index=0;index<contours.size();index++){
   const contour=contours.get(index),perimeter=cv.arcLength(contour,true);
   for(const factor of [.015,.02,.025,.03,.04]){
    const approx=new cv.Mat();
    cv.approxPolyDP(contour,approx,factor*perimeter,true);
    const area=Math.abs(cv.contourArea(approx));
    if(approx.rows===4&&area>bestArea&&cv.isContourConvex(approx)){
     bestArea=area;
     best=[];
     for(let row=0;row<4;row++)best.push({x:approx.data32S[row*2],y:approx.data32S[row*2+1]});
    }
    approx.delete();
   }
   contour.delete();
  }
  return best?order(best):null;
 }finally{input.delete();gray.delete();blurred.delete();edges.delete();contours.delete();hierarchy.delete()}
}

export async function perspectiveCrop(source:HTMLCanvasElement,points:PagePoint[]):Promise<HTMLCanvasElement>{
 const cv=await getCv();const[topLeft,topRight,bottomRight,bottomLeft]=order(points),width=Math.max(distance(topLeft,topRight),distance(bottomLeft,bottomRight)),height=Math.max(distance(topLeft,bottomLeft),distance(topRight,bottomRight)),input=cv.imread(source),from=cv.matFromArray(4,1,cv.CV_32FC2,[topLeft.x,topLeft.y,topRight.x,topRight.y,bottomRight.x,bottomRight.y,bottomLeft.x,bottomLeft.y]),to=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,width,0,width,height,0,height]),matrix=cv.getPerspectiveTransform(from,to),output=new cv.Mat();
 try{cv.warpPerspective(input,output,matrix,new cv.Size(Math.round(width),Math.round(height)),cv.INTER_LINEAR,cv.BORDER_REPLICATE,new cv.Scalar());const canvas=document.createElement("canvas");canvas.width=output.cols;canvas.height=output.rows;cv.imshow(canvas,output);return canvas}finally{input.delete();from.delete();to.delete();matrix.delete();output.delete()}
}

export async function autoCropCanvas(source:HTMLCanvasElement){const points=await detectPageCorners(source);return points?perspectiveCrop(source,points):source}
