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
      <div className="grid grid-cols-4 border-b px-3 py-1 bg-muted text-xs font-medium text-muted-foreground">
        <span>Title</span>
        <span>Artist</span>
        <span>Album</span>
        <span>Year</span>
      </div>

      {/* Track list or empty state */}
      <div className="flex-1 overflow-y-auto" onClick={onDeselect}>
        {tracks.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            Drag and drop files here
          </div>
        ) : (
          tracks.map((track) => (
            <div
              key={track.path}
              onClick={(e) => { e.stopPropagation(); handleTrackClick(track); }}
              className={`grid grid-cols-4 px-3 py-1 text-sm border-b cursor-pointer
                ${selectedTrack?.path === track.path ? "bg-accent" : "hover:bg-muted"}`}
            >
              <span className="truncate">{track.title ?? "Unknown"}</span>
              <span className="truncate">{track.artists.join("\\\\")}</span>
              <span className="truncate">{track.album ?? "Unknown"}</span>
              <span className="truncate">{track.year ?? ""}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
