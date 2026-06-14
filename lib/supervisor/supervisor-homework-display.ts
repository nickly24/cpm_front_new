import type {
  SupervisorOvHomework,
  SupervisorOvHomeworkResult,
} from "@/lib/supervisor/supervisor-homework-api";

export type HomeworkHeaderMode = "short" | "full";

export function formatHomeworkDeadline(deadline: string | null | undefined): string {
  if (!deadline) {
    return "—";
  }
  const date = String(deadline).slice(0, 10);
  const [, month, day] = date.split("-");
  if (!month || !day) {
    return date;
  }
  return `${day}.${month}`;
}

export function homeworkColumnLabel(
  homework: SupervisorOvHomework,
  index: number,
  mode: HomeworkHeaderMode,
): string {
  if (mode === "full") {
    return homework.name;
  }

  const numberMatch = homework.name.match(/(\d+)/);
  if (numberMatch) {
    return `#${numberMatch[1]}`;
  }

  const words = homework.name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 4);
  }

  return `#${index + 1}`;
}

export type HomeworkCellTone =
  | "empty"
  | "pending"
  | "progress"
  | "overdue"
  | "done"
  | "failed";

export interface HomeworkCellView {
  display: string;
  tone: HomeworkCellTone;
  title: string;
}

export function getHomeworkCellView(
  result: SupervisorOvHomeworkResult | undefined,
): HomeworkCellView {
  if (!result) {
    return {
      display: "—",
      tone: "empty",
      title: "Нет данных",
    };
  }

  const parts = [result.status_text];
  if (result.result != null) {
    parts.push(`${result.result}%`);
  }
  if (result.date_pass) {
    parts.push(`сдано ${String(result.date_pass).slice(0, 10)}`);
  }
  if (result.days_overdue > 0) {
    parts.push(`просрочка ${result.days_overdue} дн.`);
  }
  const title = parts.join(" · ");

  if (result.result != null) {
    const score = Math.round(result.result);
    if (score >= 60) {
      return { display: String(score), tone: "done", title };
    }
    return { display: String(score), tone: "failed", title };
  }

  switch (result.status_text) {
    case "Сдано":
      return { display: "✓", tone: "done", title };
    case "Просрочено":
      return { display: "!", tone: "overdue", title };
    case "В процессе":
      return { display: "…", tone: "progress", title };
    case "Не начато":
    default:
      return { display: "·", tone: "pending", title };
  }
}

export function homeworkTypeClass(type: string): "ov" | "dznv" | "other" {
  if (type === "ОВ") {
    return "ov";
  }
  if (type === "ДЗНВ") {
    return "dznv";
  }
  return "other";
}
