import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

export function IconButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn("ds-icon-btn", className)} {...props} />
  );
}
