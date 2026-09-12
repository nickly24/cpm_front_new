import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearScannerProjects, deleteScannerProject, getScannerProject, saveScannerProject, type ScannerProject } from "./project-store";

const storage = vi.hoisted(() => ({
  projects: new Map<unknown, unknown>(),
  "account-projects": new Map<unknown, unknown>(),
}));
vi.mock("idb", () => ({ openDB: async () => ({
  get: async (name: keyof typeof storage, key: unknown) => storage[name].get(key),
  put: async (name: keyof typeof storage, value: ScannerProject, key?: unknown) => storage[name].set(key ?? value.homeworkId, value),
  delete: async (name: keyof typeof storage, key: unknown) => storage[name].delete(key),
  transaction: () => ({ objectStore: (name: keyof typeof storage) => ({ clear: async () => storage[name].clear() }), done: Promise.resolve() }),
}) }));

const project = (text: string): ScannerProject => ({ homeworkId: 42, updatedAt: 1, pages: [{ id: text, image: new Blob([text]), rotation: 0, mode: "auto", brightness: 0, contrast: 0 }] });
beforeEach(() => { storage.projects.clear(); storage["account-projects"].clear(); });

describe("scanner projects account isolation", () => {
  it("restores each account's own pages for the same homework", async () => {
    await saveScannerProject(project("first"), 1);
    await saveScannerProject(project("second"), 2);
    expect((await getScannerProject(42, 1))?.pages[0].id).toBe("first");
    expect((await getScannerProject(42, 2))?.pages[0].id).toBe("second");
    expect(await getScannerProject(42, 3)).toBeUndefined();
  });

  it("does not claim a legacy project whose account is unknown", async () => {
    await saveScannerProject(project("legacy"));
    expect((await getScannerProject(42))?.pages[0].id).toBe("legacy");
    expect(await getScannerProject(42, 1)).toBeUndefined();
  });

  it("removes only the submitted account's project and clears everything on logout", async () => {
    await saveScannerProject(project("legacy"));
    await saveScannerProject(project("first"), 1);
    await saveScannerProject(project("second"), 2);
    await deleteScannerProject(42, 1);
    expect(await getScannerProject(42, 1)).toBeUndefined();
    expect(await getScannerProject(42, 2)).toBeDefined();
    await clearScannerProjects();
    expect(await getScannerProject(42, 2)).toBeUndefined();
    expect(await getScannerProject(42)).toBeUndefined();
  });
});
