import { NotebookPen, Users } from "lucide-react";
import type { RoleNavigation } from "./types";

export const proctorNavigation: RoleNavigation = {
  brand: "CPM Proctor",
  groups: [
    {
      title: "Меню",
      items: [
        { id: "homework", label: "Домашние задания", icon: NotebookPen },
        { id: "review-queue", label: "Очередь работ", icon: NotebookPen },
        { id: "students", label: "Список учеников", icon: Users },
      ],
    },
  ],
};
