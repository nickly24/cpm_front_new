import { BookOpen, CalendarDays, CalendarCheck2, ClipboardCheck, Copy, GraduationCap, Menu, NotebookPen } from "lucide-react";
import type { RoleNavigation } from "./types";

export const studentServices = [
  { id: "homework", label: "Домашние задания", icon: NotebookPen },
  { id: "tests", label: "Тесты", icon: ClipboardCheck },
  { id: "exams", label: "Экзамены", icon: GraduationCap },
  { id: "attendance", label: "Посещаемость", icon: CalendarCheck2 },
  { id: "train", label: "Карточки", icon: Copy },
  { id: "schedule", label: "Расписание", icon: CalendarDays },
  { id: "zaps", label: "Запрос на отгул", icon: BookOpen },
] as const;

export const studentNavigation: RoleNavigation = {
  brand: "CPM Student",
  groups: [{ title: "Меню", items: [...studentServices, { id: "menu", label: "Меню", icon: Menu }] }],
};
export const studentAuxiliarySections: Record<string, string> = { profile: "Профиль", performance: "Профиль", settings: "Настройки" };
