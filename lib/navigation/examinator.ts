import { GraduationCap,CalendarDays } from "lucide-react";
import {BFF_DEV} from "@/lib/config";
import type { RoleNavigation } from "./types";

export const examinatorNavigation: RoleNavigation = {
  brand: "CPM Examinator",
  groups: [
    {
      title: "Меню",
      items: [
        { id: "exams", label: "Проведение экзамена", icon: GraduationCap },
        ...(BFF_DEV?[{id:"schedule",label:"Расписание",icon:CalendarDays}]:[]),
      ],
    },
  ],
};
