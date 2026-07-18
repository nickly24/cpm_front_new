import { openDB } from "idb";

export interface ScannerPage { id:string; image:Blob; rotation:number; mode:"auto"|"color"|"gray"|"bw"; brightness:number; contrast:number }
export interface ScannerProject { homeworkId:number; pages:ScannerPage[]; updatedAt:number }
const db=()=>openDB("cpm-homework-scanner",1,{upgrade(database){database.createObjectStore("projects",{keyPath:"homeworkId"})}});
export async function getScannerProject(homeworkId:number){return (await db()).get("projects",homeworkId) as Promise<ScannerProject|undefined>}
export async function saveScannerProject(project:ScannerProject){try{await (await db()).put("projects",project)}catch(error){if(error instanceof DOMException&&error.name==="QuotaExceededError")throw new Error("Недостаточно места. Существующие страницы сохранены, добавление новых остановлено.");throw error}}
export async function deleteScannerProject(homeworkId:number){await (await db()).delete("projects",homeworkId)}
export async function clearScannerProjects(){await (await db()).clear("projects")}
