"use client";

import styles from "@/components/student/tests/tests.module.css";
import { OptionSelect, type OptionSelectItem } from "@/components/ui/option-select";
import type { Direction } from "@/lib/student/tests-types";
import { BookOpen } from "lucide-react";
import { useMemo } from "react";

interface DirectionComboboxProps {
  directions: Direction[];
  value: string;
  onChange: (name: string) => void;
}

export function DirectionCombobox({
  directions,
  value,
  onChange,
}: DirectionComboboxProps) {
  const options = useMemo<OptionSelectItem<string>[]>(
    () =>
      directions.map((direction) => ({
        value: direction.name,
        label: direction.name,
        icon: BookOpen,
        tone: "accent",
      })),
    [directions],
  );

  return (
    <OptionSelect
      label="Направление"
      value={value}
      options={options}
      onChange={onChange}
      className={styles.directionSelect}
      dropdownClassName={styles.directionDropdown}
    />
  );
}
