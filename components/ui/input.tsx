import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ className, label, error, id, ...props }: InputProps) {
  const inputId = id ?? props.name;

  return (
    <div className="ds-field">
      {label ? (
        <label htmlFor={inputId} className="ds-label">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={cn("ds-input", className)}
        {...props}
      />
      {error ? <span className="ds-field-error">{error}</span> : null}
    </div>
  );
}
