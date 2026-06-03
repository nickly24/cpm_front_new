"use client";

import styles from "@/components/student/tests/tests.module.css";
import type { Direction } from "@/lib/student/tests-types";
import { BookOpen } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

interface DirectionComboboxProps {
  directions: Direction[];
  value: string;
  onChange: (name: string) => void;
}

function filterDirections(directions: Direction[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return directions;
  }

  return directions.filter((direction) =>
    direction.name.toLowerCase().includes(normalized),
  );
}

export function DirectionCombobox({
  directions,
  value,
  onChange,
}: DirectionComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const options = useMemo(
    () => filterDirections(directions, query),
    [directions, query],
  );

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setQuery(value);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const selectDirection = (name: string) => {
    onChange(name);
    setQuery(name);
    setIsOpen(false);
  };

  const commitQuery = () => {
    const exact = directions.find(
      (direction) => direction.name.toLowerCase() === query.trim().toLowerCase(),
    );

    if (exact) {
      selectDirection(exact.name);
      return;
    }

    if (options[activeIndex]) {
      selectDirection(options[activeIndex].name);
      return;
    }

    setQuery(value);
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (event.key === "ArrowDown" || event.key === "Enter")) {
      setIsOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, options.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      commitQuery();
      return;
    }

    if (event.key === "Escape") {
      setQuery(value);
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className={styles.comboboxField} ref={containerRef}>
      <span className={styles.fieldLabel}>Направление</span>

      <div className={styles.comboboxWrap}>
        <BookOpen size={15} className={styles.comboboxIcon} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              if (!containerRef.current?.contains(document.activeElement)) {
                setQuery(value);
                setIsOpen(false);
              }
            }, 120);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Начните вводить направление..."
          className={styles.comboboxInput}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          autoComplete="off"
        />
      </div>

      {isOpen && options.length > 0 ? (
        <div className={styles.comboboxDropdown} role="listbox">
          {options.map((direction, index) => (
            <button
              key={direction.id}
              type="button"
              role="option"
              aria-selected={direction.name === value}
              className={`${styles.comboboxOption} ${
                index === activeIndex ? styles.comboboxOptionActive : ""
              } ${direction.name === value ? styles.comboboxOptionSelected : ""}`.trim()}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectDirection(direction.name)}
            >
              <BookOpen size={14} />
              {direction.name}
            </button>
          ))}
        </div>
      ) : null}

      {isOpen && query.trim() && options.length === 0 ? (
        <div className={styles.comboboxEmpty}>Направления не найдены</div>
      ) : null}
    </div>
  );
}
