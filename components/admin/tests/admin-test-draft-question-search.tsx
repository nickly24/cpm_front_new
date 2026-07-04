"use client";

import {
  searchDraftQuestions,
  splitTextByTokens,
  type DraftQuestionSearchResult,
} from "@/lib/admin/admin-test-draft-question-search";
import type { AdminTestQuestionType } from "@/lib/admin/admin-tests-types";
import type { DraftQuestionNode } from "@/lib/admin/admin-test-drafts-types";
import { CircleDot, ListChecks, Search, Type } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import styles from "@/components/admin/tests/admin-test-draft-editor.module.css";

const TYPE_ICONS: Record<AdminTestQuestionType, typeof CircleDot> = {
  single: CircleDot,
  multiple: ListChecks,
  text: Type,
};

function HighlightedText({
  text,
  tokens,
  className,
}: {
  text: string;
  tokens: string[];
  className?: string;
}) {
  const parts = useMemo(() => splitTextByTokens(text, tokens), [text, tokens]);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.highlight ? (
          <mark key={`${part.text}-${index}`} className={styles.questionSearchHighlight}>
            {part.text}
          </mark>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        ),
      )}
    </span>
  );
}

function truncateText(text: string, maxLength = 88) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function SearchOption({
  result,
  question,
  active,
  onMouseEnter,
  onSelect,
}: {
  result: DraftQuestionSearchResult;
  question: DraftQuestionNode;
  active: boolean;
  onMouseEnter: () => void;
  onSelect: () => void;
}) {
  const TypeIcon = TYPE_ICONS[question.type];

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      className={
        active
          ? `${styles.questionSearchOption} ${styles.questionSearchOptionActive}`
          : styles.questionSearchOption
      }
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={onMouseEnter}
      onClick={onSelect}
    >
      <span className={styles.questionSearchOptionMain}>
        <span className={styles.questionSearchOptionBadge}>Вопрос {result.index + 1}</span>
        <TypeIcon size={14} aria-hidden="true" className={styles.questionSearchOptionType} />
        <span className={styles.questionSearchOptionText}>
          <HighlightedText
            text={truncateText(result.questionText)}
            tokens={result.highlightTokens}
          />
        </span>
      </span>
      {result.matchedAnswers.length > 0 ? (
        <span className={styles.questionSearchOptionAnswer}>
          {result.matchedAnswers.slice(0, 2).map((match) => (
            <span key={match.answerId} className={styles.questionSearchOptionAnswerLine}>
              <HighlightedText text={match.snippet} tokens={match.highlightTokens} />
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
}

interface AdminTestDraftQuestionSearchProps {
  questions: DraftQuestionNode[];
  onSelect: (questionId: string) => void;
}

export function AdminTestDraftQuestionSearch({
  questions,
  onSelect,
}: AdminTestDraftQuestionSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(
    () => searchDraftQuestions(questions, query),
    [questions, query],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (questions.length === 0) {
    return null;
  }

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const showDropdown = isOpen && tokens.length > 0;

  const pickResult = (result: DraftQuestionSearchResult) => {
    setQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
    onSelect(result.questionId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      if (event.key === "ArrowDown" && tokens.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      pickResult(results[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div
      ref={containerRef}
      className={styles.questionSearch}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Search size={16} className={styles.questionSearchIcon} aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Поиск вопроса…"
        className={styles.questionSearchInput}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="draft-question-search-listbox"
        aria-autocomplete="list"
      />

      {showDropdown ? (
        <div
          id="draft-question-search-listbox"
          role="listbox"
          className={styles.questionSearchDropdown}
        >
          {results.length > 0 ? (
            results.map((result, index) => {
              const question = questions.find((item) => item.id === result.questionId);
              if (!question) return null;

              return (
                <SearchOption
                  key={result.questionId}
                  result={result}
                  question={question}
                  active={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onSelect={() => pickResult(result)}
                />
              );
            })
          ) : (
            <div className={styles.questionSearchEmpty}>Ничего не найдено</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
