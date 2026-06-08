import reportStyles from "@/components/admin/attendance/report/report.module.css";
import {
  getAttendancePalette,
  type AttendancePalette,
} from "@/lib/attendance/attendance-palette";

export const REPORT_PALETTE_CLASS: Record<AttendancePalette, string> = {
  present: reportStyles.palettePresent,
  excused: reportStyles.paletteExcused,
  remoteA: reportStyles.paletteRemoteA,
  remoteB: reportStyles.paletteRemoteB,
  remoteC: reportStyles.paletteRemoteC,
  late: reportStyles.paletteLate,
  joined: reportStyles.paletteJoined,
  hybrid: reportStyles.paletteHybrid,
};

export function paletteClassForCode(typeCode: string): string {
  return REPORT_PALETTE_CLASS[getAttendancePalette(typeCode)];
}
