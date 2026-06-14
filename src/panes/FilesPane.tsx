import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TrackRow, SortKey, SortDir } from "@/lib/track-row";

interface FilesPaneProps {
  rows: TrackRow[];
  selectedIds: Set<string>;
  sort: { key: SortKey; dir: SortDir };
  search: string;
  totalCount: number;
  scrollToId?: string | null;
  renamePattern: string;
  onSort: (key: SortKey, dir: SortDir) => void;
  onSelect: (ids: Set<string>) => void;
  onRenameSelected: (ids: Set<string>) => void;
  onApplyRulesToSelected: (ids: Set<string>) => void;
}

interface CtxMenu {
  x: number;
  y: number;
  ids: Set<string>;
}

// Each column has a default pixel width. Columns are user-resizable (except the
// status column); a trailing 1fr spacer track absorbs any leftover pane width.
const COLUMNS: {
  key: string;
  label: string;
  w: number;
  mono?: boolean;
  align?: "right";
  sortKey?: SortKey;
  noResize?: boolean;
}[] = [
  { key: "_status", label: "", w: 26, noResize: true },
  {
    key: "trackNo",
    label: "#",
    w: 42,
    mono: true,
    align: "right",
    sortKey: "trackNo",
  },
  { key: "title", label: "Title", w: 280, sortKey: "title" },
  { key: "artist", label: "Artist", w: 180, sortKey: "artist" },
  { key: "album", label: "Album", w: 200, sortKey: "album" },
  { key: "genre", label: "Genre", w: 130, sortKey: "genre" },
  {
    key: "year",
    label: "Year",
    w: 56,
    mono: true,
    align: "right",
    sortKey: "year",
  },
  { key: "fmt", label: "Type", w: 60, mono: true, sortKey: "fmt" },
];

const MIN_COL_W = 40;
const COL_WIDTHS_KEY = "ferrotag.columnWidths";

type ColWidths = Record<string, number>;

function loadColWidths(): ColWidths {
  let saved: Partial<ColWidths> = {};
  try {
    saved = JSON.parse(localStorage.getItem(COL_WIDTHS_KEY) ?? "{}");
  } catch {
    saved = {};
  }
  const out: ColWidths = {};
  for (const c of COLUMNS) {
    const v = saved[c.key];
    out[c.key] = c.noResize || typeof v !== "number" || v < MIN_COL_W ? c.w : v;
  }
  return out;
}

const ROW_H = 30; // matches --row-h in balanced density

export default function FilesPane({
  rows,
  selectedIds,
  sort,
  search,
  totalCount,
  scrollToId,
  renamePattern,
  onSort,
  onSelect,
  onRenameSelected,
  onApplyRulesToSelected,
}: FilesPaneProps) {
  const lastClickRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  const [colWidths, setColWidths] = useState<ColWidths>(loadColWidths);

  useEffect(() => {
    localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(colWidths));
  }, [colWidths]);

  const gridCols =
    COLUMNS.map((c) => `${colWidths[c.key]}px`).join(" ") + " minmax(0, 1fr)";

  // Drag a column's right edge to resize it; the trailing spacer takes the slack.
  function startResize(e: React.PointerEvent, key: string) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[key];
    const onMove = (ev: PointerEvent) => {
      const next = Math.max(MIN_COL_W, startW + (ev.clientX - startX));
      setColWidths((w) => ({ ...w, [key]: next }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.body.style.cursor = "col-resize";
  }

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
    paddingStart: 3,
    paddingEnd: 3,
  });

  // Scroll the virtualised list to keep keyboard-navigated rows visible.
  // Only depends on scrollToId — row updates (e.g. art loading) must not retrigger.
  useEffect(() => {
    if (!scrollToId) return;
    const idx = rows.findIndex((r) => r.id === scrollToId);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: "auto" });
  }, [scrollToId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleHeaderSort(key: SortKey) {
    onSort(key, sort.key === key && sort.dir === "asc" ? "desc" : "asc");
  }

  useEffect(() => {
    if (!ctxMenu) return;
    const dismiss = () => setCtxMenu(null);
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", (e) => e.key === "Escape" && dismiss());
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismiss);
    };
  }, [ctxMenu]);

  function handleRowContextMenu(e: React.MouseEvent, id: string) {
    e.preventDefault();
    const ids = selectedIds.has(id) ? new Set(selectedIds) : new Set([id]);
    if (!selectedIds.has(id)) onSelect(ids);
    // Flip left if near the right edge
    const x = e.clientX + 160 > window.innerWidth ? e.clientX - 160 : e.clientX;
    setCtxMenu({ x, y: e.clientY, ids });
  }

  function handleRowClick(e: React.MouseEvent, idx: number, id: string) {
    const ids = rows.map((r) => r.id);
    if (e.shiftKey && lastClickRef.current != null) {
      const a = ids.indexOf(lastClickRef.current);
      const [lo, hi] = a < idx ? [a, idx] : [idx, a];
      onSelect(new Set(ids.slice(lo, hi + 1)));
    } else if (e.metaKey || e.ctrlKey) {
      const next = new Set(selectedIds);
      next.has(id) ? next.delete(id) : next.add(id);
      onSelect(next);
      lastClickRef.current = id;
    } else {
      onSelect(new Set([id]));
      lastClickRef.current = id;
    }
  }

  if (totalCount === 0) {
    return (
      <div className="filelist">
        <div className="filelist__drop">
          <svg
            viewBox="0 0 24 24"
            width="32"
            height="32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          <span>Drop audio files or folders here, or click Open</span>
        </div>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="filelist">
      {/* ——— header ——— */}
      <div className="filelist__head" style={{ gridTemplateColumns: gridCols }}>
        {COLUMNS.map((col) => {
          const isActive = col.sortKey && sort.key === col.sortKey;
          return (
            <div
              key={col.key}
              className={`fl-th${col.align === "right" ? " fl-th--r" : ""}${col.sortKey ? " fl-th--sortable" : ""}`}
              onClick={() => col.sortKey && handleHeaderSort(col.sortKey)}
            >
              {col.key === "_status" ? (
                <button
                  className="selall"
                  title="Select all"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(new Set(rows.map((r) => r.id)));
                  }}
                />
              ) : (
                <span>{col.label}</span>
              )}
              {isActive && (
                <span className="fl-th__arrow">
                  {sort.dir === "asc" ? "▲" : "▼"}
                </span>
              )}
              {!col.noResize && (
                <span
                  className="fl-th__resizer"
                  title="Drag to resize column"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => startResize(e, col.key)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ——— context menu ——— */}
      {ctxMenu && (
        <div
          className="ctx-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            className="ctx-menu__item"
            onClick={() => {
              onApplyRulesToSelected(ctxMenu.ids);
              setCtxMenu(null);
            }}
          >
            Apply rules to {ctxMenu.ids.size} file
            {ctxMenu.ids.size !== 1 ? "s" : ""}
          </button>
          <button
            className="ctx-menu__item"
            disabled={!renamePattern.trim()}
            title={
              !renamePattern.trim()
                ? "Set a rename pattern in the toolbar first"
                : undefined
            }
            onClick={() => {
              onRenameSelected(ctxMenu.ids);
              setCtxMenu(null);
            }}
          >
            Rename {ctxMenu.ids.size} file{ctxMenu.ids.size !== 1 ? "s" : ""}
          </button>
        </div>
      )}

      {/* ——— virtualised body ——— */}
      <div
        className="filelist__body"
        ref={scrollRef}
        role="listbox"
        aria-multiselectable="true"
      >
        {rows.length === 0 ? (
          <div className="filelist__empty">No files match "{search}".</div>
        ) : (
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualItems.map((vItem) => {
              const row = rows[vItem.index];
              const isSel = selectedIds.has(row.id);
              const untagged = !row.tags.title;
              return (
                <div
                  key={vItem.key}
                  className={`fl-row${isSel ? " is-sel" : ""}${untagged ? " is-untagged" : ""}`}
                  style={{
                    gridTemplateColumns: gridCols,
                    position: "absolute",
                    top: 0,
                    left: 3,
                    right: 3,
                    transform: `translateY(${vItem.start}px)`,
                  }}
                  onClick={(e) => handleRowClick(e, vItem.index, row.id)}
                  onContextMenu={(e) => handleRowContextMenu(e, row.id)}
                  role="option"
                  aria-selected={isSel}
                >
                  <div className="fl-td fl-td--status">
                    {row.modified || row.pendingArtPath ? (
                      <span className="dot dot--mod" title="Unsaved changes" />
                    ) : untagged ? (
                      <span className="dot dot--warn" title="Missing tags" />
                    ) : (
                      <span className="dot dot--ok" />
                    )}
                  </div>
                  <div className="fl-td fl-td--r mono dim">
                    {row.tags.trackNo || <span className="ph">—</span>}
                  </div>
                  <div className="fl-td fl-td--title">
                    <span
                      className={untagged ? "muted-italic" : ""}
                      style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {row.tags.title || row.file}
                    </span>
                  </div>
                  <div className="fl-td">
                    {row.tags.artist || <span className="ph">—</span>}
                  </div>
                  <div className="fl-td dim">
                    {row.tags.album || <span className="ph">—</span>}
                  </div>
                  <div className="fl-td dim">
                    {row.tags.genre || <span className="ph">—</span>}
                  </div>
                  <div className="fl-td fl-td--r mono dim">
                    {row.tags.year || <span className="ph">—</span>}
                  </div>
                  <div className="fl-td mono">
                    <span className={`fmt-chip fmt-${row.fmt.toLowerCase()}`}>
                      {row.fmt}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
