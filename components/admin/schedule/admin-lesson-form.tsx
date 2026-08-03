"use client";

import styles from "@/components/schedule/schedule.module.css";
import { TimeField } from "@/components/schedule/time-field";
import { Button } from "@/components/ui/button";
import { DismissibleOverlay } from "@/components/ui/dismissible-overlay";
import { OptionSelect } from "@/components/ui/option-select";
import { Toggle } from "@/components/ui/toggle";
import type { AdminSchool } from "@/lib/admin/admin-schools-types";
import { SCHEDULE_PRESET_COLORS } from "@/lib/schedule/constants";
import type { ScheduleLessonFormData } from "@/lib/schedule/types";
import { createEmptyLessonForm } from "@/lib/schedule/utils";
import { Pipette, School } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";

interface LessonFormFieldsProps {
  form: ScheduleLessonFormData;
  setForm: Dispatch<SetStateAction<ScheduleLessonFormData>>;
  schools: AdminSchool[];
  error: string | null;
}

function LessonFormFields({
  form,
  setForm,
  schools,
  error,
}: LessonFormFieldsProps) {
  const update = <K extends keyof ScheduleLessonFormData>(
    key: K,
    value: ScheduleLessonFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const schoolOptions = useMemo(
    () => [
      {
        value: 0,
        label: "Выберите школу",
        hint: "Обязательно для внутришкольного занятия",
        icon: School,
        tone: "neutral" as const,
      },
      ...schools.map((school) => ({
        value: school.school_id,
        label: school.short_name || school.name,
        hint:
          school.short_name && school.short_name !== school.name
            ? school.name
            : undefined,
        icon: School,
        tone: "info" as const,
      })),
    ],
    [schools],
  );

  const colorUpper = form.color.toUpperCase();
  const isCustomColor = !(SCHEDULE_PRESET_COLORS as readonly string[]).includes(
    colorUpper,
  );

  return (
    <div className={styles.formGrid}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Дата</span>
        <input
          type="date"
          className={styles.fieldInput}
          value={form.date}
          onChange={(event) => update("date", event.target.value)}
          required
        />
      </label>

      <div className={styles.fieldRow}>
        <TimeField
          label="Начало"
          value={form.start_time}
          onChange={(value) => update("start_time", value)}
          required
        />
        <TimeField
          label="Конец"
          value={form.end_time}
          onChange={(value) => update("end_time", value)}
          required
        />
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Предмет</span>
        <input
          className={styles.fieldInput}
          value={form.lesson_name}
          onChange={(event) => update("lesson_name", event.target.value)}
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Преподаватель</span>
        <input
          className={styles.fieldInput}
          value={form.teacher_name}
          onChange={(event) => update("teacher_name", event.target.value)}
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Локация (вуз)</span>
        <input
          className={styles.fieldInput}
          value={form.location}
          onChange={(event) => update("location", event.target.value)}
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Аудитория</span>
        <input
          className={styles.fieldInput}
          value={form.classroom}
          onChange={(event) => update("classroom", event.target.value)}
          placeholder="301А"
          required
        />
      </label>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Цвет карточки</span>
        <div className={styles.colorRow}>
          {SCHEDULE_PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`${styles.colorSwatch} ${colorUpper === color ? styles.colorSwatchActive : ""}`}
              style={{ background: color }}
              aria-label={`Цвет ${color}`}
              onClick={() => update("color", color)}
            />
          ))}
          <label
            className={`${styles.colorPickerBtn} ${isCustomColor ? styles.colorPickerBtnActive : ""}`}
            title="Свой цвет"
          >
            <span
              className={styles.colorPickerPreview}
              style={{ background: form.color }}
            />
            <Pipette size={14} strokeWidth={2.25} />
            <input
              type="color"
              className={styles.colorNativeHidden}
              value={/^#[0-9A-Fa-f]{6}$/.test(form.color) ? form.color : "#5B8DEF"}
              onChange={(event) =>
                update("color", event.target.value.toUpperCase())
              }
              aria-label="Свой цвет"
            />
          </label>
        </div>
      </div>

      <div className={styles.toggleStack}>
        <div className={styles.toggleCard}>
          <div className={styles.toggleCardText}>
            <span className={styles.toggleCardTitle}>Очное занятие</span>
            <span className={styles.toggleCardHint}>
              Выкл. — дистанционно (онлайн)
            </span>
          </div>
          <Toggle
            checked={form.is_in_person}
            onChange={(checked) => update("is_in_person", checked)}
            variant="accent"
          />
        </div>

        <div className={styles.toggleCard}>
          <div className={styles.toggleCardText}>
            <span className={styles.toggleCardTitle}>Для всех</span>
            <span className={styles.toggleCardHint}>
              Выкл. — частично (кто именно — вне сервиса)
            </span>
          </div>
          <Toggle
            checked={form.is_for_all}
            onChange={(checked) => update("is_for_all", checked)}
            variant="accent"
          />
        </div>

        <div className={styles.toggleCard}>
          <div className={styles.toggleCardText}>
            <span className={styles.toggleCardTitle}>Расписание изменено</span>
            <span className={styles.toggleCardHint}>
              Пометит карточку бейджем «Изменено»
            </span>
          </div>
          <Toggle
            checked={form.is_changed}
            onChange={(checked) => update("is_changed", checked)}
            variant="accent"
          />
        </div>

        <div className={styles.toggleCard}>
          <div className={styles.toggleCardText}>
            <span className={styles.toggleCardTitle}>Общее занятие</span>
            <span className={styles.toggleCardHint}>
              Видно всем школам в календаре «Общие»
            </span>
          </div>
          <Toggle
            checked={form.is_public}
            onChange={(isPublic) => {
              setForm((prev) => ({
                ...prev,
                is_public: isPublic,
                school_id: isPublic ? null : prev.school_id,
              }));
            }}
            variant="success"
          />
        </div>
      </div>

      {!form.is_public ? (
        <OptionSelect
          label="Школа"
          value={form.school_id ?? 0}
          options={schoolOptions}
          onChange={(schoolId) =>
            update("school_id", schoolId === 0 ? null : schoolId)
          }
          className={styles.schoolSelect}
        />
      ) : null}

      {error ? <div className={styles.formError}>{error}</div> : null}
    </div>
  );
}

interface AdminLessonFormProps {
  mode: "create" | "edit";
  initialData?: ScheduleLessonFormData;
  defaultDate?: string;
  schools: AdminSchool[];
  variant: "inspector" | "sheet";
  onClose: () => void;
  onSubmit: (data: ScheduleLessonFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCollapse?: () => void;
}

export function AdminLessonForm({
  mode,
  initialData,
  defaultDate,
  schools,
  variant,
  onClose,
  onSubmit,
  onDelete,
  onCollapse,
}: AdminLessonFormProps) {
  const [form, setForm] = useState<ScheduleLessonFormData>(
    initialData ?? createEmptyLessonForm(defaultDate),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initialData ?? createEmptyLessonForm(defaultDate));
    setError(null);
  }, [initialData, defaultDate, mode]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (!form.is_public && !form.school_id) {
        throw new Error("Выберите школу для внутришкольного занятия");
      }
      await onSubmit({
        ...form,
        school_id: form.is_public ? null : form.school_id,
        color: form.color.toUpperCase(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSubmitting(false);
    }
  };

  const body = (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <div className={styles.inspectorHeader}>
        <h3 className={styles.inspectorTitle}>
          {mode === "create" ? "Новое занятие" : "Редактирование"}
        </h3>
        <div className={styles.inspectorHeaderActions}>
          {variant === "inspector" && onCollapse ? (
            <button
              type="button"
              className={styles.panelToggleBtn}
              aria-label="Свернуть панель"
              title="Свернуть"
              onClick={onCollapse}
            >
              ›
            </button>
          ) : null}
          <button
            type="button"
            className={styles.panelToggleBtn}
            aria-label="Закрыть"
            title="Закрыть"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>
      <LessonFormFields
        form={form}
        setForm={setForm}
        schools={schools}
        error={error}
      />
      <div className={styles.formActions}>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Сохранение…" : "Сохранить"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={submitting}
        >
          Отмена
        </Button>
        {mode === "edit" && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() => void onDelete()}
          >
            Удалить
          </Button>
        ) : null}
      </div>
    </form>
  );

  if (variant === "inspector") {
    return (
      <div className={`${styles.inspector} ${styles.inspectorEmbed}`}>
        {body}
      </div>
    );
  }

  return (
    <DismissibleOverlay className={styles.sheetOverlay} onDismiss={onClose}>
      <div
        className={styles.sheetPanel}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.sheetHandle} />
        {body}
      </div>
    </DismissibleOverlay>
  );
}

export function AdminInspectorIdle({
  selectedDate,
  onCollapse,
}: {
  selectedDate: string;
  onCollapse?: () => void;
}) {
  return (
    <div className={`${styles.inspector} ${styles.inspectorEmbed}`}>
      <div className={styles.inspectorHeader}>
        <h3 className={styles.inspectorTitle}>Занятие</h3>
        {onCollapse ? (
          <button
            type="button"
            className={styles.panelToggleBtn}
            aria-label="Свернуть панель"
            title="Свернуть"
            onClick={onCollapse}
          >
            ›
          </button>
        ) : null}
      </div>
      <p className={styles.inspectorEmpty}>
        Выберите занятие в календаре
        <br />
        или нажмите «Добавить»
        <br />
        <span style={{ opacity: 0.7 }}>({selectedDate})</span>
      </p>
    </div>
  );
}
