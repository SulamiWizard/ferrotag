import { useEffect } from "react";

type KeyMap = Record<string, (e: KeyboardEvent) => void>;

export function useKeyBindings(map: KeyMap) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Allow modifier combos (e.g. mod+s) inside inputs, but block bare keys
      // like arrow navigation so they don't fight with normal text editing.
      const inInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;
      if (inInput && !e.ctrlKey && !e.metaKey) return;
      // "mod" is an alias for Ctrl (Windows/Linux) or Cmd (Mac) so a single
      // map entry handles both platforms.
      const key = [
        e.ctrlKey || e.metaKey ? "mod" : "",
        e.shiftKey ? "shift" : "",
        e.key.toLowerCase(),
      ]
        .filter(Boolean)
        .join("+");
      map[key]?.(e);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [map]);
}
