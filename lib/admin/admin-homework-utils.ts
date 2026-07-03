import type {
  AdminHomeworkItem,
  AdminHomeworkStatusFilter,
} from "@/lib/admin/admin-homework-types";

export function defaultHomeworkDeadlineInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function emptyAdminHomeworkForm() {
  return {
    name: "",
    type: "ДЗНВ" as const,
    deadline: defaultHomeworkDeadlineInputValue(),
    published: true,
  };
}

export function homeworkToFormData(hw: AdminHomeworkItem) {
  const deadline =
    typeof hw.deadline === "string"
      ? hw.deadline.slice(0, 10)
      : String(hw.deadline ?? "").slice(0, 10);
  return {
    name: hw.name,
    type: (hw.type === "ОВ" ? "ОВ" : "ДЗНВ") as "ДЗНВ" | "ОВ",
    deadline,
    published: hw.published !== false,
  };
}

export function formatHomeworkDeadline(value: string | undefined): string {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const [y, m, d] = raw.split("-");
  if (!y || !m || !d) return raw;
  return `${d}.${m}.${y}`;
}

function parseDeadlineDate(deadline: string): Date | null {
  const raw = String(deadline).slice(0, 10);
  const parts = raw.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export type AdminHomeworkCardStatus = "hidden" | "active" | "ended";

export function getAdminHomeworkCardStatus(
  hw: AdminHomeworkItem,
): AdminHomeworkCardStatus {
  if (hw.published === false) return "hidden";
  const dl = parseDeadlineDate(String(hw.deadline));
  if (!dl) return "active";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dl.setHours(0, 0, 0, 0);
  return dl < today ? "ended" : "active";
}

export function getAdminHomeworkStatusLabel(
  status: AdminHomeworkCardStatus,
): string {
  if (status === "hidden") return "Скрыто";
  if (status === "ended") return "Дедлайн прошёл";
  return "Активно";
}

export function filterHomeworkByStatus(
  list: AdminHomeworkItem[],
  filter: AdminHomeworkStatusFilter,
): AdminHomeworkItem[] {
  if (filter === "all") return list;
  return list.filter((hw) => {
    const s = getAdminHomeworkCardStatus(hw);
    if (filter === "hidden") return s === "hidden";
    if (filter === "ended") return s === "ended";
    if (filter === "active") return s === "active";
    return true;
  });
}

export function toUiPagination(
  p: {
    current_page: number;
    total_pages: number;
    total_items: number;
    items_per_page: number;
  } | null | undefined,
) {
  if (!p) {
    return {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    };
  }
  return {
    page: p.current_page,
    limit: p.items_per_page,
    total: p.total_items,
    totalPages: Math.max(1, p.total_pages),
    hasNext: p.current_page < p.total_pages,
    hasPrev: p.current_page > 1,
  };
}
