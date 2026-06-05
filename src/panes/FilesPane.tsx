import { useRef } from "react";
import { TrackRow, SortKey, SortDir } from "@/lib/track-row";

interface FilesPaneProps {
  rows: TrackRow[];          // already filtered + sorted by App
  selectedIds: Set<string>;
  sort: { key: SortKey; dir: SortDir };
  search: string;
  totalCount: number;        // total loaded tracks (before filter)
  onSort: (key: SortKey, dir: SortDir) => void;
  onSelect: (ids: Set<string>) => void;
}

// Column definitions — drives both the header and each data row.
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


export default function FilesPane({ rows, selectedIds, sort, search, totalCount, onSort, onSelect }: FilesPaneProps) {
  const lastClickRef = useRef<string | null>(null);

  function handleHeaderSort(key: SortKey) {
    if (sort.key === key) {
      onSort(key, sort.dir === "asc" ? "desc" : "asc");
    } else {
      onSort(key, "asc");
    }
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

  function selectAll() {
    onSelect(new Set(rows.map((r) => r.id)));
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

  return (
    <div className="filelist">
      {/* ——— header row ——— */}
      <div className="filelist__head" style={{ gridTemplateColumns: GRID_COLS }}>
        {COLUMNS.map((col) => {
          const isActive = col.sortKey && sort.key === col.sortKey;
          return (
            <div
              key={col.key}
              className={`fl-th ${col.align === "right" ? "fl-th--r" : ""} ${col.sortKey ? "fl-th--sortable" : ""}`}
              onClick={() => col.sortKey && handleHeaderSort(col.sortKey)}
            >
              {col.key === "_status" ? (
                <button
                  className="selall"
                  title="Select all"
                  onClick={(e) => { e.stopPropagation(); selectAll(); }}
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

      {/* ——— rows ——— */}
      <div className="filelist__body" role="listbox" aria-multiselectable="true">
        {rows.length === 0 ? (
          <div className="filelist__empty">No files match "{search}".</div>
        ) : (
          rows.map((row, idx) => {
            const isSel = selectedIds.has(row.id);
            const untagged = !row.tags.title;
            return (
              <div
                key={row.id}
                className={`fl-row ${isSel ? "is-sel" : ""} ${untagged ? "is-untagged" : ""}`}
                style={{ gridTemplateColumns: GRID_COLS }}
                onClick={(e) => handleRowClick(e, idx, row.id)}
                role="option"
                aria-selected={isSel}
              >
                {/* status dot */}
                <div className="fl-td fl-td--status">
                  {row.modified || row.pendingArtPath ? (
                    <span className="dot dot--mod" title="Unsaved changes" />
                  ) : untagged ? (
                    <span className="dot dot--warn" title="Missing tags" />
                  ) : (
                    <span className="dot dot--ok" />
                  )}
                </div>
                {/* track # */}
                <div className="fl-td fl-td--r mono dim">
                  {row.tags.trackNo || <span className="ph">—</span>}
                </div>
                {/* title */}
                <div className="fl-td fl-td--title">
                  <span className={untagged ? "muted-italic" : ""} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row.tags.title || row.file}
                  </span>
                </div>
                {/* artist */}
                <div className="fl-td">
                  {row.tags.artist || <span className="ph">—</span>}
                </div>
                {/* album */}
                <div className="fl-td dim">
                  {row.tags.album || <span className="ph">—</span>}
                </div>
                {/* genre */}
                <div className="fl-td dim">
                  {row.tags.genre || <span className="ph">—</span>}
                </div>
                {/* format chip */}
                <div className="fl-td mono">
                  <span className={`fmt-chip fmt-${row.fmt.toLowerCase()}`}>{row.fmt}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
