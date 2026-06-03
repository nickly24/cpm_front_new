"use client";

import type { UserRole } from "@/lib/auth/types";
import {
  filterSections,
  getSearchableSections,
  type SearchableSection,
} from "@/lib/navigation/search";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

interface SectionSearchProps {
  role: UserRole;
}

export function SectionSearch({ role }: SectionSearchProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const sections = useMemo(() => getSearchableSections(role), [role]);
  const results = useMemo(
    () => filterSections(sections, query),
    [query, sections],
  );

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
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openSection = (section: SearchableSection) => {
    setQuery("");
    setIsOpen(false);
    router.push(section.href);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (event.key === "ArrowDown" || event.key === "Enter") {
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
      openSection(results[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="cabinet-search" ref={containerRef}>
      <Search size={18} className="cabinet-search-icon" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Поиск раздела..."
        className="cabinet-search-input"
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="section-search-listbox"
        aria-autocomplete="list"
      />

      {isOpen ? (
        <div className="cabinet-search-dropdown" id="section-search-listbox" role="listbox">
          {results.length > 0 ? (
            results.map((section, index) => {
              const Icon = section.icon;

              return (
                <button
                  key={section.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={
                    index === activeIndex
                      ? "cabinet-search-option is-active"
                      : "cabinet-search-option"
                  }
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => openSection(section)}
                >
                  <span className="cabinet-search-option-icon">
                    <Icon size={18} />
                  </span>
                  <span className="cabinet-search-option-text">
                    <span className="cabinet-search-option-label">
                      {section.label}
                    </span>
                    <span className="cabinet-search-option-meta">
                      {section.groupTitle}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <div className="cabinet-search-empty">Разделы не найдены</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
