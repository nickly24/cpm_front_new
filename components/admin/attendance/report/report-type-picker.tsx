"use client";

import reportStyles from "@/components/admin/attendance/report/report.module.css";
import { REPORT_PALETTE_CLASS } from "@/components/admin/attendance/report/report-palette-classes";
import { cn } from "@/lib/cn";
import {
  getAttendanceCellMark,
  getAttendancePalette,
} from "@/lib/attendance/attendance-palette";
import type { AttendanceType } from "@/lib/attendance/attendance-types";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

interface ReportTypePickerProps {
  types: AttendanceType[];
  value: number;
  onChange: (id: number) => void;
  inactive?: boolean;
  disabled?: boolean;
}

export function ReportTypePicker({
  types,
  value,
  onChange,
  inactive = false,
  disabled = false,
}: ReportTypePickerProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const sorted = [...types].sort((a, b) => a.sort_order - b.sort_order);
  const selected = sorted.find((type) => type.id === value) ?? sorted[0];
  const selectedCode = selected?.code ?? "in_person";
  const selectedPalette = getAttendancePalette(selectedCode);
  const selectedMark = getAttendanceCellMark(selectedCode);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn(
        reportStyles.typePickerWrap,
        inactive && reportStyles.typePickerInactive,
      )}
    >
      <button
        type="button"
        className={reportStyles.typePickerBtn}
        title={selected?.name_ru ?? "Тип отметки"}
        aria-haspopup="listbox"
        aria-expanded={open && !inactive}
        aria-controls={listboxId}
        disabled={disabled || inactive || sorted.length === 0}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span
          className={cn(
            reportStyles.typePickerSwatch,
            REPORT_PALETTE_CLASS[selectedPalette],
          )}
        >
          {selectedMark ? (
            <span
              className={cn(
                reportStyles.typePickerMark,
                selectedMark.length > 1 && reportStyles.cellMarkWide,
              )}
            >
              {selectedMark}
            </span>
          ) : null}
        </span>
        <span className={reportStyles.typePickerCaption}>Тип</span>
        <ChevronDown size={14} aria-hidden />
      </button>

      {open && !inactive ? (
        <ul
          id={listboxId}
          className={reportStyles.typePickerMenu}
          role="listbox"
          aria-label="Тип отметки"
        >
          {sorted.map((type) => {
            const palette = getAttendancePalette(type.code);
            const mark = getAttendanceCellMark(type.code);
            const active = type.id === value;
            return (
              <li key={type.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    reportStyles.typePickerOption,
                    active && reportStyles.typePickerOptionActive,
                  )}
                  onClick={() => {
                    onChange(type.id);
                    setOpen(false);
                  }}
                >
                  <span
                    className={cn(
                      reportStyles.typePickerSwatch,
                      REPORT_PALETTE_CLASS[palette],
                    )}
                  >
                    {mark ? (
                      <span
                        className={cn(
                          reportStyles.typePickerMark,
                          mark.length > 1 && reportStyles.cellMarkWide,
                        )}
                      >
                        {mark}
                      </span>
                    ) : null}
                  </span>
                  <span className={reportStyles.typePickerOptionLabel}>
                    {type.name_ru}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
