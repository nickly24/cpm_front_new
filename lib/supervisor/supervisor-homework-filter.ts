import type { SupervisorOvHomeworkStudent } from "./supervisor-homework-api";
export function filterSupervisorHomeworkStudents(students: SupervisorOvHomeworkStudent[], query: string, classFilter = "all"): SupervisorOvHomeworkStudent[] {
  const name = query.trim().toLocaleLowerCase("ru");
  return students.filter(student => {
    const matchesClass = classFilter === "all" || (classFilter === "unknown" ? student.class === null : student.class !== null && String(student.class) === classFilter);
    return matchesClass && (!name || student.full_name.toLocaleLowerCase("ru").includes(name));
  });
}
