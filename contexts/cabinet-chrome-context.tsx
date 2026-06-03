"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface CabinetChromeContextValue {
  immersive: boolean;
  setImmersive: (value: boolean) => void;
}

const CabinetChromeContext = createContext<CabinetChromeContextValue | null>(
  null,
);

export function CabinetChromeProvider({ children }: { children: ReactNode }) {
  const [immersive, setImmersiveState] = useState(false);
  const setImmersive = useCallback((value: boolean) => {
    setImmersiveState(value);
  }, []);

  const value = useMemo(
    () => ({ immersive, setImmersive }),
    [immersive, setImmersive],
  );

  return (
    <CabinetChromeContext.Provider value={value}>
      {children}
    </CabinetChromeContext.Provider>
  );
}

export function useCabinetChrome() {
  const ctx = useContext(CabinetChromeContext);
  if (!ctx) {
    return { immersive: false, setImmersive: () => {} };
  }
  return ctx;
}
