import { beforeEach, describe, expect, it, vi } from "vitest";
const { domain, identity } = vi.hoisted(() => ({ domain: vi.fn(), identity: { user: { account_id: 91, organization_id: 7, division_id: 1001, role: "student" }, context_revision: "cabinet1" } }));
vi.mock("./client", () => ({ domain, getIdentity: () => identity }));
const exam = { id: 15, name: "Весенний экзамен", exam_type: "classic", direction_id: 1, revision: 8, division_revision: 3, training_enabled: true, date: null };
const completed = { id: 51, exam_id: 15, status: "completed", attempt_no: 2, raw_total: 0, rounded_total: 0, max_score: 20, grade: 0, effective_grade: 0, completed_at: "2026-10-08T12:00:00Z", has_appeal: true, commission: [{ account_id: 95, full_name: "Экзаменатор" }], exam_window_snapshot: { start_at: "2026-10-08T08:00:00Z", end_at: "2026-10-08T14:00:00Z" } };
const training = { account_id: 91, section_ref_id: "15", part_id: 0, exam: { id: 15, exam_type: "classic", direction_id: 1, version: 8, training_enabled: true, start_at: null, end_at: null }, parts: [{ part_id: 3, part_code: "А", ref_id: "15:3", stats: { total: 2, learned: 1, unlearned: 0, answer_changed: 1, progress_percent: 50 } }], cards: [{ card_ref: "exam:15:8", question_id: 8, part_id: 3, part_code: "А", question: "Изменённый вопрос", answer: "Ответ", content_fingerprint: "a".repeat(64), status: "answer_changed" }, { card_ref: "exam:15:9", question_id: 9, part_id: 3, question: "Вопрос", answer: "Ответ", content_fingerprint: "b".repeat(64), status: "learned" }], stats: { total: 2, learned: 1, unlearned: 0, answer_changed: 1, progress_percent: 50 }, batches: [{ index: 0, from: 1, to: 2, size: 2, stats: { total: 2, learned: 1, unlearned: 0, answer_changed: 1 } }], settings: { batch_size: 10, last_batch_index: 0, study_mode: "unlearned", last_part_id: 3 } };
function defaultOwner(path: string) {
  if (path === "/core/directions") return [{ id: 1, name: "Математика", is_active: true }];
  if (path.startsWith("/exams?")) return { items: [exam], total: 1 };
  if (path === "/exams/15") return exam;
  if (path.startsWith("/exams/15/results/")) return { current: completed, history: [{ ...completed, id: 40, attempt_no: 1, grade: 5, effective_grade: 5 }, { ...completed, id: 60, status: "in_progress" }] };
  if (path.startsWith("/exams/15/results")) return { items: [completed, { ...completed, id: 60, status: "in_progress" }], total: 2 };
  if (path.startsWith("/exams/15/training")) return path.includes("part_id=3") ? { ...training, section_ref_id: "15:3", part_id: 3 } : training;
  throw new Error(`Unexpected route ${path}`);
}
beforeEach(() => { vi.resetModules(); domain.mockReset(); identity.user.role = "student"; identity.user.division_id = 1001; identity.context_revision = "cabinet1"; domain.mockImplementation(defaultOwner); });
describe("student exam boundary", () => {
  it("filters by direction and case-insensitive title before slicing result pages", async () => {
    const catalog = [15,16,17].map(id=>({...exam,id,name:id===15?"Алгебра":"Итоговый экзамен",direction_id:id===17?2:1,exam_date:"2026-10-09",start_at:null,end_at:null}));
    domain.mockImplementation((path:string)=>path.startsWith("/exams?")?{items:catalog,total:3}:path.includes("/results?")?{items:[{...completed,exam_date:"2026-10-09"}],total:1}:defaultOwner(path));
    const {examsStudentGet}=await import("./exams-student");
    const result=await examsStudentGet("/api/student/exams/results",{directionId:"1",search:"ИТОГОВЫЙ",grade:"0",limit:1,page:1}) as {items:{examId:number}[];pagination:{total:number}};
    expect(result.items.map(item=>item.examId)).toEqual([16]);expect(result.pagination.total).toBe(1);
    expect(domain.mock.calls.every(call=>!String(call[0]).includes("search=")&&!String(call[0]).includes("directionId="))).toBe(true);
  });

  it.each(["not_started", "pending_ready", "in_progress"])("keeps the completed zero during a %s retake without publishing its private state", async status => {
    const summary = { ...exam, exam_date: "2026-10-09", start_at: "2026-10-08T21:00:00Z", end_at: "2026-10-09T15:00:00Z" };
    const published = { ...completed, attempt_no: 1, exam_date: summary.exam_date, has_active_retake: true, retake_status: status };
    const pending = { ...completed, id: 60, status: "in_progress", grade: 5, raw_total: 99, round: { votes: ["Private vote"] } };
    domain.mockImplementation((path: string) => path.startsWith("/exams?") ? { items: [summary], total: 1 } : path === "/exams/15" ? summary : path === "/exams/15/results/91" ? { current: published, history: [pending] } : path.startsWith("/exams/15/results?") ? { items: [published, pending], total: 2 } : defaultOwner(path));
    const { examsStudentGet } = await import("./exams-student");
    const page = await examsStudentGet("/api/student/exams/results") as { items: Record<string, unknown>[] };
    expect(domain.mock.calls.some(call => call[0] === "/exams/15")).toBe(false);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ hasActiveRetake: true, retakeStatus: status, hasPreviousAttempt: false, examDate: summary.exam_date, startAt: summary.start_at, currentAttempt: { attemptNo: 1, grade: 0, roundedTotal: 0 } });
    const detail = await examsStudentGet("/api/student/exams/15/result") as { current: { grade: number }; history: unknown[] };
    expect(detail).toMatchObject({ hasActiveRetake: true, retakeStatus: status, current: { grade: 0 }, history: [] });
    expect(JSON.stringify([page, detail])).not.toContain("Private vote");
  });
  it("sorts by the owner's current calendar date and stable exam ID, with date filters sent before owner pagination", async () => {
    const catalog = [15, 16, 17].map((id, index) => ({ ...exam, id, exam_date: index ? "2026-10-10" : "2026-10-09", start_at: index ? "2026-10-09T21:00:00Z" : "2026-10-08T21:00:00Z", end_at: null }));
    domain.mockImplementation((path: string) => path.startsWith("/exams?") ? { items: catalog, total: 3 } : /^\/exams\/\d+\/results\?/.test(path) ? { items: [{ ...completed, exam_date: catalog.find(e => e.id === Number(path.split("/")[2]))!.exam_date, completed_at: path.includes("/15/") ? "2026-12-31T12:00:00Z" : "2026-01-01T12:00:00Z" }], total: 1 } : defaultOwner(path));
    const { examsStudentGet } = await import("./exams-student");
    const descending = await examsStudentGet("/api/student/exams/results", { dateFrom: "2026-10-09", dateTo: "2026-10-10", sort: "date_desc" }) as { items: { examId: number; currentAttempt: { grade: number } }[] };
    expect(descending.items.map(e => e.examId)).toEqual([17, 16, 15]);
    expect(descending.items.every(e => e.currentAttempt.grade === 0)).toBe(true);
    expect(domain.mock.calls.filter(call => call[0] === "/core/directions")).toHaveLength(1);
    expect(domain.mock.calls.some(call => /^\/exams\/\d+$/.test(String(call[0])))).toBe(false);
    expect(domain.mock.calls.some(call => call[0] === "/exams?scope=division&date_from=2026-10-09&date_to=2026-10-10&sort=date_desc&limit=200&offset=0")).toBe(true);
    const ascending = await examsStudentGet("/api/student/exams/results", { sort: "date_asc" }) as { items: { examId: number }[] };
    expect(ascending.items.map(e => e.examId)).toEqual([15, 16, 17]);
  });
  it("retains canonical case-insensitive direction ordering after selecting published student results", async () => {
    const catalog = [{ ...exam, id: 15, direction_id: 1, exam_date: "2026-10-09", start_at: null, end_at: null }, { ...exam, id: 16, direction_id: 2, exam_date: "2026-10-09", start_at: null, end_at: null }];
    domain.mockImplementation((path: string) => path === "/core/directions" ? [{ id: 1, name: "Математика" }, { id: 2, name: "математика" }] : path.startsWith("/exams?") ? { items: catalog, total: 2 } : path.includes("/results?") ? { items: [{ ...completed, exam_date: "2026-10-09" }], total: 1 } : defaultOwner(path));
    const { examsStudentGet } = await import("./exams-student");
    const page = await examsStudentGet("/api/student/exams/results", { sort: "direction_asc" }) as { items: { examId: number }[] };
    expect(page.items.map(e => e.examId)).toEqual([15, 16]);
  });
  it("keeps a completed zero and excludes unpublished attempts", async () => {
    const { examsStudentGet } = await import("./exams-student");
    const page = await examsStudentGet("/api/student/exams/results?grade=0&page=1&limit=20") as { items: { currentAttempt: { grade: number }; startAt: string }[]; pagination: { total: number } };
    expect(page.pagination.total).toBe(1); expect(page.items[0].currentAttempt.grade).toBe(0); expect(page.items[0].startAt).toBe(completed.exam_window_snapshot.start_at);
    expect(domain.mock.calls.every(call => !String(call[0]).includes("organization_id") && !String(call[0]).includes("division_id") && !String(call[0]).includes("student_account_id"))).toBe(true);
  });
  it("uses the current exam name to distinguish results sharing one direction", async () => {
    domain.mockImplementation((path: string) => path === "/exams/15" ? { ...exam, name: "Экзамен после переименования" } : defaultOwner(path));
    const { examsStudentGet } = await import("./exams-student");
    const page = await examsStudentGet("/api/student/exams/results") as { items: { examId: number; examName: string; directionName: string }[] };
    const detail = await examsStudentGet("/api/student/exams/15/result") as { examName: string; directionName: string };
    expect(page.items[0]).toMatchObject({ examId: 15, examName: "Экзамен после переименования", directionName: "Математика" });
    expect(detail).toMatchObject({ examName: "Экзамен после переименования", directionName: "Математика" });
  });
  it("requests only the session account and exposes completed retake history", async () => {
    const { examsStudentGet } = await import("./exams-student");
    const detail = await examsStudentGet("/api/student/exams/15/result", { studentId: 999 }) as { current: { attemptId: number }; history: { attemptId: number }[]; trainingEnabled: boolean };
    expect(domain.mock.calls.some(call => call[0] === "/exams/15/results/91")).toBe(true);
    expect(domain.mock.calls.some(call => String(call[0]).includes("999"))).toBe(false);
    expect(detail.current.attemptId).toBe(51); expect(detail.history.map(item => item.attemptId)).toEqual([40]); expect(detail.trainingEnabled).toBe(true);
  });
  it("rejects nonstudent access before requesting a student's results", async () => {
    identity.user.role = "admin";
    const { examsStudentGet } = await import("./exams-student");
    await expect(examsStudentGet("/api/student/exams/15/result")).rejects.toMatchObject({ status: 403 }); expect(domain).not.toHaveBeenCalled();
  });
  it("adapts outside dates and decimal points without oral history", async () => {
    domain.mockImplementation((path: string) => path === "/exams/15" ? { ...exam, exam_type: "outside_lms", date: "2026-10-07" } : path.startsWith("/exams/15/results/") ? { current: { id: 22, points: "12.34", grade: 3, examinator: "Преподаватель" }, history: [] } : defaultOwner(path));
    const { examsStudentGet } = await import("./exams-student");
    const result = await examsStudentGet("/api/student/exams/15/result") as { examType: string; current: { points: number; date: string }; history: unknown[] };
    expect(result.examType).toBe("outside_lms"); expect(result.current.points).toBe(12.34); expect(result.current.date).toBe("2026-10-07"); expect(result.history).toEqual([]);
  });
  it("preserves fingerprint and changed-card status while naming parts", async () => {
    const { examTrainingView, examTrainingBatch } = await import("./exams-student");
    const view = await examTrainingView("15:3"); expect(view.parts?.[0].name).toBe("Часть А"); expect(view.section_name).toBe("Часть А"); expect(view.cards[0].content_fingerprint).toBe("a".repeat(64)); expect(view.cards[0].status).toBe("answer_changed");
    const batch = await examTrainingBatch("15:3", 0, "unlearned"); expect(batch.cards.map(card => card.card_ref)).toEqual(["exam:15:8"]); expect(domain.mock.calls.some(call => call[0] === "/exams/15/training?part_id=3")).toBe(true);
  });
  it("keeps a progress UUID on uncertain response and sends only current fingerprint", async () => {
    let count = 0, firstKey = "";
    domain.mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method) { const key = new Headers(options.headers).get("Idempotency-Key")!; if (++count === 1) { firstKey = key; throw new TypeError("lost response"); } expect(key).toBe(firstKey); expect(JSON.parse(String(options.body))).toEqual({ content_fingerprint: "a".repeat(64) }); return { learned: true }; }
      return defaultOwner(path);
    });
    const { examTrainingMark } = await import("./exams-student");
    const payload = { student_id: 999, section_kind: "exam" as const, section_ref_id: "15:3", card_ref: "exam:15:8", content_fingerprint: "a".repeat(64) };
    await expect(examTrainingMark(payload)).rejects.toThrow("lost response"); await examTrainingMark(payload);
    expect(firstKey).toMatch(/^[0-9a-f-]{36}$/); expect(domain.mock.calls[1][0]).toBe("/exams/15/training/progress/8?part_id=3");
  });
  it("refuses a card from another exam before mutation", async () => {
    const { examTrainingMark } = await import("./exams-student");
    await expect(examTrainingMark({ student_id: 91, section_kind: "exam", section_ref_id: "15", card_ref: "exam:16:8", content_fingerprint: "a".repeat(64) })).rejects.toMatchObject({ status: 404 }); expect(domain).not.toHaveBeenCalled();
  });
  it("uses division revision for training toggle and reuses supplied command key", async () => {
    identity.user.role = "admin"; domain.mockImplementation((path: string, options?: RequestInit) => options?.method ? { training_enabled: true, version: 4 } : defaultOwner(path));
    const { examsStudentGet, examsStudentMutate } = await import("./exams-student");
    const state = await examsStudentGet("/api/exams/15/training") as { exam: { version: number }; cards_count: number };
    expect(state.exam.version).toBe(3); expect(state.cards_count).toBe(2);
    await examsStudentMutate({ path: "/api/exams/15/training", method: "PATCH", body: { enabled: true, expectedVersion: state.exam.version }, key: "07c4e936-3733-4fd6-a13c-daa39e63bdef" });
    const call = domain.mock.calls.at(-1)!; expect(call[1].method).toBe("PUT"); expect(JSON.parse(call[1].body)).toEqual({ training_enabled: true, expected_revision: 3 }); expect(new Headers(call[1].headers).get("Idempotency-Key")).toBe("07c4e936-3733-4fd6-a13c-daa39e63bdef");
  });
  it("excludes disabled preparation but propagates outages", async () => {
    domain.mockImplementation((path: string) => path.startsWith("/exams/15/training") ? Promise.reject(Object.assign(new Error("disabled"), { status: 409, code: "training_disabled" })) : defaultOwner(path));
    const { examTrainingTree } = await import("./exams-student"); expect(await examTrainingTree()).toEqual([]);
    domain.mockImplementation((path: string) => path.startsWith("/exams/15/training") ? Promise.reject(Object.assign(new Error("outage"), { status: 502, code: "upstream_unavailable" })) : defaultOwner(path));
    await expect(examTrainingTree()).rejects.toMatchObject({ status: 502 });
  });
  it("continues beyond the first owner catalog page", async () => {
    domain.mockImplementation((path: string) => {
      if (path === "/core/directions") return [{ id: 1, name: "Математика" }];
      if (path.startsWith("/exams?")) return { items: path.includes("offset=200") ? [{ ...exam, id: 201 }] : Array.from({ length: 200 }, (_, index) => ({ ...exam, id: index + 1 })), total: 201 };
      if (path.startsWith("/exams/201/results")) return { items: [completed], total: 1 };
      if (path.includes("/results")) return { items: [], total: 0 };
      if (path === "/exams/201") return { ...exam, id: 201 };
      throw new Error(path);
    });
    const { examsStudentGet } = await import("./exams-student");
    const page = await examsStudentGet("/api/student/exams/results") as { items: { examId: number }[] };
    expect(page.items.map(item => item.examId)).toEqual([201]); expect(domain.mock.calls.some(call => String(call[0]).includes("offset=200"))).toBe(true);
  });
  it("maps protocol anchors without exposing examiner votes or actions", async () => {
    domain.mockImplementation((path: string) => path.includes("/protocol") ? { items: [{ id: 1, sequence_no: 5, question_text: "Вопрос", answer_text: "Ответ", part_code: "А", question_weight: 2, consensus: 0.5, weighted_score: 1, cycle_no: 2, replaces_id: 0, purpose: "regular", status: "consensus", round: { votes: [{ account_id: 95 }] }, can_replace: true }], total: 12, through_sequence_no: 18 } : defaultOwner(path));
    const { examsStudentGet } = await import("./exams-student");
    const page = await examsStudentGet("/api/student/exams/15/attempts/51/questions?page=2&limit=10&throughSequenceNo=18") as { items: Record<string, unknown>[]; throughSequenceNo: number };
    expect(domain.mock.calls[0][0]).toBe("/exams/15/attempts/51/protocol?limit=10&offset=10&through_sequence_no=18"); expect(page.throughSequenceNo).toBe(18); expect(page.items[0].consensus).toBe(0.5); expect(page.items[0].round).toBeUndefined(); expect(page.items[0].canReplace).toBeUndefined();
  });
  it("does not reuse an uncertain progress key after cabinet changes", async () => {
    const keys: string[] = [];
    domain.mockImplementation((_path: string, options: RequestInit) => { keys.push(new Headers(options.headers).get("Idempotency-Key")!); return Promise.reject(new TypeError("lost response")); });
    const { examTrainingMark } = await import("./exams-student");
    const payload = { student_id: 91, section_kind: "exam" as const, section_ref_id: "15", card_ref: "exam:15:8", content_fingerprint: "a".repeat(64) };
    await expect(examTrainingMark(payload)).rejects.toThrow(); identity.user.division_id = 1002; identity.context_revision = "cabinet2"; await expect(examTrainingMark(payload)).rejects.toThrow(); expect(keys[0]).not.toBe(keys[1]);
  });
  it("keeps unrelated facade routes unhandled", async () => {
    const { examsStudentGet, examsStudentMutate, handlesStudentPath } = await import("./exams-student");
    expect(await examsStudentGet("/api/exams/15/parts")).toBeUndefined(); expect(await examsStudentMutate({ path: "/api/exams/15/parts", method: "POST", key: crypto.randomUUID() })).toBeUndefined(); expect(handlesStudentPath("/api/student/exams/results?grade=0")).toBe(true); expect(domain).not.toHaveBeenCalled();
  });
});
