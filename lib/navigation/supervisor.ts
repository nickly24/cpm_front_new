import {
  BarChart3,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  NotebookPen,
  Trophy,
} from "lucide-react";
import {BFF_DEV} from "@/lib/config";
import type { RoleNavigation } from "./types";

export const supervisorNavigation: RoleNavigation = {
  brand: "CPM Supervisor",
  groups: [
    {
      title: "Меню",
      items: [
        { id: "dashboard", label: "Главная", icon: LayoutDashboard },
        { id: "ratings", label: "Рейтинг", icon: Trophy },
        { id: "attendance", label: "Посещаемость", icon: CalendarDays },
        ...(BFF_DEV?[{id:"schedule",label:"Расписание",icon:CalendarDays}]:[]),
        { id: "homework", label: "Домашние задания", icon: NotebookPen },
        { id: "tests", label: "Тесты", icon: BarChart3 },
        { id: "exams", label: "Экзамены", icon: GraduationCap },
      ],
    },
  ],
};
