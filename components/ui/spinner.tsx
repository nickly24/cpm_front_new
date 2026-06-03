import { cn } from "@/lib/cn";
import styles from "./spinner.module.css";

export type SpinnerSize = "sm" | "md";

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  /** Для aria на родителе LoadingState; на самом спиннере скрыт от скринридеров */
  ariaHidden?: boolean;
}

export function Spinner({
  size = "md",
  className,
  ariaHidden = true,
}: SpinnerProps) {
  return (
    <span
      className={cn(styles.spinner, styles[size], className)}
      aria-hidden={ariaHidden ? true : undefined}
    />
  );
}
