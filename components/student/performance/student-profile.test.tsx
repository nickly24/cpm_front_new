// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StudentPerformanceSection } from "./student-performance-section";
import { StudentProfileQr } from "./student-profile-qr";
import { studentNavigation } from "@/lib/navigation/student";
import type { User } from "@/lib/auth/types";

const state = vi.hoisted(() => ({ user: null as User | null, qr: vi.fn(), fetch: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("qrcode", () => ({ default: { toDataURL: state.qr } }));
vi.mock("./student-rating-panel", () => ({ StudentRatingPanel: () => { throw new Error("Confidential rating must not mount"); } }));
vi.mock("./student-external-results", () => ({ StudentExternalResults: () => { throw new Error("External results must not mount"); } }));
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: 7, account_id: 700, role: "student", full_name: "Демо ученик", group_id: 23 };
  state.qr.mockResolvedValue("data:image/png;base64,local-qr");
  vi.stubGlobal("fetch", state.fetch);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows only the personal profile and encodes plain student ID without requesting confidential data", async () => {
  render(<StudentPerformanceSection />);
  expect(screen.getByRole("heading", { name: "Демо ученик" })).toBeTruthy();
  expect(screen.getByText("Демо ученик")).toBeTruthy();
  expect(screen.getByText("Группа 23")).toBeTruthy();
  expect(await screen.findByRole("img", { name: "QR-код ученика" })).toBeTruthy();
  expect(state.qr).toHaveBeenCalledWith("7", expect.objectContaining({ margin: 4 }));
  expect(state.fetch).not.toHaveBeenCalled();
  expect(screen.queryByText(/рейтинг|внешние|подразделение|день занятия/i)).toBeNull();
  expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  expect(studentNavigation.groups[0].items.some(item => item.id === "performance")).toBe(false);
  expect(screen.getByText("ID ученика")).toBeTruthy();
  expect(screen.getByText("7")).toBeTruthy();
});

it("removes the previous student's QR immediately when identity changes", async () => {
  const page = render(<StudentPerformanceSection />);
  await screen.findByRole("img", { name: "QR-код ученика" });
  let resolve!: (value: string) => void;
  state.qr.mockImplementationOnce(() => new Promise<string>(done => { resolve = done; }));
  state.user = { ...state.user!, id: 8, account_id: 800 };
  page.rerender(<StudentPerformanceSection />);
  expect(screen.queryByRole("img")).toBeNull();
  await act(async () => { resolve("data:image/png;base64,new-qr"); });
  expect(await screen.findByRole("img")).toHaveProperty("src", "data:image/png;base64,new-qr");
  expect(state.qr.mock.calls.map(call => call[0])).toEqual(["7", "8"]);
});

it.each([undefined, 0, -1, 1.5, Number.NaN])("does not fabricate QR identity for invalid ID %s", studentId => {
  render(<StudentProfileQr studentId={studentId} />);
  expect(screen.getByRole("status").textContent).toBe("QR-код недоступен");
  expect(state.qr).not.toHaveBeenCalled();
});

it("handles QR generation failure without showing stale content", async () => {
  state.qr.mockRejectedValueOnce(new Error("unavailable"));
  render(<StudentProfileQr studentId={7} />);
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Не удалось создать QR-код"));
  expect(screen.queryByRole("img")).toBeNull();
});
