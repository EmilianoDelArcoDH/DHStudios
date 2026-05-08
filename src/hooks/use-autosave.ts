"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/store/editor-store";

export function useAutosave(delay = 1200) {
  const report = useEditorStore((state) => state.report);
  const autosave = useEditorStore((state) => state.autosave);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const handle = window.setTimeout(() => void autosave(), delay);
    return () => window.clearTimeout(handle);
  }, [autosave, delay, report]);
}
