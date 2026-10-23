// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  domain: vi.fn(),
  draft: {
    id: "a".repeat(32),
    revision: 1,
    state: "preview",
    division_id: 9102,
    expires_at: "2026-10-24T14:00:00Z",
    rows: [
      {
        row: 2,
        full_name: "QA Ученик",
        profile_id: "",
        school: "",
        class: "0",
        login: "student_qa_one",
        password: "synthetic-preview-only",
      },
    ],
    issues: [{ row: 2, field: "class", reason: "invalid_class" }],
    batch_size: 25,
    batch_count: 1,
    batches: [],
  },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      account_id: 1,
      organization_id: 9101,
      division_id: 9101,
      organization_admin: true,
      organizations: [
        {
          id: 9101,
          name: "QA",
          divisions: [
            { id: 9101, name: "QA Основное" },
            { id: 9102, name: "QA Резерв" },
          ],
        },
      ],
    },
  }),
}));
vi.mock("@/lib/bff/client", () => ({ domain: state.domain }));
vi.mock("@/lib/bff/use-context-guard", () => ({ useContextGuard: vi.fn() }));
import { StudentImport } from "./student-import";
const clone = () => JSON.parse(JSON.stringify(state.draft));
beforeEach(() => {
  state.domain.mockReset();
  state.draft.revision = 1;
  state.draft.state = "preview";
  state.draft.batch_count = 1;
  state.draft.issues = [{ row: 2, field: "class", reason: "invalid_class" }];
  state.domain.mockImplementation(
    async (path: string, options?: RequestInit) => {
      if (path.endsWith("/student-imports"))
        return [
          {
            id: state.draft.id,
            state: state.draft.state,
            created_at: "2026-10-23T14:00:00Z",
          },
        ];
      if (path.endsWith("/review")) return clone();
      if (options?.method === "PUT") {
        state.draft.revision++;
        state.draft.issues = [];
        state.draft.rows[0].class = "";
        return clone();
      }
      throw new Error("unexpected test request");
    },
  );
});
afterEach(cleanup);
async function open() {
  render(<StudentImport />);
  fireEvent.change(
    screen.getByRole("combobox", { name: "Подразделение назначения" }),
    { target: { value: "9102" } },
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /Предпросмотр|Подтверждён/ }),
  );
  await screen.findByLabelText("Класс, строка 2");
}
it("requires explicit destination and keeps invalid preview side-effect-free", async () => {
  render(<StudentImport />);
  expect(
    (
      screen.getByRole("button", {
        name: "Разобрать Excel",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(state.domain).not.toHaveBeenCalled();
  fireEvent.change(
    screen.getByRole("combobox", { name: "Подразделение назначения" }),
    { target: { value: "9102" } },
  );
  fireEvent.click(await screen.findByRole("button", { name: /Предпросмотр/ }));
  await screen.findByText("Отказ проверки");
  expect(
    (
      screen.getByRole("button", {
        name: "Подтвердить создание",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(
    state.domain.mock.calls.some(
      ([p]) => p.includes("/commit") || p.includes("/batches/"),
    ),
  ).toBe(false);
});
it("keeps confirmation disabled until edits are accepted and excludes preview passwords from edit requests", async () => {
  await open();
  fireEvent.change(screen.getByLabelText("Класс, строка 2"), {
    target: { value: "" },
  });
  expect(
    (
      screen.getByRole("button", {
        name: "Подтвердить создание",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Проверить изменения" }));
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Подтвердить создание",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  const edit = state.domain.mock.calls.find(([, o]) => o?.method === "PUT");
  expect(JSON.parse(edit![1].body as string)).toMatchObject({
    expected_revision: 1,
    rows: [{ class: "" }],
  });
  expect(String(edit![1].body)).not.toContain("synthetic-preview-only");
  expect(state.domain.mock.calls.some(([p]) => p.includes("/commit"))).toBe(
    false,
  );
});
it("drops a late list response from the previous destination", async () => {
  let release: (v: unknown) => void = () => {};
  state.domain.mockImplementation((path: string) =>
    path.includes("/9101/")
      ? new Promise((r) => {
          release = r;
        })
      : Promise.resolve([]),
  );
  render(<StudentImport />);
  fireEvent.change(
    screen.getByRole("combobox", { name: "Подразделение назначения" }),
    { target: { value: "9101" } },
  );
  await waitFor(() => expect(state.domain).toHaveBeenCalled());
  fireEvent.change(
    screen.getByRole("combobox", { name: "Подразделение назначения" }),
    { target: { value: "9102" } },
  );
  release([
    {
      id: state.draft.id,
      state: "preview",
      created_at: "2026-10-23T14:00:00Z",
    },
  ]);
  await waitFor(() =>
    expect(
      (
        screen.getByRole("combobox", {
          name: "Подразделение назначения",
        }) as HTMLSelectElement
      ).value,
    ).toBe("9102"),
  );
  expect(screen.queryByRole("button", { name: /Предпросмотр/ })).toBeNull();
});
it("stops subsequent batches on UNKNOWN and reuses the exact confirmation intent", async () => {
  state.draft.state = "frozen";
  state.draft.issues = [];
  state.draft.batch_count = 2;
  const original = state.domain.getMockImplementation()!;
  state.domain.mockImplementation(
    async (path: string, options?: RequestInit) => {
      if (path.includes("/batches/0"))
        return { id: "b".repeat(32), revision: 1 };
      if (path.includes("/commit") || path.includes("/jobs/"))
        return { id: "c".repeat(32), status: "outcome_unknown" };
      return original(path, options);
    },
  );
  await open();
  fireEvent.click(
    screen.getByRole("button", { name: "Продолжить оставшиеся порции" }),
  );
  await screen.findByText(
    "Следующие порции не запущены. Проверьте исход текущей порции.",
  );
  expect(state.domain.mock.calls.some(([p]) => p.includes("/batches/1"))).toBe(
    false,
  );
  const first = state.domain.mock.calls.find(([p]) => p.endsWith("/commit"))!;
  fireEvent.click(
    screen.getByRole("button", { name: "Продолжить оставшиеся порции" }),
  );
  await waitFor(() =>
    expect(
      state.domain.mock.calls.filter(([p]) => p.endsWith("/commit")),
    ).toHaveLength(2),
  );
  const last = state.domain.mock.calls.filter(([p]) =>
    p.endsWith("/commit"),
  )[1];
  expect(last[1].headers).toEqual(first[1].headers);
  expect(last[1].body).toEqual(first[1].body);
});
