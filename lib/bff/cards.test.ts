import { beforeEach, describe, expect, it, vi } from "vitest";
const { domain, identity, examTrainingTree, storage } = vi.hoisted(() => ({ domain: vi.fn(), identity: { user: { account_id: 71, organization_id: 2, division_id: 1001, role: "student", id: 999 } }, examTrainingTree: vi.fn(), storage: new Map<string, string>() }));
vi.mock("./client", () => ({ domain, getIdentity: () => identity }));
vi.mock("./exams-student", () => ({ examTrainingTree }));
beforeEach(() => {
  vi.resetModules(); domain.mockReset(); storage.clear(); examTrainingTree.mockReset(); examTrainingTree.mockResolvedValue([]);
  identity.user.division_id = 1001; identity.user.organization_id = 2;
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
});
describe("Cards owner boundary", () => {
  it("merges manual, test and exam sections without losing a zero or owner rounding", async () => {
    domain.mockResolvedValue({ directions: [{ id: 4, name: "Общее направление", sections: [{ kind: "manual", refId: "5", name: "Карточки", stats: { total: 40, learned: 1, unlearned: 39, answer_changed: 0, progress_percent: 2 } }, { kind: "test", refId: "a".repeat(24), name: "Тест", stats: { total: 0, learned: 0, unlearned: 0, answer_changed: 0, progress_percent: 0 } }] }] });
    examTrainingTree.mockResolvedValue([{ id: 4, name: "Общее направление", sections: [{ kind: "exam", refId: "7", name: "Экзамен", stats: { total: 0, learned: 0 }, total_cards: 0, learned_cards: 0 }], total_cards: 0, learned_cards: 0, progress_percent: 0 }]);
    const { cardsTrainingTree, cardsPercent } = await import("./cards");
    const tree = await cardsTrainingTree(); expect(tree[0].sections.map(item => item.kind)).toEqual(["manual", "test", "exam"]); expect(tree[0].progress_percent).toBe(2); expect(tree[0].sections[1].total_cards).toBe(0); expect(cardsPercent(3, 40)).toBe(8);
    expect(domain.mock.calls[0][0]).toBe("/cards/tree");
  });
  it("filters and paginates the full merged catalog, including empty in-progress sections", async () => {
    const { cardsSectionsPage } = await import("./cards");
    const sections = Array.from({ length: 205 }, (_, index) => ({ kind: "manual" as const, refId: String(index + 1), name: `Раздел ${index}`, stats: { total: 0, learned: 0, unlearned: 0, answer_changed: 0 }, total_cards: 0, learned_cards: 0, progress_percent: 0 }));
    const page = cardsSectionsPage([{ id: 4, name: "Направление", sections, total_cards: 0, learned_cards: 0, progress_percent: 0 }], 4, { page: 35, limit: 6, kind: "manual", progress: "in_progress" });
    expect(page.pagination.total).toBe(205); expect(page.sections.map(item => item.refId)).toEqual(["205"]); expect(page.student_id).toBe(71);
  });
  it("keeps an uncertain UUID and original DTO across module reload; account/org scopes remain private", async () => {
    domain.mockRejectedValueOnce(Object.assign(new Error("lost reply"), { status: 0, code: "transport_error" })).mockResolvedValue({ id: 9, revision: 1 });
    const first = await import("./cards"); await expect(first.cardsCommand("/themes", "POST", { name: "Ручные", direction_id: 4 })).rejects.toMatchObject({ status: 0 });
    const key = new Headers(domain.mock.calls[0][1].headers).get("Idempotency-Key"); vi.resetModules(); const second = await import("./cards");
    expect(second.cardsPendingCommands()).toHaveLength(1);
    await expect(second.cardsCommand("/themes", "POST", { name: "Другие", direction_id: 4 })).rejects.toMatchObject({ code: "pending_command" });
    await second.cardsRetry(second.cardsPendingCommands()[0]); expect(new Headers(domain.mock.calls[1][1].headers).get("Idempotency-Key")).toBe(key); expect(second.cardsPendingCommands()).toEqual([]);
    identity.user.organization_id = 3; expect(second.cardsPendingCommands()).toEqual([]);
  });
  it("retains manual progress/settings scope across division switching and sends no profile/account IDs", async () => {
    domain.mockResolvedValue({ status: "learned", card_ref: "card:10" }); const { cardsStudyMark } = await import("./cards");
    await cardsStudyMark({ student_id: 999, section_kind: "manual", section_ref_id: "5", card_ref: "card:10", content_fingerprint: "fp" });
    expect(domain.mock.calls[0][0]).toBe("/cards/sections/manual/5/learned"); expect(JSON.parse(domain.mock.calls[0][1].body)).toEqual({ card_ref: "card:10", content_fingerprint: "fp" });
  });
  it("normalizes the all-cards sentinel and supplies the full owner settings DTO", async () => {
    domain.mockImplementation((_path: string, options?: RequestInit) => options?.method ? JSON.parse(String(options.body)) : { settings: { batch_size: 20, study_mode: "all", last_batch_index: 2 } });
    const { cardsStudySettings } = await import("./cards"); const result = await cardsStudySettings("manual", "5", { last_batch_index: -1 });
    expect(result.settings).toEqual({ batch_size: 20, study_mode: "all", last_batch_index: null }); expect(JSON.parse(domain.mock.calls[1][1].body)).toEqual(result.settings);
  });
  it("keeps the exact transform session after a lost commit and retries that session without another preview", async () => {
    let calls = 0;
    domain.mockImplementation((path: string) => { if (path === "/cards/transforms") return { session_id: "a".repeat(32), revision: 1 }; if (++calls === 1) throw Object.assign(new Error("lost commit"), { status: 503 }); return { draft_id: "b".repeat(24) }; });
    const first = await import("./cards"); await expect(first.cardsTransformDraft(5, [10, 11])).rejects.toThrow("lost commit");
    const pending = first.cardsPendingCommands(); expect(pending).toHaveLength(1); expect(pending[0].path).toBe(`/sessions/${"a".repeat(32)}/commit`);
    const key = new Headers(domain.mock.calls[1][1].headers).get("Idempotency-Key"); vi.resetModules(); const second = await import("./cards"); await expect(second.cardsTransformDraft(5, [10, 11])).resolves.toEqual({ draft_id: "b".repeat(24) });
    expect(domain.mock.calls.filter(call => call[0] === "/cards/transforms")).toHaveLength(1); expect(new Headers(domain.mock.calls[2][1].headers).get("Idempotency-Key")).toBe(key);
  });
  it("coalesces concurrent form/recovery retries into one request and one stage handoff", async () => {
    let release: (value: unknown) => void = () => {};
    domain.mockImplementation((path: string) => path === "/cards/transforms" ? new Promise(resolve => { release = resolve; }) : { draft_id: "b".repeat(24) });
    const { cardsTransformDraft, cardsPendingCommands, cardsRecover } = await import("./cards");
    const first = cardsTransformDraft(5, [10]), second = cardsRecover(cardsPendingCommands()[0]);
    release({ session_id: "a".repeat(32), revision: 1 }); await Promise.all([first, second]);
    expect(domain.mock.calls.map(call => call[0])).toEqual(["/cards/transforms", `/cards/sessions/${"a".repeat(32)}/commit`]); expect(cardsPendingCommands()).toEqual([]);
  });
  it.each([401, 403, 404])("preserves an earlier uncertain UUID through access failure %s and retries after access returns", async status => {
    domain.mockRejectedValueOnce(Object.assign(new Error("lost response"), { status: 0 })).mockRejectedValueOnce(Object.assign(new Error("access changed"), { status, code: "access_denied" })).mockResolvedValue({ card_id: 10, revision: 1 });
    const first = await import("./cards"); await expect(first.cardsCommand("/themes/5/cards", "POST", { question: "Вопрос", answer: "Ответ" })).rejects.toMatchObject({ status: 0 });
    const original = first.cardsPendingCommands()[0]; vi.resetModules(); const second = await import("./cards");
    await expect(second.cardsRetry(second.cardsPendingCommands()[0])).rejects.toMatchObject({ status, details: { command_uncertain: true } });
    expect(second.cardsPendingCommands()).toMatchObject([{ id: original.id, uncertain: true }]);
    await expect(second.cardsRetry(second.cardsPendingCommands()[0])).resolves.toEqual({ card_id: 10, revision: 1 });
    expect(domain.mock.calls.map(call => new Headers(call[1].headers).get("Idempotency-Key"))).toEqual([original.id, original.id, original.id]); expect(second.cardsPendingCommands()).toEqual([]);
  });
  it("refuses a transform recovery in another division and discards confirmed CAS failures", async () => {
    domain.mockRejectedValue(Object.assign(new Error("lost"), { status: 503 })); const { cardsTransformDraft, cardsPendingCommands, cardsRetry } = await import("./cards");
    await expect(cardsTransformDraft(5, [10])).rejects.toThrow(); const pending = cardsPendingCommands()[0]; identity.user.division_id = 1002; await expect(cardsRetry(pending)).rejects.toMatchObject({ status: 409 });
    identity.user.division_id = 1001; domain.mockRejectedValue(Object.assign(new Error("CAS"), { status: 409, code: "conflict" })); await expect(cardsRetry(pending)).rejects.toMatchObject({ status: 409 }); expect(cardsPendingCommands()).toEqual([]);
  });
});

describe("Cards catalog failure is not an empty success", () => {
 it.each([403,503])("propagates owner status %s", async status => {
  domain.mockRejectedValue(Object.assign(new Error("dependency_unavailable"),{status,code:"dependency_unavailable"}));
  const {cardsTrainingTree}=await import("./cards");
  await expect(cardsTrainingTree()).rejects.toMatchObject({status,code:"dependency_unavailable"});
 });
});

describe("server-paginated student Cards adapter",()=>{
 it("loads directions and one server page without invoking the full tree or exams prefetch",async()=>{
  domain.mockResolvedValueOnce({directions:[{id:4,name:"Право"}]}).mockResolvedValueOnce({direction_id:4,sections:[{kind:"manual",refId:"5",name:"Ручная тема",stats:{total:1,learned:1,answer_changed:0,unlearned:0,progress_percent:100}}],pagination:{page:2,limit:12,total:25,pages:3,has_next:true,has_prev:true}});
  const {cardsCatalogDirections,cardsCatalogPage}=await import("./cards");const controller=new AbortController();
  const directions=await cardsCatalogDirections(controller.signal);expect(directions[0].sections).toEqual([]);
  const page=await cardsCatalogPage(4,{page:2,limit:12,search:"Право",kind:"manual"},controller.signal);
  expect(page.pagination.page).toBe(2);expect(page.sections[0].progress_percent).toBe(100);
  expect(domain.mock.calls[0][0]).toBe("/cards/catalog");expect(domain.mock.calls[1][0]).toBe("/cards/directions/4/sections?page=2&limit=12&search=%D0%9F%D1%80%D0%B0%D0%B2%D0%BE&kind=manual");
  expect(examTrainingTree).not.toHaveBeenCalled();expect(domain.mock.calls[1][1].signal).toBe(controller.signal);
 });
});
