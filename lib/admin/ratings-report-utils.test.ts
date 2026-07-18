import { describe, expect, it } from "vitest";
import type { RatingsReportStudent } from "@/lib/admin/ratings-report-types";
import {
  sortReportStudents,
  uniqueFilterOptions,
} from "@/lib/admin/ratings-report-utils";

function student(
  studentId: number,
  school: Pick<
    RatingsReportStudent,
    "school_id" | "school_name" | "school_short_name"
  >,
): RatingsReportStudent {
  return {
    student_id: studentId,
    rating_id: studentId,
    full_name: `Ученик ${studentId}`,
    class: 10,
    group_id: null,
    group_name: null,
    homework: 0,
    exams: 0,
    tests: 0,
    final: 0,
    ...school,
  };
}

describe("ratings report school labels", () => {
  it("uses the full school name when short_name is missing", () => {
    const options = uniqueFilterOptions([
      student(1, {
        school_id: 8,
        school_name: "ГБОУ Школа № 1448",
        school_short_name: null,
      }),
    ]);

    expect(options.schools).toEqual([
      { value: "8", label: "ГБОУ Школа № 1448" },
    ]);
  });

  it("prefers short_name and sorts by the displayed label", () => {
    const rows = [
      student(1, {
        school_id: 1,
        school_name: "Первая школа",
        school_short_name: "Школа Б",
      }),
      student(2, {
        school_id: 2,
        school_name: "Вторая школа",
        school_short_name: "Школа А",
      }),
    ];

    expect(sortReportStudents(rows, "school", "asc").map((row) => row.student_id)).toEqual([
      2,
      1,
    ]);
  });
});
