import { Archive, NotebookPen, Trophy, Users, CalendarDays, QrCode } from "lucide-react";
import type { RoleNavigation } from "./types";
import { BFF_DEV } from "@/lib/config";

export const proctorNavigation: RoleNavigation = {
  brand: "CPM Proctor",
  groups: [
    {
      title: "Меню",
      items: [
        { id: "homework", label: "Домашние задания", icon: NotebookPen },
        { id: "review-queue", label: "Очередь работ", icon: NotebookPen },
        { id: "homework-archive", label: "Архив работ", icon: Archive },
        { id: "students", label: "Список учеников", icon: Users },
        ...(BFF_DEV ? [{ id: "ratings", label: "Рейтинг", icon: Trophy },{id:"schedule",label:"Расписание",icon:CalendarDays},{id:"attendance",label:"Посещаемость",icon:CalendarDays},{id:"scan",label:"Сканирование",icon:QrCode}] : []),
      ],
    },
  ],
};
