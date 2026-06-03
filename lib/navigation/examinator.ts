import { GraduationCap } from "lucide-react";
import type { RoleNavigation } from "./types";

export const examinatorNavigation: RoleNavigation = {
  brand: "CPM Examinator",
  groups: [
    {
      title: "Меню",
      items: [
        { id: "exams", label: "Проведение экзамена", icon: GraduationCap },
      ],
    },
  ],
};
