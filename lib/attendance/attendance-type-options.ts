import type { OptionSelectItem } from "@/components/ui/option-select";
import type { AttendanceType } from "@/lib/attendance/attendance-types";
import {
  Clock3,
  Laptop,
  MonitorSmartphone,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Video,
  Wifi,
} from "lucide-react";

export {
  ATTENDANCE_CELL_MARK,
  getAttendanceCellMark,
  getAttendancePalette,
} from "@/lib/attendance/attendance-palette";

/** Тип по умолчанию для новой отметки (очное присутствие). */
export function getDefaultAttendanceTypeId(
  types: AttendanceType[],
): number | null {
  const inPerson = types.find((type) => type.code === "in_person");
  if (inPerson) return inPerson.id;
  const sorted = [...types].sort(
    (left, right) => left.sort_order - right.sort_order,
  );
  return sorted[0]?.id ?? null;
}

export const ATTENDANCE_TYPE_META: Record<
  string,
  Pick<OptionSelectItem<number>, "icon" | "tone" | "hint">
> = {
  in_person: {
    icon: UserCheck,
    tone: "success",
    hint: "Очно на занятии",
  },
  absent_valid: {
    icon: ShieldCheck,
    tone: "success",
    hint: "Уважительная причина",
  },
  remote_permanent: {
    icon: Wifi,
    tone: "info",
    hint: "Постоянно дистанционно",
  },
  remote_scheduled: {
    icon: Video,
    tone: "info",
    hint: "По расписанию онлайн",
  },
  remote_valid: {
    icon: Laptop,
    tone: "info",
    hint: "Дистанционно, уважительно",
  },
  late: {
    icon: Clock3,
    tone: "warning",
    hint: "Пришёл с опозданием",
  },
  joined_later: {
    icon: UserPlus,
    tone: "accent",
    hint: "Начал обучение позже",
  },
  hybrid: {
    icon: MonitorSmartphone,
    tone: "info",
    hint: "Очно + дистанционно (ОД)",
  },
};

export function buildAttendanceTypeOptions(
  types: AttendanceType[],
): OptionSelectItem<number>[] {
  return [...types]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((type) => {
      const meta = ATTENDANCE_TYPE_META[type.code] ?? {
        icon: UserCheck,
        tone: "neutral" as const,
      };

      return {
        value: type.id,
        label: type.name_ru,
        icon: meta.icon,
        tone: meta.tone,
        hint: meta.hint,
      };
    });
}
