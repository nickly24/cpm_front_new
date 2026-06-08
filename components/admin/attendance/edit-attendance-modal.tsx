"use client";

import attendanceStyles from "@/components/admin/attendance/admin-attendance.module.css";
import styles from "@/components/admin/tests/admin-tests.module.css";
import { Button } from "@/components/ui/button";
import { OptionSelect } from "@/components/ui/option-select";
import { setClassDayAttendance } from "@/lib/attendance/attendance-api";
import { buildAttendanceTypeOptions } from "@/lib/attendance/attendance-type-options";
import type {
  AttendanceType,
  ClassDayAttendanceItem,
} from "@/lib/attendance/attendance-types";
import { useMemo, useState } from "react";

interface EditAttendanceModalProps {
  classDayId: number;
  item: ClassDayAttendanceItem;
  types: AttendanceType[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function EditAttendanceModal({
  classDayId,
  item,
  types,
  onClose,
  onSaved,
}: EditAttendanceModalProps) {
  const [typeId, setTypeId] = useState(item.attendance_type_id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typeOptions = useMemo(() => buildAttendanceTypeOptions(types), [types]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await setClassDayAttendance(classDayId, {
        student_id: item.student_id,
        attendance_type_id: typeId,
        zap_id: item.zap_id,
      });

      if (result.status) {
        await onSaved();
        onClose();
        return;
      }

      setError(result.error ?? "Не удалось обновить");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={attendanceStyles.modalOverlay} onClick={onClose}>
      <form
        className={attendanceStyles.modal}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <h3 className={attendanceStyles.modalTitle}>Изменить посещение</h3>
        <p className={attendanceStyles.modalHint}>
          {item.full_name}
          <span className={attendanceStyles.studentIdMuted}> · ID {item.student_id}</span>
        </p>
        <OptionSelect
          label="Тип посещения"
          value={typeId}
          options={typeOptions}
          onChange={setTypeId}
          disabled={loading || typeOptions.length === 0}
          className={attendanceStyles.typeFieldWide}
          dropdownClassName={attendanceStyles.typeDropdown}
        />
        {error ? <p className={styles.errorText}>{error}</p> : null}
        <div className={attendanceStyles.modalActions}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </form>
    </div>
  );
}
