"use client";

import {
  OptionSelect,
  type OptionSelectItem,
  type OptionTone,
} from "@/components/ui/option-select";

export type FilterOptionTone = OptionTone;
export type HomeworkFilterOption<T extends string> = OptionSelectItem<T>;

interface HomeworkFilterSelectProps<T extends string> {
  label: string;
  value: T;
  options: HomeworkFilterOption<T>[];
  onChange: (value: T) => void;
}

export function HomeworkFilterSelect<T extends string>(
  props: HomeworkFilterSelectProps<T>,
) {
  return <OptionSelect {...props} />;
}
