import { CalendarDays, ClipboardList, Trophy } from "lucide-react";
import type { RoleNavigation } from "./types";

export const supervisorNavigation: RoleNavigation = {
  brand: "CPM Supervisor",
  groups: [
    {
      title: "Меню",
      items: [
        { id: "ratings", label: "Рейтинг", icon: Trophy },
        { id: "homework-table", label: "Таблица ОВ", icon: ClipboardList },
        { id: "attendance", label: "Посещаемость", icon: CalendarDays },
      ],
    },
  ],
};
