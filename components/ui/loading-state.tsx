import { cn } from "@/lib/cn";
import { Spinner, type SpinnerSize } from "@/components/ui/spinner";
import styles from "./loading-state.module.css";

export type LoadingStateVariant =
  | "screen"
  | "block"
  | "inline"
  | "panel"
  | "compact";

interface LoadingStateProps {
  label?: string;
  variant?: LoadingStateVariant;
  size?: SpinnerSize;
  className?: string;
}

export function LoadingState({
  label = "Загрузка…",
  variant = "block",
  size,
  className,
}: LoadingStateProps) {
  const spinnerSize: SpinnerSize =
    size ?? (variant === "inline" ? "sm" : "md");

  return (
    <div
      className={cn(styles.root, styles[variant], className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Spinner size={spinnerSize} />
      {label ? <p className={styles.label}>{label}</p> : null}
    </div>
  );
}
