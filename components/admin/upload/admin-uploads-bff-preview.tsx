"use client";

import { useEffect, useRef, useState } from "react";
import type { UploadSession } from "@/lib/bff/uploads";
import { Button } from "@/components/ui/button";
import shared from "./admin-upload.module.css";
import styles from "./admin-uploads-bff-preview.module.css";
import { nativeUploadView, nativeUploadEditPayload, type PreviewValue, type PreviewInput, type PreviewRow, type PreviewView } from "./admin-uploads-bff-model";

type Value = PreviewValue;
type Input = PreviewInput;
type Row = PreviewRow;
type View = PreviewView;
interface Change { input: Input; excluded: boolean }
interface Props {
  session: UploadSession;
  editable: boolean;
  busy: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onDirty?: (dirty: boolean) => void;
}
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const integer = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const positive = (value: unknown) => (integer(value) ?? 0) > 0;
const strings = (value: unknown) => value === undefined || value === null ? [] : Array.isArray(value) ? value.map(entry => typeof entry === "string" ? entry : "unknown_owner_issue") : ["unknown_owner_issue"];
const numberFields = new Set(["studentId", "points", "grade", "replacementLimit", "account_id", "legacy_student_id", "percent", "correct_count", ...Array.from({ length: 6 }, (_, i) => `examinator${i + 1}Id`)]);
const coreFields = ["full_name", "role", "class", "login", "school_id", "group_id"];
const fieldLabels: Record<string, string> = {
  class_raw: "Класс из файла", school_name: "Школа", proctor_name: "Проктор", tg_name: "Контакт (tg_name)", account_id: "ID аккаунта ученика", legacy_student_id: "ID профиля ученика", percent: "Процент из файла", correct_count: "Верных ответов из файла", completed_at: "Дата результата", time_spent: "Затраченное время", question_id: "ID вопроса", type: "Тип вопроса", text: "Вопрос", answers: "Варианты (✓ — правильный)", correct_answers: "Эталонные ответы", full_name: "ФИО", role: "Роль", class: "Класс", login: "Логин", school_id: "ID школы", group_id: "ID группы",
  question: "Вопрос", answer: "Ответ", partCode: "Код части", questionText: "Вопрос", answerText: "Эталонный ответ",
  studentId: "ID аккаунта ученика", studentLogin: "Логин ученика", points: "Баллы", grade: "Оценка", examinator: "Экзаменатор", replacementLimit: "Лимит замен",
};
function examFields(type: string): string[] {
  if (type === "exams.questions") return ["partCode", "questionText", "answerText"];
  if (type === "exams.outside") return ["studentId", "studentLogin", "points", "grade", "examinator"];
  if (type === "exams.assignments") return ["studentId", "studentLogin", "replacementLimit", ...Array.from({ length: 6 }, (_, i) => [`examinator${i + 1}Id`, `examinator${i + 1}Login`]).flat()];
  return [];
}
function allowedInput(raw: unknown, fields: string[]): Input {
  const result: Input = {}, input = record(raw);
  for (const field of fields) if (typeof input[field] === "string" || typeof input[field] === "number") result[field] = input[field] as Value;
  return result;
}
function ownerPreview(session: UploadSession) { return record(session.preview); }
function view(session: UploadSession): View {
  const native = nativeUploadView(session);
  if (native) return native;
  const owner = ownerPreview(session), preview = record(owner.preview);
  const base = { rows: [] as Row[], total: 0, partial: false, collision: false, target: "", ownerState: text(owner.state || owner.status), valid: true };
  if (session.type === "users.credentials") {
    const users = Array.isArray(owner.users) ? owner.users : [];
    const rows = users.map((user, i) => ({ id: String(i + 1), source: i + 1, input: allowedInput(user, coreFields), excluded: false, errors: strings(record(user).errors), warnings: [] }));
    // Core creation returns a validated row count; a subsequent GET adds masked users.
    const total = Array.isArray(owner.users) ? rows.length : integer(owner.rows) || 0;
    return { ...base, kind: "core", rows, total, valid: total > 0 && total <= 100 && (!Array.isArray(owner.users) || rows.every(row => text(row.input.full_name).trim())) };
  }
  if (session.type === "cards.xlsx") {
    const cards = Array.isArray(preview.cards) ? preview.cards : [];
    const rows = cards.map(raw => { const row = record(raw); const errors = strings(row.errors); if (row.action === "error" && !errors.length) errors.push("unknown_owner_issue"); return { id: String(row.row), source: integer(row.row) ?? 0, input: allowedInput(row, ["question", "answer"]), excluded: row.action === "skip", errors, warnings: strings(row.warnings) }; });
    const collision = preview.theme_name_collision === true, themeId = integer(preview.theme_id);
    const target = collision ? `Карточки будут добавлены в существующую тему «${text(preview.new_theme_name)}» (ID ${themeId ?? "—"}).` : preview.create_new_theme === true ? `Новая тема: ${text(preview.new_theme_name)}` : `Тема: ID ${themeId ?? "—"}`;
    return { ...base, kind: "cards", rows, total: rows.length, collision, target, valid: Array.isArray(preview.cards) && positive(preview.direction_id) && (preview.create_new_theme === true ? !!text(preview.new_theme_name).trim() && (!collision || positive(themeId)) : positive(themeId)) && uniqueRows(rows) };
  }
  if (session.type === "cards.transform") {
    const cards = Array.isArray(preview.selected_cards) ? preview.selected_cards : [];
    const rows = cards.map((raw, i) => ({ id: String(record(raw).id || i + 1), source: i + 1, input: allowedInput(raw, ["question", "answer"]), excluded: false, errors: [], warnings: [] }));
    return { ...base, kind: "transform", rows, total: rows.length, target: text(preview.draft_title), valid: cards.length > 0 && cards.length <= 200 && !!text(preview.draft_title).trim() && rows.every(row => !!text(row.input.question).trim() && !!text(row.input.answer).trim()) };
  }
  if (examFields(session.type).length) {
    const rawRows = Array.isArray(owner.rows) ? owner.rows : [];
    const rows = rawRows.map(raw => { const row = record(raw); return { id: text(row.row_id), source: integer(row.source_row) ?? 0, input: allowedInput(row.input, examFields(session.type)), excluded: row.excluded === true, errors: strings(row.errors), warnings: [] }; });
    const total = integer(owner.total) ?? rows.length;
    return { ...base, kind: "exams", rows, total, partial: total !== rows.length, valid: Array.isArray(owner.rows) && total <= 5000 && uniqueRows(rows) };
  }
  return { ...base, kind: "unsupported", valid: false };
}
function uniqueRows(rows: Row[]) { return rows.every(row => row.id && row.source > 0) && new Set(rows.map(row => row.id)).size === rows.length; }
function active(session: UploadSession, ownerState: string, now = Date.now()) {
  const expiry = Date.parse(session.expires_at);
  return session.state === "preview" && !["completed", "committed", "expired", "rejected"].includes(ownerState) && Number.isFinite(expiry) && expiry > now;
}

/** Commit reflects the saved owner preview, never unsaved local edits or a partial page. */
export function uploadPreviewCanCommit(session: UploadSession): boolean {
  const current = view(session), included = current.rows.filter(row => !row.excluded);
  if (!active(session, current.ownerState) || !current.valid || current.partial) return false;
  if (current.nativeCanCommit !== undefined) return current.nativeCanCommit;
  if (current.kind === "core") return current.total > 0 && current.rows.every(row => !row.errors.length);
  return included.length > 0 && included.every(row => !row.errors.length && (current.kind !== "cards" || !!text(row.input.question).trim() && !!text(row.input.answer).trim()));
}

function normalizedInput(input: Input, fields: string[]): Input {
  const result = allowedInput(input, fields);
  for (const field of fields) {
    const value = result[field];
    if (!numberFields.has(field) || value === undefined) continue;
    if (typeof value === "string" && !value.trim()) { delete result[field]; continue; }
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number) || (field !== "points" && !Number.isSafeInteger(number))) throw new Error(`Проверьте поле «${fieldLabels[field] || fieldLabel(field)}»`);
    if (field === "grade" && (number < 0 || number > 5) || field === "replacementLimit" && (number < 0 || number > 100) || field !== "points" && field !== "grade" && field !== "replacementLimit" && number < 1) throw new Error(`Проверьте поле «${fieldLabels[field] || fieldLabel(field)}»`);
    result[field] = number;
  }
  return result;
}

/** Build only the native owner edit shape; coordinator supplies expected_revision. */
export function uploadPreviewEditPayload(session: UploadSession, changes: Record<string, Change>): Record<string, unknown> {
  const current = view(session);
  if (!active(session, current.ownerState) || !current.valid || current.partial || !["cards", "exams", "legacy", "external"].includes(current.kind)) throw new Error("Этот предпросмотр нельзя редактировать");
  const native = nativeUploadEditPayload(session, changes);
  if (native) return native;
  const ids = new Set(current.rows.map(row => row.id));
  if (Object.keys(changes).some(id => !ids.has(id))) throw new Error("Строка больше не существует. Обновите предпросмотр.");
  if (current.kind === "cards") return { cards: current.rows.map(row => {
    const edited = changes[row.id] ?? row;
    return { row: row.source, question: text(edited.input.question), answer: text(edited.input.answer), skip: edited.excluded };
  }) };
  return { changes: current.rows.filter(row => changes[row.id]).map(row => {
    const edited = changes[row.id];
    // Owner skips excluded rows before validating their input. Allow excluding a bad numeric cell.
    return { row_id: row.id, input: edited.excluded ? allowedInput(edited.input, examFields(session.type)) : normalizedInput(edited.input, examFields(session.type)), excluded: edited.excluded };
  }) };
}

function fieldLabel(field: string) {
  if (fieldLabels[field]) return fieldLabels[field];
  const member = field.match(/^examinator([1-6])(Id|Login)$/);
  return member ? `${member[2] === "Id" ? "ID аккаунта" : "Логин"} экзаменатора ${member[1]}` : "Поле";
}
function issueLabel(code: string) {
  const labels: Record<string, string> = { invalid_question: "Укажите вопрос до 4000 символов", invalid_answer: "Укажите ответ до 16000 символов", duplicate_in_file: "Повтор в этом файле", duplicate_in_section: "Такая карточка уже есть в теме", duplicate_import_row: "Повтор строки импорта", student_not_found: "Ученик не найден в подразделении", examinator_not_found: "Экзаменатор не найден", invalid_commission_size: "Укажите от одного до шести экзаменаторов", invalid_points: "Проверьте баллы", questionText_required: "Укажите вопрос", answerText_required: "Укажите эталонный ответ", partCode_required: "Укажите код части", student_required: "Укажите аккаунт или логин ученика", person_identity_mismatch: "ID аккаунта и логин относятся к разным пользователям", privilege_modified: "Лимит замен изменился. Обновите предпросмотр" };
  const external: Record<string,string> = { student_account_mismatch:"ID и ФИО относятся к разным ученикам", student_not_in_scope:"Ученик не участвует в выбранном подразделении", student_ambiguous:"Есть несколько совпадений. Выберите аккаунт", student_not_found:"Ученик не найден", invalid_percent:"Источник не подтвердил процент", percent_required:"Укажите процент", duplicate_student:"Повтор ученика в файле", duplicate_row_id:"Повтор ID строки", invalid_full_name:"Проверьте ФИО" };
  return labels[code] ?? external[code] ?? "Проверьте строку: источник не подтвердил данные";
}

export function AdminUploadsBffPreview(props: Props) {
  return <PreviewEditor key={`${props.session.id}:${props.session.revision}:${props.session.owner_revision}`} {...props} />;
}
function PreviewEditor({ session, editable, busy, onSave, onDirty }: Props) {
  const current = view(session);
  const [changes, setChanges] = useState<Record<string, Change>>({});
  const [page, setPage] = useState(0), [size, setSize] = useState(20), [onlyErrors, setOnlyErrors] = useState(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [, expiredTick] = useState(0);
  const dirty = Object.keys(changes).length > 0, callback = useRef(onDirty), running = useRef(false);
  useEffect(() => { callback.current = onDirty; }, [onDirty]);
  useEffect(() => { callback.current?.(dirty); }, [dirty]);
  useEffect(() => () => callback.current?.(false), []);
  useEffect(() => {
    const remaining = Date.parse(session.expires_at) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = setTimeout(() => expiredTick(value => value + 1), Math.min(remaining + 1, 2147483647));
    return () => clearTimeout(timer);
  }, [session.expires_at]);
  const canEdit = editable && active(session, current.ownerState) && current.valid && !current.partial && !current.editBlockedReason && ["cards", "exams", "legacy", "external"].includes(current.kind);
  const disabled = !canEdit || busy || saving;
  const filtered = current.rows.filter(row => !onlyErrors || row.errors.length > 0);
  const pages = Math.max(1, Math.ceil(filtered.length / size)), selectedPage = Math.min(page, pages - 1), visible = filtered.slice(selectedPage * size, (selectedPage + 1) * size);
  const included = current.rows.filter(row => !row.excluded), errors = included.filter(row => row.errors.length > 0).length;
  const change = (row: Row, patch: Partial<Change>) => setChanges(previous => ({ ...previous, [row.id]: { ...(previous[row.id] ?? { input: row.input, excluded: row.excluded }), ...patch } }));
  const save = async () => {
    if (!dirty || disabled || running.current) return;
    let payload: Record<string, unknown>;
    try { payload = uploadPreviewEditPayload(session, changes); } catch (failure) { setError(failure instanceof Error ? failure.message : "Проверьте строки"); return; }
    running.current = true; setSaving(true); setError("");
    try { await onSave(payload); setChanges({}); }
    catch { setError("Изменения не подтверждены. Проверьте исход сохранения в журнале загрузок."); }
    finally { running.current = false; setSaving(false); }
  };
  const columns = current.fields ?? (current.kind === "core" ? coreFields : current.kind === "exams" ? examFields(session.type) : ["question", "answer"]);
  return <section className={shared.previewWrap} aria-label="Предпросмотр загрузки">
    <div className={shared.previewHeader}><div><h2 className={shared.mainTitle}>Предпросмотр</h2><p className={shared.hint}>Сохранённые данные источника. Изменения проверяются перед применением.</p></div>{canEdit && <div className={shared.actions}><Button disabled={busy || saving || !dirty} onClick={() => void save()}>{saving ? "Сохранение…" : "Сохранить правки"}</Button><Button variant="ghost" disabled={busy || saving || !dirty} onClick={() => { setChanges({}); setError(""); }}>Отменить мои правки</Button></div>}</div>
    <div className={shared.summaryGrid}><span className={shared.statPill}>Строк: <strong>{current.total}</strong></span>{current.kind !== "core" && <><span className={shared.statPill}>Включено: <strong>{included.length}</strong></span><span className={shared.statPill}>Ошибок: <strong>{errors}</strong></span></>}</div>
    {current.summary?.length ? <div className={shared.summaryGrid}>{current.summary.map(item => <span key={item.label} className={shared.statPill}>{item.label}: <strong>{String(item.value ?? "—")}</strong></span>)}</div> : null}
    {current.issues?.length ? <ul className={styles.warning}>{current.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul> : null}
    {current.editBlockedReason && <p className={styles.warning}>{current.editBlockedReason}</p>}
    {current.target && <p className={current.collision ? styles.warning : styles.note}>{current.kind === "transform" ? `Черновик: ${current.target}` : current.target}</p>}
    {current.kind === "core" && <p className={styles.note}>Учётные данные уже проверены источником. Предпросмотр не редактируется; пароли не показываются.</p>}
    {current.kind === "legacy" && <p className={styles.note}>Сопоставления и решение о применении проверяет Core. Правки отправляются полным снимком строк; существующие ученики пропускаются. Максимум 100 строк. Новые учётные записи требуют сброса пароля; пароли здесь не создаются и не выдаются.</p>}
    {current.kind === "tests" && <p className={styles.note}>Нормализация Excel / JSON / OnlineTestPad и проверка выполнены Tests. Для правок загрузите исправленный файл: источник не возвращает исходный редактируемый payload. Баллы и правильные ответы показаны по его превью.</p>}
    {current.kind === "external" && <p className={styles.note}>Внешний тест закреплён за загрузкой. Проценты сохраняются как в источнике, без пересчёта по числу ответов. Выберите аккаунт при неоднозначном совпадении; сопоставление и оценку проверяет Tests.</p>}
    {current.kind === "transform" && <p className={styles.note}>Преобразование использует сохранённый порядок выбранных карточек. Снимок не редактируется.</p>}
    {!active(session, current.ownerState) && <p className={styles.note}>Предпросмотр доступен только для чтения: загрузка завершена, срок истёк или требуется проверить её состояние.</p>}
    {current.partial && <p className={styles.warning} role="alert">Источник вернул {current.rows.length} из {current.total} строк. Полный предпросмотр нужен для редактирования и применения.</p>}
    {!current.valid && <p className={styles.warning} role="alert">Источник не подтвердил полный формат предпросмотра. Обновите загрузку перед применением.</p>}
    {dirty && <p className={styles.warning} role="status">Есть несохранённые правки. Сохраните их и дождитесь проверки источником перед применением загрузки.</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {current.rows.length > 0 && <><div className={shared.previewFilters}><label className={styles.check}><input type="checkbox" checked={onlyErrors} onChange={event => { setOnlyErrors(event.target.checked); setPage(0); }} />Только строки с ошибками</label><label className={styles.pageSize}>Строк на странице<select value={size} onChange={event => { setSize(Number(event.target.value)); setPage(0); }}><option value={20}>20</option><option value={50}>50</option></select></label></div>
      <div className={styles.rows}>{visible.map(row => {
        const local = changes[row.id] ?? row;
        return <article key={row.id} className={`${styles.row} ${local.excluded ? styles.excluded : ""}`}><div className={styles.rowHeader}><strong>Строка {row.source}{local.excluded ? " · исключена" : ""}</strong>{canEdit && ["cards", "exams"].includes(current.kind) && <label className={styles.check}><input type="checkbox" aria-label={`Исключить строку ${row.source}`} checked={local.excluded} disabled={disabled} onChange={event => change(row, { excluded: event.target.checked })} />Исключить</label>}</div>{row.caption && <p className={styles.note}>{row.caption}</p>}{canEdit && row.candidates?.length ? <label className={styles.field}><span>Выбрать совпавший аккаунт</span><select aria-label={`Аккаунт, строка ${row.source}`} disabled={disabled} value={local.input.account_id ?? ""} onChange={event => change(row, { input: { ...local.input, account_id:event.target.value } })}><option value="">Выберите аккаунт</option>{row.candidates.map(candidate => <option key={candidate.account_id} value={candidate.account_id}>{candidate.full_name} · {candidate.account_id}</option>)}</select></label> : null}<div className={styles.fields}>{columns.map(field => <label className={styles.field} key={field}><span>{fieldLabel(field)}</span>{canEdit ? <textarea rows={field === "question" || field === "answer" || field === "questionText" || field === "answerText" ? 3 : 1} inputMode={numberFields.has(field) ? "decimal" : undefined} value={local.input[field] ?? ""} disabled={disabled || local.excluded && ["cards", "exams"].includes(current.kind)} aria-label={`${fieldLabel(field)}, строка ${row.source}`} onChange={event => change(row, { input: { ...local.input, [field]: event.target.value } })} /> : <span className={styles.value}>{row.unavailableFields?.includes(field) ? "ID не отображается: точное значение недоступно" : local.input[field] === undefined || local.input[field] === null || local.input[field] === "" ? "—" : String(local.input[field])}</span>}</label>)}</div>{row.errors.length > 0 && <ul className={styles.error}>{row.errors.map((code, i) => <li key={i}>{row.literalErrors ? code : issueLabel(code)}</li>)}</ul>}{row.warnings.length > 0 && <ul className={styles.warning}>{row.warnings.map((code, i) => <li key={i}>{issueLabel(code)}</li>)}</ul>}</article>;
      })}</div>{!visible.length && <p className={styles.note}>Строк с ошибками нет.</p>}<div className={styles.pagination}><Button variant="ghost" disabled={selectedPage === 0} onClick={() => setPage(selectedPage - 1)}>Назад</Button><span>Страница {selectedPage + 1} из {pages}</span><Button variant="ghost" disabled={selectedPage + 1 >= pages} onClick={() => setPage(selectedPage + 1)}>Далее</Button></div></>}
    {current.rows.length === 0 && <p className={styles.note}>{current.kind === "core" && current.total ? "Список пользователей появится после обновления сохранённого предпросмотра." : "Строк для применения нет."}</p>}
  </section>;
}
