import { useRef, useState } from "react";
import { Track } from "@/types/track";

type SortKey = "track_number" | "title" | "artists" | "album" | "year";
type SortDir = "asc" | "desc";

interface FilesPaneProps {
  tracks: Track[];
  selectedTracks: Track[];
  onSelect: (tracks: Track[]) => void;
  onDeselect: () => void;
}

function parseTrackNumber(t: Track): number {
  const n = parseInt(t.track_number ?? "", 10);
  return isNaN(n) ? Infinity : n;
}

function sortedBy(tracks: Track[], key: SortKey, dir: SortDir): Track[] {
  return [...tracks].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "track_number":
        cmp = parseTrackNumber(a) - parseTrackNumber(b);
        break;
      case "title":
        cmp = (a.title ?? "").localeCompare(b.title ?? "");
        break;
      case "artists":
        cmp = (a.artists[0] ?? "").localeCompare(b.artists[0] ?? "");
        break;
      case "album":
        cmp = (a.album ?? "").localeCompare(b.album ?? "");
        break;
      case "year":
        cmp = (a.recording_date ?? a.year ?? "").localeCompare(
          b.recording_date ?? b.year ?? "",
        );
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

const COLS = "grid-cols-[0.5fr_2fr_2fr_2fr_1fr]";

export default function FilesPane({
  tracks,
  selectedTracks,
  onSelect,
  onDeselect,
}: FilesPaneProps) {
  const lastClickedIndex = useRef<number>(-1);
  const selectedPaths = new Set(selectedTracks.map((t) => t.path));

  const [sortKey, setSortKey] = useState<SortKey>("track_number");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const displayedTracks = sortedBy(tracks, sortKey, sortDir);

  const handleHeaderClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleTrackClick = (
    track: Track,
    index: number,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      if (selectedPaths.has(track.path)) {
        onSelect(selectedTracks.filter((t) => t.path !== track.path));
      } else {
        onSelect([...selectedTracks, track]);
      }
      lastClickedIndex.current = index;
    } else if (e.shiftKey && lastClickedIndex.current !== -1) {
      const start = Math.min(lastClickedIndex.current, index);
      const end = Math.max(lastClickedIndex.current, index);
      onSelect(displayedTracks.slice(start, end + 1));
    } else {
      const isOnlySelected =
        selectedTracks.length === 1 && selectedPaths.has(track.path);
      if (isOnlySelected) {
        onDeselect();
      } else {
        onSelect([track]);
      }
      lastClickedIndex.current = index;
    }
  };

  const SortIndicator = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>
    ) : null;

  const headerCls =
    "flex items-center gap-0.5 cursor-pointer select-none hover:text-foreground transition-colors";

  return (
    <div className="flex flex-col h-full">
      {/* Column Headers */}
      <div
        className={`grid ${COLS} border-b px-4 py-2 bg-muted/50 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground`}
      >
        <button
          className={headerCls}
          onClick={() => handleHeaderClick("track_number")}
        >
          #<SortIndicator col="track_number" />
        </button>
        <button
          className={headerCls}
          onClick={() => handleHeaderClick("title")}
        >
          Title<SortIndicator col="title" />
        </button>
        <button
          className={headerCls}
          onClick={() => handleHeaderClick("artists")}
        >
          Artist<SortIndicator col="artists" />
        </button>
        <button
          className={headerCls}
          onClick={() => handleHeaderClick("album")}
        >
          Album<SortIndicator col="album" />
        </button>
        <button className={headerCls} onClick={() => handleHeaderClick("year")}>
          Year<SortIndicator col="year" />
        </button>
      </div>

      {/* Track list or empty state */}
      <div className="flex-1 min-h-0 overflow-y-auto" onClick={onDeselect}>
        {tracks.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground/60 text-sm select-none">
            Drop audio files here
          </div>
        ) : (
          displayedTracks.map((track, index) => {
            const isSelected = selectedPaths.has(track.path);
            return (
              <div
                key={track.path}
                onClick={(e) => handleTrackClick(track, index, e)}
                className={`grid ${COLS} px-4 py-2 text-sm border-b border-border/50 cursor-pointer transition-colors duration-100
                  ${
                    isSelected
                      ? "bg-accent border-l-2 border-l-primary pl-3.5"
                      : "hover:bg-muted/60"
                  }`}
              >
                <span className="truncate text-muted-foreground tabular-nums">
                  {track.track_number ?? ""}
                </span>
                <span className="truncate font-medium">
                  {track.title ?? "Unknown"}
                </span>
                <span className="truncate text-muted-foreground">
                  {track.artists.join("\\\\")}
                </span>
                <span className="truncate text-muted-foreground">
                  {track.album ?? "Unknown"}
                </span>
                <span className="truncate text-muted-foreground tabular-nums">
                  {track.recording_date ?? track.year ?? ""}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
