import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  Camera,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  NotebookPen,
  Trophy,
  Users,
} from "lucide-react";
import type { RoleNavigation } from "./types";

export const adminNavigation: RoleNavigation = {
  brand: "CPM Admin",
  groups: [
    {
      title: "Меню",
      items: [
        { id: "dashboard", label: "Главная", icon: LayoutDashboard },
        { id: "users", label: "Пользователи", icon: Users },
        { id: "schools", label: "Школы", icon: Building2 },
        { id: "schedule", label: "Расписание", icon: BookOpen },
      ],
    },
    {
      title: "Управление",
      items: [
        { id: "assignments", label: "Домашние задания", icon: NotebookPen },
        { id: "tests", label: "Тесты", icon: BarChart3 },
        { id: "test-results", label: "Результаты", icon: BarChart3 },
        { id: "exams", label: "Экзамены", icon: GraduationCap },
        { id: "attendance", label: "Посещаемость", icon: CalendarDays },
        { id: "scan", label: "Сканирование", icon: Camera },
        { id: "zaps", label: "Запросы на отгул", icon: ClipboardList },
        { id: "ratings", label: "Рейтинг", icon: Trophy },
      ],
    },
  ],
};
