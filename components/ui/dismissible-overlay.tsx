"use client";

import {
  useCallback,
  useRef,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

type BackdropDismissHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

/**
 * Закрытие по клику на backdrop только если жест начался И закончился на overlay.
 * Иначе выделение текста с mouseup вне карточки даёт click на overlay и ложно закрывает попап.
 */
export function useBackdropDismiss(
  onDismiss?: (() => void) | null,
): BackdropDismissHandlers {
  const startedOnBackdropRef = useRef(false);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      startedOnBackdropRef.current = event.target === event.currentTarget;
    },
    [],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const startedOnBackdrop = startedOnBackdropRef.current;
      startedOnBackdropRef.current = false;
      if (!onDismiss) return;
      if (!startedOnBackdrop) return;
      if (event.target !== event.currentTarget) return;
      if (event.button !== 0) return;
      onDismiss();
    },
    [onDismiss],
  );

  return { onPointerDown, onPointerUp };
}

type DismissibleOverlayProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onPointerDown" | "onPointerUp" | "onClick"
> & {
  onDismiss?: (() => void) | null;
  /** Когда true — backdrop не закрывает (busy/loading). */
  disabled?: boolean;
  children?: ReactNode;
};

export function DismissibleOverlay({
  onDismiss,
  disabled = false,
  children,
  role = "presentation",
  ...rest
}: DismissibleOverlayProps) {
  const handlers = useBackdropDismiss(disabled ? null : onDismiss);

  return (
    <div role={role} {...rest} {...handlers}>
      {children}
    </div>
  );
}
