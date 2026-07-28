"use client";

import { useCallback, useEffect, useState } from "react";

// Hält einen einfachen String-Zustand in localStorage, damit die zuletzt
// gewählte Ansicht/Kategorie beim erneuten Öffnen oder Zurückgehen erhalten bleibt.
export function useStoredState(key: string, initial: string): [string, (v: string) => void] {
  const [value, setValue] = useState(initial);

  // Erst nach dem Mount lesen (verhindert Hydration-Mismatch, da Server den
  // Startwert rendert und der Client anschließend den gespeicherten Wert übernimmt).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored != null) setValue(stored);
    } catch {
      // localStorage nicht verfügbar (z. B. privater Modus) → Startwert behalten
    }
  }, [key]);

  const set = useCallback(
    (v: string) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, v);
      } catch {
        // Schreiben fehlgeschlagen → nur In-Memory
      }
    },
    [key],
  );

  return [value, set];
}
