import type { HomeworkFilterOption } from "@/components/student/homework/homework-filter-select";
import type { TestStatusFilter } from "@/lib/student/tests-types";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe2,
  Layers,
  PlayCircle,
} from "lucide-react";

export const TESTS_STATUS_FILTER_OPTIONS: HomeworkFilterOption<TestStatusFilter>[] =
  [
    {
      value: "all",
      label: "Все",
      hint: "Все тесты направления",
      icon: Layers,
      tone: "neutral",
    },
    {
      value: "available",
      label: "Доступные",
      hint: "Можно сдать сейчас",
      icon: PlayCircle,
      tone: "success",
    },
    {
      value: "upcoming",
      label: "Скоро",
      hint: "Ещё не начались",
      icon: Clock,
      tone: "info",
    },
    { value: "running", label: "В процессе", hint: "Есть начатая попытка", icon: PlayCircle, tone: "info" },
    { value: "pending_upload", label: "Ожидают отправки", hint: "Время ответов истекло, отправка разрешена", icon: Clock, tone: "warning" },
    { value: "upload_window_closed", label: "Срок отправки истёк", hint: "Нужна помощь администратора", icon: AlertCircle, tone: "warning" },
    { value: "checking", label: "Проверка ответов", hint: "Ответы приняты, результат ожидается", icon: Clock, tone: "warning" },
    { value: "calculation_failed", label: "Ошибка проверки", hint: "Ответы сохранены", icon: AlertCircle, tone: "warning" },
    {
      value: "completed",
      label: "Сданные",
      hint: "Уже пройдены",
      icon: CheckCircle2,
      tone: "accent",
    },
    {
      value: "missed",
      label: "Пропущенные",
      hint: "Окно сдачи закрыто",
      icon: AlertCircle,
      tone: "warning",
    },
    {
      value: "external",
      label: "Вне системы",
      hint: "Проводились вне CPM",
      icon: Globe2,
      tone: "neutral",
    },
  ];
