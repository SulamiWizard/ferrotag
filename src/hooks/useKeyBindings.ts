import { useEffect } from "react";

type KeyMap = Record<string, (e: KeyboardEvent) => void>;

export function useKeyBindings(map: KeyMap) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;
      // Inside a text field, only intercept mod+s (save). Everything else
      // (including mod+a select-all, arrow keys, etc.) goes to the browser.
      if (inInput) {
        const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
        if (!isSave) return;
      }
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
