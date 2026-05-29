import { Track } from "@/types/track";

interface FilesPaneProps {
  tracks: Track[];
  onSelect: (track: Track) => void;
  onDeselect: () => void;
  selectedTrack: Track | null;
}
export default function FilesPane({
  tracks,
  onSelect,
  onDeselect,
  selectedTrack,
}: FilesPaneProps) {
  const handleTrackClick = (track: Track) => {
    if (selectedTrack?.path === track.path) {
      onDeselect();
    } else {
      onSelect(track);
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
          tracks.map((track) => (
            <div
              key={track.path}
              onClick={(e) => { e.stopPropagation(); handleTrackClick(track); }}
              className={`grid grid-cols-4 px-4 py-2 text-sm border-b border-border/50 cursor-pointer transition-colors duration-100
                ${selectedTrack?.path === track.path
                  ? "bg-accent border-l-2 border-l-primary pl-[14px]"
                  : "hover:bg-muted/60"}`}
            >
              <span className="truncate font-medium">{track.title ?? "Unknown"}</span>
              <span className="truncate text-muted-foreground">{track.artists.join("\\\\")}</span>
              <span className="truncate text-muted-foreground">{track.album ?? "Unknown"}</span>
              <span className="truncate text-muted-foreground tabular-nums">{track.recording_date ?? track.year ?? ""}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
