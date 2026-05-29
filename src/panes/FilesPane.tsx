import { useRef } from "react";
import { Track } from "@/types/track";

interface FilesPaneProps {
  tracks: Track[];
  selectedTracks: Track[];
  onSelect: (tracks: Track[]) => void;
  onDeselect: () => void;
}

export default function FilesPane({
  tracks,
  selectedTracks,
  onSelect,
  onDeselect,
}: FilesPaneProps) {
  const lastClickedIndex = useRef<number>(-1);
  const selectedPaths = new Set(selectedTracks.map((t) => t.path));

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
      onSelect(tracks.slice(start, end + 1));
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

  return (
    <div className="flex flex-col h-full">
      {/* Column Headers */}
      <div className="grid grid-cols-4 border-b px-4 py-2 bg-muted/50 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
        <span>Title</span>
        <span>Artist</span>
        <span>Album</span>
        <span>Year</span>
      </div>

      {/* Track list or empty state */}
      <div className="flex-1 overflow-y-auto" onClick={onDeselect}>
        {tracks.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground/60 text-sm select-none">
            Drop audio files here
          </div>
        ) : (
          tracks.map((track, index) => {
            const isSelected = selectedPaths.has(track.path);
            return (
              <div
                key={track.path}
                onClick={(e) => handleTrackClick(track, index, e)}
                className={`grid grid-cols-4 px-4 py-2 text-sm border-b border-border/50 cursor-pointer transition-colors duration-100
                  ${
                    isSelected
                      ? "bg-accent border-l-2 border-l-primary pl-3.5"
                      : "hover:bg-muted/60"
                  }`}
              >
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
