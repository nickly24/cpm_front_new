"use client";

import { useState, type FormEvent } from "react";
import { useExamMutation, useExamResource } from "@/lib/exams-v2/hooks";
import type {
  Config,
  FractionalMode,
  HalfMode,
  Page,
  Part,
  Readiness,
  Scoring,
  SourceMode,
  Threshold,
  Validation,
} from "@/lib/exams-v2/types";
import {
  formatScore,
  fromMoscowInput,
  GRADES,
  thresholdError,
  toMoscowInput,
} from "@/lib/exams-v2/utils";
import {
  Action,
  ErrorNotice,
  Field,
  Loading,
  MutationNotice,
  ValidationList,
} from "./shared";
import s from "./exams.module.css";

export interface AdminPanelProps {
  examId: number;
  actor: string;
  canEdit: boolean;
  onChanged: () => void;
}
function PeriodForm({
  config,
  ...props
}: AdminPanelProps & { config: Config }) {
  const [start, setStart] = useState(toMoscowInput(config.startAt)),
    [end, setEnd] = useState(toMoscowInput(config.endAt));
  const mutation = useExamMutation<{ config: Config }>(
    `${props.actor}:period:${props.examId}`,
    props.onChanged,
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void mutation.execute({
      path: `/api/exams/${props.examId}/classic/config`,
      method: "PATCH",
      body: {
        startAt: fromMoscowInput(start),
        endAt: fromMoscowInput(end),
        expectedConfigVersion: config.configVersion,
      },
    });
  };
  return (
    <form data-exam-editor className={s.panel} onSubmit={submit}>
      <h2>Период проведения</h2>
      <p className={s.muted}>
        Московское время. Пустое поле можно сохранить и заполнить позже. Время
        ограничивает только старт — уже начатый экзамен можно завершить.
      </p>
      <div className={s.grid}>
        <Field label="Начало">
          <input
            type="datetime-local"
            className={s.input}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            disabled={!props.canEdit || mutation.busy}
          />
        </Field>
        <Field label="Окончание">
          <input
            type="datetime-local"
            className={s.input}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            disabled={!props.canEdit || mutation.busy}
          />
        </Field>
      </div>
      <MutationNotice mutation={mutation} reload={props.onChanged} />
      {props.canEdit && (
        <Action
          primary
          type="submit"
          disabled={mutation.busy || mutation.uncertain}
        >
          Сохранить период
        </Action>
      )}
    </form>
  );
}
export function ClassicSettings(props: AdminPanelProps) {
  const config = useExamResource<{
    config: Config;
    localValidation: Validation[];
  }>(`/api/exams/${props.examId}/classic/config`);
  const ready = useExamResource<{ readiness: Readiness }>(
    `/api/exams/${props.examId}/classic/readiness`,
  );
  const changed = () => {
    config.reload();
    ready.reload();
    props.onChanged();
  };
  const r = ready.data?.readiness;
  return (
    <div className={s.stack}>
      <div className={s.header}>
        <h2>Настройки экзамена</h2>
        <Action onClick={changed} disabled={config.loading}>
          Обновить настройки
        </Action>
      </div>
      <ErrorNotice error={config.error} reload={config.reload} />
      {config.loading && <Loading />}
      {config.data && (
        <>
          <PeriodForm
            key={config.data.config.configVersion}
            {...props}
            config={config.data.config}
            onChanged={changed}
          />
          <ValidationList items={config.data.localValidation} />
        </>
      )}
      <section className={s.panel}>
        <h2>Готовность к проведению</h2>
        <ErrorNotice error={ready.error} reload={ready.reload} />
        {ready.loading && <Loading />}
        {r && (
          <>
            <span
              className={
                r.ready || r.isReady || r.isConfigured ? s.success : s.warning
              }
            >
              {r.ready || r.isReady || r.isConfigured
                ? "Основные настройки заполнены"
                : "Проверьте настройки перед проведением"}
            </span>
            <ValidationList items={r.errors ?? r.reasons ?? r.issues} />
            <ValidationList items={r.warnings} />
            <p className={s.muted}>
              Достаточность банка для личного лимита замен проверяется отдельно
              для каждого назначения.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function ScoringForm({
  scoring,
  parts,
  ...props
}: AdminPanelProps & { scoring: Scoring; parts: Part[] }) {
  const [thresholds, setThresholds] = useState<Threshold[]>(
    GRADES.map(
      (grade) =>
        scoring.thresholds.find((t) => t.grade === grade) ?? {
          grade,
          minScore: grade,
        },
    ),
  );
  const [mode, setMode] = useState<FractionalMode>(
    scoring.fractionalMode ?? "round_up",
  );
  const [source, setSource] = useState<SourceMode>(
    scoring.tieBreakerSourceMode ?? "any_part",
  );
  const [partId, setPartId] = useState(
    scoring.tieBreakerPartId ? String(scoring.tieBreakerPartId) : "",
  );
  const [half, setHalf] = useState<HalfMode>(
    scoring.tieBreakerHalfMode ?? "repeat",
  );
  const mutation = useExamMutation<{ scoring: Scoring }>(
    `${props.actor}:scoring:${props.examId}`,
    props.onChanged,
  );
  const validation = thresholdError(thresholds, scoring.maxScore);
  return (
    <form
      data-exam-editor
      className={s.panel}
      onSubmit={(e) => {
        e.preventDefault();
        if (validation) return;
        void mutation.execute({
          path: `/api/exams/${props.examId}/classic/scoring`,
          method: "PUT",
          body: {
            thresholds,
            fractionalMode: mode,
            tieBreakerSourceMode: mode === "extra_question" ? source : null,
            tieBreakerPartId:
              mode === "extra_question" && source === "specific_part"
                ? Number(partId)
                : null,
            tieBreakerHalfMode: mode === "extra_question" ? half : null,
            expectedConfigVersion: scoring.configVersion,
          },
        });
      }}
    >
      <h2>Баллы и шкала оценок</h2>
      <div className={s.stats}>
        <div className={s.stat}>
          <span className={s.muted}>Минимум</span>
          <strong className={s.score}>0</strong>
        </div>
        <div className={s.stat}>
          <span className={s.muted}>Максимум по частям</span>
          <strong className={s.score}>{formatScore(scoring.maxScore)}</strong>
        </div>
      </div>
      <div className={s.grid}>
        {thresholds.map((threshold, index) => (
          <Field
            key={threshold.grade}
            label={`Оценка ${threshold.grade} — от баллов`}
            hint={`До ${index === 5 ? scoring.maxScore : thresholds[index + 1].minScore - 1} включительно`}
          >
            <input
              type="number"
              className={s.input}
              min={0}
              max={scoring.maxScore}
              step={1}
              required
              value={Number.isNaN(threshold.minScore) ? "" : threshold.minScore}
              disabled={!props.canEdit || index === 0 || mutation.busy}
              onChange={(e) =>
                setThresholds((items) =>
                  items.map((item, i) =>
                    i === index
                      ? {
                          ...item,
                          minScore:
                            e.target.value === ""
                              ? NaN
                              : Number(e.target.value),
                        }
                      : item,
                  ),
                )
              }
            />
          </Field>
        ))}
      </div>
      {validation && <p className={s.warning}>{validation}</p>}
      <hr className={s.separator} />
      <h3>Если итоговый балл дробный</h3>
      <Field label="Решение">
        <select
          className={s.select}
          value={mode}
          onChange={(e) => setMode(e.target.value as FractionalMode)}
          disabled={!props.canEdit || mutation.busy}
        >
          <option value="round_up">Округлить вверх</option>
          <option value="round_down">Округлить вниз</option>
          <option value="extra_question">Дополнительный вопрос</option>
        </select>
      </Field>
      {mode === "extra_question" && (
        <>
          <Field label="Источник дополнительного вопроса">
            <select
              className={s.select}
              value={source}
              onChange={(e) => setSource(e.target.value as SourceMode)}
              disabled={!props.canEdit || mutation.busy}
            >
              <option value="any_part">Случайно из любой части</option>
              <option value="specific_part">Из определённой части</option>
            </select>
          </Field>
          {source === "specific_part" && (
            <Field label="Часть">
              <select
                className={s.select}
                value={partId}
                onChange={(e) => setPartId(e.target.value)}
                required
                disabled={!props.canEdit || mutation.busy}
              >
                <option value="">Выберите часть</option>
                {parts.map((part) => (
                  <option key={part.id} value={part.id}>
                    {part.code}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Если дополнительный ответ оценён на 0,5">
            <select
              className={s.select}
              value={half}
              onChange={(e) => setHalf(e.target.value as HalfMode)}
              disabled={!props.canEdit || mutation.busy}
            >
              <option value="repeat">Ещё один дополнительный вопрос</option>
              <option value="round_up">Округлить вверх</option>
              <option value="round_down">Округлить вниз</option>
            </select>
          </Field>
          <p className={s.muted}>
            Ответ 1 округляет вверх, 0 — вниз. Дополнительный вопрос не
            увеличивает общий балл.
          </p>
        </>
      )}
      <MutationNotice mutation={mutation} reload={props.onChanged} />
      {props.canEdit && (
        <Action
          primary
          type="submit"
          disabled={mutation.busy || mutation.uncertain || Boolean(validation)}
        >
          Сохранить шкалу и правила
        </Action>
      )}
    </form>
  );
}
export function ClassicScoring(props: AdminPanelProps) {
  const resource = useExamResource<{
    scoring: Scoring;
    validation: Validation[];
  }>(`/api/exams/${props.examId}/classic/scoring`);
  const parts = useExamResource<Page<Part>>(
    `/api/exams/${props.examId}/classic/parts?limit=100`,
  );
  const changed = () => {
    resource.reload();
    parts.reload();
    props.onChanged();
  };
  return (
    <div className={s.stack}>
      <div className={s.header}>
        <h2>Шкала и спорный результат</h2>
        <Action onClick={changed}>Обновить шкалу</Action>
      </div>
      <ErrorNotice error={resource.error ?? parts.error} reload={changed} />
      {resource.loading && <Loading />}
      {resource.data && parts.data && (
        <ScoringForm
          key={resource.data.scoring.configVersion}
          {...props}
          scoring={resource.data.scoring}
          parts={parts.data.items}
          onChanged={changed}
        />
      )}
      <ValidationList items={resource.data?.validation} />
    </div>
  );
}
