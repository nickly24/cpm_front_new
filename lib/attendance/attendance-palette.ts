/** Логическая палитра ячеек журнала (группы цветов). */
export type AttendancePalette =
  | "present"
  | "excused"
  | "remoteA"
  | "remoteB"
  | "remoteC"
  | "late"
  | "joined"
  | "hybrid";

export const ATTENDANCE_PALETTE_BY_CODE: Record<string, AttendancePalette> = {
  in_person: "present",
  absent_valid: "excused",
  remote_permanent: "remoteA",
  remote_scheduled: "remoteB",
  remote_valid: "remoteC",
  late: "late",
  joined_later: "joined",
  hybrid: "hybrid",
};

export const ATTENDANCE_CELL_MARK: Record<string, string | null> = {
  in_person: null,
  absent_valid: "У",
  remote_permanent: "Д",
  remote_scheduled: "Д",
  remote_valid: "Д",
  late: "О",
  joined_later: "П",
  hybrid: "ОД",
};

export function getAttendancePalette(typeCode: string): AttendancePalette {
  return ATTENDANCE_PALETTE_BY_CODE[typeCode] ?? "present";
}

export function getAttendanceCellMark(typeCode: string): string | null {
  return ATTENDANCE_CELL_MARK[typeCode] ?? null;
}
