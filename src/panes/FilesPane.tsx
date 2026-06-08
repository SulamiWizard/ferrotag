import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TrackRow, SortKey, SortDir } from "@/lib/track-row";

interface FilesPaneProps {
  rows: TrackRow[];
  selectedIds: Set<string>;
  sort: { key: SortKey; dir: SortDir };
  search: string;
  totalCount: number;
  scrollToId?: string | null;
  onSort: (key: SortKey, dir: SortDir) => void;
  onSelect: (ids: Set<string>) => void;
}

const COLUMNS: {
  key: string;
  label: string;
  w?: number;
  grow?: number;
  mono?: boolean;
  align?: "right";
  sortKey?: SortKey;
}[] = [
  { key: "_status", label: "",       w: 26 },
  { key: "trackNo", label: "#",      w: 42,  mono: true, align: "right", sortKey: "trackNo" },
  { key: "title",   label: "Title",  grow: 2.2,           sortKey: "title" },
  { key: "artist",  label: "Artist", grow: 1.4,           sortKey: "artist" },
  { key: "album",   label: "Album",  grow: 1.6,           sortKey: "album" },
  { key: "genre",   label: "Genre",  grow: 1 },
  { key: "fmt",     label: "Type",   w: 56,  mono: true,  sortKey: "fmt" },
];

const GRID_COLS = COLUMNS.map((c) =>
  c.w ? `${c.w}px` : `minmax(0, ${c.grow}fr)`,
).join(" ");

const ROW_H = 30; // matches --row-h in balanced density

export default function FilesPane({
  rows,
  selectedIds,
  sort,
  search,
  totalCount,
  scrollToId,
  onSort,
  onSelect,
}: FilesPaneProps) {
  const lastClickRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
    paddingStart: 3,
    paddingEnd: 3,
  });

  // Scroll the virtualised list to keep keyboard-navigated rows visible.
  useEffect(() => {
    if (!scrollToId) return;
    const idx = rows.findIndex((r) => r.id === scrollToId);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: "auto" });
  }, [scrollToId, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleHeaderSort(key: SortKey) {
    onSort(key, sort.key === key && sort.dir === "asc" ? "desc" : "asc");
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
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
      <div className="filelist__head" style={{ gridTemplateColumns: GRID_COLS }}>
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
                  onClick={(e) => { e.stopPropagation(); onSelect(new Set(rows.map((r) => r.id))); }}
                />
              ) : (
                <span>{col.label}</span>
              )}
              {isActive && (
                <span className="fl-th__arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* ——— virtualised body ——— */}
      <div className="filelist__body" ref={scrollRef} role="listbox" aria-multiselectable="true">
        {rows.length === 0 ? (
          <div className="filelist__empty">No files match "{search}".</div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualItems.map((vItem) => {
              const row = rows[vItem.index];
              const isSel = selectedIds.has(row.id);
              const untagged = !row.tags.title;
              return (
                <div
                  key={vItem.key}
                  className={`fl-row${isSel ? " is-sel" : ""}${untagged ? " is-untagged" : ""}`}
                  style={{
                    gridTemplateColumns: GRID_COLS,
                    position: "absolute",
                    top: 0,
                    left: 3,
                    right: 3,
                    transform: `translateY(${vItem.start}px)`,
                  }}
                  onClick={(e) => handleRowClick(e, vItem.index, row.id)}
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
                    <span className={untagged ? "muted-italic" : ""} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
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
                  <div className="fl-td mono">
                    <span className={`fmt-chip fmt-${row.fmt.toLowerCase()}`}>{row.fmt}</span>
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
