import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Copy,
  GraduationCap,
  LayoutDashboard,
  NotebookPen,
} from "lucide-react";
import type { RoleNavigation } from "./types";

export const studentNavigation: RoleNavigation = {
  brand: "CPM Student",
  groups: [
    {
      title: "Меню",
      items: [
        { id: "performance", label: "Успеваемость", icon: BarChart3 },
        { id: "homework", label: "Домашка", icon: NotebookPen },
        { id: "tests", label: "Тесты", icon: LayoutDashboard },
        { id: "exams", label: "Экзамены", icon: GraduationCap },
        { id: "attendance", label: "Посещаемость", icon: CalendarDays },
        { id: "train", label: "Карточки", icon: Copy },
        { id: "schedule", label: "Расписание", icon: BookOpen },
        { id: "zaps", label: "Запросы на отгул", icon: ClipboardList },
      ],
    },
  ],
};
