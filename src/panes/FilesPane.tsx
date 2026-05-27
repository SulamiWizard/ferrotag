import { Track } from "@/types/track";

interface FilesPaneProps {
  tracks: Track[];
}
export default function FilesPane({ tracks }: FilesPaneProps) {
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
      <div className="flex-1 overflow-y-auto">
        {tracks.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            Drag and drop files here
          </div>
        ) : (
          tracks.map((track) => (
            <div
              key={track.path}
              className="grid grid-cols-4 px-3 py-1 text-sm border-b hover:bg-muted cursor-pointer"
            >
              <span className="truncate">{track.title ?? "Unknown"}</span>
              <span className="truncate">{track.artist ?? "Unknown"}</span>
              <span className="truncate">{track.album ?? "Unknown"}</span>
              <span className="truncate">{track.year ?? ""}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
