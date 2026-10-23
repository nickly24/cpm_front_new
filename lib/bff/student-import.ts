import { domain } from "./client";
export interface StudentImportRow {
  row: number;
  full_name: string;
  profile_id: string;
  school: string;
  class: string;
  login: string;
  password?: string;
}
export interface StudentImportIssue {
  row: number;
  field: string;
  reason: string;
}
export interface StudentImportDraft {
  id: string;
  revision: number;
  state: string;
  division_id: number;
  expires_at: string;
  rows: StudentImportRow[];
  issues: StudentImportIssue[];
  batch_size: number;
  batch_count: number;
  batches: {
    batch_index: number;
    upload_session_id: string;
    native_session_id: number | null;
    status: string | null;
  }[];
}
export interface StudentImportJob {
  id: string;
  status: string;
  error?: string;
  capabilities?: {
    recover_receipt?: boolean;
    retry_confirmation?: boolean;
    retry_delivery?: boolean;
  };
}
export const studentImportPath = (division: number) =>
  `/core/divisions/${division}/student-imports`;
export const studentUploadPath = (division: number) =>
  `/uploads/divisions/${division}`;
export async function studentImportDownload(path: string, method = "GET") {
  const data = await domain<{ filename: string; content_base64: string }>(
    path,
    { method },
  );
  const bytes = Uint8Array.from(atob(data.content_base64), (c) =>
    c.charCodeAt(0),
  );
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = data.filename;
  a.hidden = true;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export const studentReasons: Record<string, string> = {
  name_required_or_too_long: "Укажите ФИО до 50 символов",
  invalid_login: "3–50 латинских букв, цифр, точек, дефисов или подчёркиваний",
  invalid_class: "Целое число от 1 до 99 либо пусто",
  school_not_found: "Школа не найдена в организации",
  school_ambiguous:
    "Название соответствует нескольким школам — укажите полное название",
  duplicate_login: "Логин повторяется в таблице",
  login_exists: "Этот логин уже занят",
  invalid_profile_id: "Положительный целый ID до 2147483647 либо пусто",
  duplicate_profile_id: "ID повторяется в таблице",
  profile_id_exists: "ID профиля уже занят",
  duplicate_row: "Повтор строки — исправьте или удалите дубликат",
};
const errors: Record<string, string> = {
  student_import_expired:
    "Срок защищённой выдачи истёк. Старые пароли не восстанавливаются. Для созданных аккаунтов доступен отдельный сброс пароля.",
  student_import_validation:
    "Изменились данные одной из строк. Проверьте отмеченные ячейки. Подтверждённые порции сохраняются; новые пользователи с занятыми ID или логинами не заменяются.",
  student_import_has_errors: "Исправьте ошибки таблицы и проверьте её снова.",
  student_import_batch_conflict:
    "Возник конфликт данных порции. Создание этой порции не подтверждено; проверьте состояние и ошибки.",
  student_import_columns:
    "Непонятные колонки. Используйте Excel-шаблон учеников.",
  student_import_name_column: "В таблице нужна колонка ФИО.",
  student_import_empty: "В файле нет учеников.",
  student_import_formula:
    "В таблице есть формулы. Замените их обычными значениями.",
  student_import_file_too_large: "Файл больше 6 МиБ.",
  student_import_memory_limit:
    "Таблица превышает допустимый объём: до 6 МиБ файла и 32 МиБ распакованных данных. Разделите её на несколько файлов.",
  preview_modified:
    "Предпросмотр изменился. Откройте сохранённую версию и подтвердите её заново.",
  previous_batch_unresolved:
    "Предыдущая порция ещё не подтверждена. Следующая не запущена.",
  owner_rejected: "Данные не прошли проверку. Исправьте строки таблицы.",
  owner_revision_conflict: "Обнаружен конфликт порции. Проверьте её состояние.",
  access_denied:
    "Доступ изменился. Нужен действующий полный администратор организации.",
  student_import_full_admin_required:
    "Импорт учеников доступен полному администратору организации.",
  scope_access_denied: "Подразделение недоступно в текущей организации.",
  invalid_xlsx: "Не удалось прочитать Excel. Используйте шаблон .xlsx.",
};
export function studentImportError(e: unknown) {
  const x = e as { code?: string; message?: string };
  return (
    errors[x.code ?? ""] ??
    x.message ??
    "Ответ не получен. Проверьте сохранённый импорт перед продолжением."
  );
}
