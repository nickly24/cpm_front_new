import type {
  HomeworkFilterOption,
} from "@/components/student/homework/homework-filter-select";
import type {
  HomeworkStatusFilter,
  HomeworkTypeFilter,
} from "@/lib/student/homework-types";
import {
  BookOpen,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Layers,
  SlidersHorizontal,
} from "lucide-react";

export const HOMEWORK_STATUS_FILTER_OPTIONS: HomeworkFilterOption<HomeworkStatusFilter>[] =
  [
    {
      value: "all",
      label: "Все статусы",
      hint: "Показать все задания",
      icon: SlidersHorizontal,
      tone: "neutral",
    },
    {
      value: "done",
      label: "Сдано",
      hint: "Только выполненные",
      icon: CheckCircle2,
      tone: "success",
    },
    {
      value: "undone",
      label: "Не сдано",
      hint: "Только невыполненные",
      icon: CircleDashed,
      tone: "warning",
    },
  ];

export const HOMEWORK_TYPE_FILTER_OPTIONS: HomeworkFilterOption<HomeworkTypeFilter>[] =
  [
    {
      value: "all",
      label: "Все типы",
      hint: "ОВ и ДЗНВ",
      icon: Layers,
      tone: "neutral",
    },
    {
      value: "ОВ",
      label: "ОВ",
      icon: BookOpen,
      tone: "accent",
    },
    {
      value: "ДЗНВ",
      label: "ДЗНВ",
      icon: ClipboardList,
      tone: "info",
    },
  ];
