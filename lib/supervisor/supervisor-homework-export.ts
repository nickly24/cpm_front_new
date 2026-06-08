import type {
  SupervisorOvHomework,
  SupervisorOvHomeworkStudent,
} from "@/lib/supervisor/supervisor-homework-api";
import * as XLSX from "xlsx";

export function exportSupervisorOvHomeworkExcel(
  homeworks: SupervisorOvHomework[],
  students: SupervisorOvHomeworkStudent[],
  fileName: string,
): void {
  const header = [
    "ФИО",
    "Класс",
    "Группа",
    ...homeworks.map((homework) => homework.name),
  ];

  const rows = students.map((student) => {
    const resultByHomework = new Map(
      student.results.map((result) => [result.homework_id, result]),
    );
    return [
      student.full_name,
      student.class,
      student.group_name ?? "",
      ...homeworks.map((homework) => {
        const result = resultByHomework.get(homework.id);
        if (!result) {
          return "";
        }
        if (result.result != null) {
          return `${result.result}% · ${result.status_text}`;
        }
        return result.status_text;
      }),
    ];
  });

  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Домашние задания");
  XLSX.writeFile(workbook, fileName);
}
