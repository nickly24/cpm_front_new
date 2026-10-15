"use client";

import styles from "@/components/student/training/student-training.module.css";
import { FilterPopover } from "@/components/ui/filter-popover";
import { LoadingState } from "@/components/ui/loading-state";
import { fetchTrainingSectionsByDirection } from "@/lib/training/training-api";
import type {
  SectionKind,
  TrainingDirection,
  TrainingSectionNode,
} from "@/lib/training/training-types";
import { calcProgressPercent, getProgressLabel } from "@/lib/training/training-utils";
import { BFF_DEV } from "@/lib/config";
import { cn } from "@/lib/cn";
import { examPeriod } from "@/lib/training/exam-training";
import { ClipboardList, FileText, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface TrainingSectionsListViewProps {
  directions: TrainingDirection[];
  direction: TrainingDirection;
  selectedDirectionId: number;
  onSelectDirection: (directionId: number) => void;
  studentId: number;
  loading: boolean;
  error: string | null;
  onSelectSection: (section: TrainingSectionNode) => void;
}

export function TrainingSectionsListView({
  directions,
  direction,
  selectedDirectionId,
  onSelectDirection,
  studentId,
  loading,
  error,
  onSelectSection,
}: TrainingSectionsListViewProps) {
  const PAGE_SIZE = 12;
  const router=useRouter(), pathname=usePathname(), query=useSearchParams();
  const queryString=query.toString();
  const searchTerm=query.get("search")??"";
  const kindFilter=(["manual","test","exam"].includes(query.get("kind")??"")?query.get("kind"):"all") as SectionKind|"all";
  const progressFilter=(["learned","in_progress"].includes(query.get("progress")??"")?query.get("progress"):"all") as "all"|"in_progress"|"learned";
  const rawPage=Number(query.get("page")??1), page=Number.isInteger(rawPage)&&rawPage>0?rawPage:1;
  const update=(values:Record<string,string|null>)=>{
    const next=new URLSearchParams(queryString);
    for(const [key,value] of Object.entries(values)){if(value===null||value===""||value==="all")next.delete(key);else next.set(key,value)}
    router.replace(`${pathname}${next.size?`?${next}`:""}`,{scroll:false});
  };
  const setSearchTerm=(value:string)=>update({search:value,page:null});
  const setKindFilter=(value:SectionKind|"all")=>update({kind:value,page:null});
  const setProgressFilter=(value:"all"|"in_progress"|"learned")=>update({progress:value,page:null});
  const setPage=(value:number|((v:number)=>number))=>update({page:String(typeof value==="function"?value(page):value)});
  const requestKey=`${studentId}:${direction.id}:${queryString}`;
  const [reload,setReload]=useState(0);
  const [result,setResult]=useState<{key:string;sections:TrainingSectionNode[];pages:number;total:number;error:string|null}|null>(null);
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    const timer=setTimeout(()=>{
      fetchTrainingSectionsByDirection(studentId,direction.id,{page,limit:PAGE_SIZE,search:searchTerm,kind:kindFilter,progress:progressFilter},controller.signal).then(response=>{
        if(active)setResult({key:requestKey,sections:response.sections,pages:response.pagination.pages,total:response.pagination.total,error:null});
      },err=>{if(active)setResult({key:requestKey,sections:[],pages:1,total:0,error:err instanceof Error?err.message:"Ошибка загрузки"})});
    },searchTerm?300:0);
    return()=>{active=false;clearTimeout(timer);controller.abort()};
  },[studentId,direction.id,page,searchTerm,kindFilter,progressFilter,requestKey,reload]);
  const current=result?.key===requestKey?result:null;
  const sections=current?.sections??[],sectionsLoading=!current,sectionsError=current?.error??null,totalPages=current?.pages??1,totalItems=current?.total??0;

  if (loading) {
    return <LoadingState label="Загрузка разделов…" variant="panel" />;
  }

  if (error) {
    return <p className={styles.alert}>{error}</p>;
  }

  return (
    <div className={styles.sectionsCatalog}>
      <div className={styles.sectionsDirections} role="group" aria-label="Направление">
        {directions.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              styles.sectionsFilterChip,
              selectedDirectionId === item.id && styles.sectionsFilterChipActive,
            )}
            aria-pressed={selectedDirectionId === item.id}
            onClick={() => onSelectDirection(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className={styles.sectionsCatalogHeader}>
        <label className={styles.sectionsSearch}>
          <Search size={18} aria-hidden />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Найти раздел"
            aria-label="Найти раздел"
          />
        </label>
        <FilterPopover
          activeCount={Number(kindFilter !== "all") + Number(progressFilter !== "all")}
          onReset={() => update({kind:null,progress:null,page:null})}
        >
          <p className={styles.sectionsPopoverLabel}>Тип</p>
          <div className={styles.sectionsFilterRow}>
            {([
              ["all", "Все"],
              ["manual", "Только карточки"],
              ["test", "Только тесты"],
              ["exam", "Из экзаменов"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  styles.sectionsFilterChip,
                  kindFilter === value && styles.sectionsFilterChipActive,
                )}
                aria-pressed={kindFilter === value}
                onClick={() => setKindFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className={styles.sectionsPopoverLabel}>Прогресс</p>
          <div className={styles.sectionsFilterRow}>
            {([
              ["all", "Все"],
              ["in_progress", "Есть что учить"],
              ["learned", "Полностью выучено"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  styles.sectionsFilterChip,
                  progressFilter === value && styles.sectionsFilterChipActive,
                )}
                aria-pressed={progressFilter === value}
                onClick={() => setProgressFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </FilterPopover>
      </div>

      <div className={styles.sectionsList}>
        {sections.map((section) => {
          const staleCount = section.answer_changed_cards ?? 0;
          const showSourceTest =
            section.kind === "test" &&
            section.sourceTestTitle &&
            section.sourceTestTitle.trim() !== section.name.trim();

          const progressPercent = BFF_DEV ? section.progress_percent : calcProgressPercent(
            section.learned_cards,
            section.total_cards,
          );
          const progressWidth =
            progressPercent > 0 ? Math.max(progressPercent, 3) : 0;

          return (
            <div
              key={`${section.kind}:${section.refId}`}
              role="button"
              tabIndex={0}
              className={styles.sectionListItem}
              onClick={() => onSelectSection(section)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectSection(section);
                }
              }}
            >
              <div className={styles.sectionListItemHead}>
                <span
                  className={cn(
                    styles.sectionKindBadge,
                    section.kind === "test" && styles.sectionKindBadgeTest,
                  )}
                >
                  {section.kind === "test" ? (
                    <ClipboardList size={12} aria-hidden />
                  ) : (
                    <FileText size={12} aria-hidden />
                  )}
                  {section.kind === "exam" ? "Из экзамена" : section.kind === "test" ? "Из теста" : "Свои карточки"}
                </span>
                <span className={styles.sectionListItemPercent}>
                  {progressPercent}%
                </span>
              </div>

              <h3 className={styles.sectionListItemTitle}>{section.name}</h3>
              {section.kind === "exam" ? <p className={styles.sectionListItemSource}>Экзамен №{section.exam_id ?? section.refId} · {examPeriod(section.start_at, section.end_at)} · Частей: {section.parts_count ?? 0}</p> : null}

              {showSourceTest ? (
                <p className={styles.sectionListItemSource}>
                  Тест: {section.sourceTestTitle}
                </p>
              ) : null}

              <p className={styles.sectionListItemMeta}>
                <span>
                  {section.learned_cards} из {section.total_cards} выучено
                </span>
                <span className={styles.sectionListItemDot} aria-hidden>
                  ·
                </span>
                  <span>{getProgressLabel(progressPercent, section.total_cards > 0 && section.learned_cards === section.total_cards)}</span>
                {staleCount > 0 ? (
                  <>
                    <span className={styles.sectionListItemDot} aria-hidden>
                      ·
                    </span>
                    <span className={styles.sectionListItemStale}>
                      {staleCount} с новым ответом
                    </span>
                  </>
                ) : null}
              </p>

              <div
                className={styles.batchRowTrack}
                style={{ height: 8, width: "100%" }}
              >
                <div
                  className={styles.batchRowFill}
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {sectionsError ? <div><p className={styles.alert} role="alert">{sectionsError}</p><button onClick={()=>{setResult(null);setReload(v=>v+1)}}>Повторить загрузку</button></div> : null}
      {sectionsLoading ? (
        <LoadingState label="Загрузка разделов…" variant="inline" />
      ) : null}
      {totalItems > 0 ? <div className={styles.sectionsPagination}>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
        >
          Назад
        </button>
        <span>
          {page} / {totalPages} · Разделов: {totalItems}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
        >
          Далее
        </button>
      </div> : null}

      {!sectionsLoading && !sectionsError && totalItems === 0 ? (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>Разделы не найдены</h2>
          <p className={styles.emptyText}>
            Попробуйте изменить фильтры или строку поиска.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated use TrainingSectionsListView */
export const TrainingTopicsView = TrainingSectionsListView;
