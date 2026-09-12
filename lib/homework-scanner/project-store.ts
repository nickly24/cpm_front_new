import { openDB } from "idb";

export interface ScannerPage {
  id: string;
  image: Blob;
  rotation: number;
  mode: "auto" | "color" | "gray" | "bw";
  brightness: number;
  contrast: number;
}
export interface ScannerProject { homeworkId: number; pages: ScannerPage[]; updatedAt: number }
type AccountId = string | number;

const db = () => openDB("cpm-homework-scanner", 2, {
  upgrade(database) {
    if (!database.objectStoreNames.contains("projects")) {
      database.createObjectStore("projects", { keyPath: "homeworkId" });
    }
    if (!database.objectStoreNames.contains("account-projects")) {
      database.createObjectStore("account-projects");
    }
  },
});

export function scannerProjectKey(homeworkId: number, userId: AccountId) {
  return JSON.stringify([String(userId), homeworkId]);
}

export async function getScannerProject(homeworkId: number, userId?: AccountId) {
  const database = await db();
  // Legacy projects have no owner, so never restore them into a signed-in account.
  return (userId === undefined
    ? database.get("projects", homeworkId)
    : database.get("account-projects", scannerProjectKey(homeworkId, userId))) as Promise<ScannerProject | undefined>;
}

export async function saveScannerProject(project: ScannerProject, userId?: AccountId) {
  try {
    const database = await db();
    if (userId === undefined) await database.put("projects", project);
    else await database.put("account-projects", project, scannerProjectKey(project.homeworkId, userId));
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new Error("На устройстве недостаточно места. Последние изменения пока не сохранены. Подготовьте PDF перед закрытием.");
    }
    throw error;
  }
}

export async function deleteScannerProject(homeworkId: number, userId?: AccountId) {
  const database = await db();
  if (userId === undefined) await database.delete("projects", homeworkId);
  else await database.delete("account-projects", scannerProjectKey(homeworkId, userId));
}

export async function clearScannerProjects() {
  const database = await db();
  const transaction = database.transaction(["projects", "account-projects"], "readwrite");
  await Promise.all([transaction.objectStore("projects").clear(), transaction.objectStore("account-projects").clear()]);
  await transaction.done;
}
