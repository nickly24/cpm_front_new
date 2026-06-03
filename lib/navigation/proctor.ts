import { ClipboardList, NotebookPen } from "lucide-react";
import type { RoleNavigation } from "./types";

export const proctorNavigation: RoleNavigation = {
  brand: "CPM Proctor",
  groups: [
    {
      title: "Меню",
      items: [
        { id: "homework", label: "Домашние задания", icon: NotebookPen },
        { id: "ov-table", label: "Таблица ОВ", icon: ClipboardList },
      ],
    },
  ],
};
