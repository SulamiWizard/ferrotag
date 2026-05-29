import FilesPane from "./panes/FilesPane";
import MetadataPane from "./panes/MetadataPane";
import "./App.css";
import { Track } from "@/types/track";
import { saveTrack } from "@/lib/tauri";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

interface DragDropPayload {
  paths: string[];
}

function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [edits, setEdits] = useState<Partial<Track>>({});
  const [albumArt, setAlbumArt] = useState<string | null>(null);

  const handleEdit = (field: keyof Track, value: string) => {
    setEdits((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelect = async (track: Track) => {
    setSelectedTrack(track);
    setEdits({});
    const art = await invoke<string | null>("load_album_art", {
      path: track.path,
    });
    setAlbumArt(art);
  };

  const handleDeselect = () => {
    setSelectedTrack(null);
    setEdits({});
    setAlbumArt(null);
  };

  const handleSave = async () => {
    if (!selectedTrack) return;
    await saveTrack(selectedTrack.path, edits);
    const parseArtists = (v: unknown): string[] =>
      typeof v === "string"
        ? v
            .split("\\\\")
            .map((a) => a.trim())
            .filter(Boolean)
        : (v as string[]);
    const parsedEdits = {
      ...edits,
      ...(edits.artists !== undefined && {
        artists: parseArtists(edits.artists),
      }),
      ...(edits.album_artists !== undefined && {
        album_artists: parseArtists(edits.album_artists),
      }),
    };
    setTracks((prev) =>
      prev.map((t) =>
        t.path === selectedTrack.path ? { ...t, ...parsedEdits } : t,
      ),
    );
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (tracks.length === 0) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const currentIndex = selectedTrack
        ? tracks.findIndex((t) => t.path === selectedTrack.path)
        : -1;
      const nextIndex =
        e.key === "ArrowDown"
          ? Math.min(currentIndex + 1, tracks.length - 1)
          : Math.max(currentIndex - 1, 0);
      if (nextIndex !== currentIndex) handleSelect(tracks[nextIndex]);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tracks, selectedTrack]);

  useEffect(() => {
    const unlisten = listen<DragDropPayload>(
      "tauri://drag-drop",
      async (event) => {
        const paths = event.payload.paths;
        const result = await invoke<Track[]>("load_tracks", { paths });
        setTracks(result);
      },
    );

    return () => {
      unlisten.then((f) => f());
    };
  }, []);
  const hasEdits = Object.keys(edits).length > 0;

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-screen w-screen">
      <ResizablePanel defaultSize="50%" minSize="15%" maxSize="75%">
        <div className="flex flex-col h-full">
          <div className="flex-1 min-h-0 overflow-hidden">
            <MetadataPane
              track={selectedTrack}
              albumArt={albumArt}
              onEdit={handleEdit}
            />
          </div>
          <div className="border-t border-border/50 p-3">
            <button
              onClick={handleSave}
              disabled={!selectedTrack || !hasEdits}
              className="w-full h-8 text-sm font-medium rounded-md bg-primary text-primary-foreground
                hover:bg-primary/85 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed
                transition-all duration-100"
            >
              Save
            </button>
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel defaultSize="75%">
        <FilesPane
          tracks={tracks}
          selectedTrack={selectedTrack}
          onSelect={handleSelect}
          onDeselect={handleDeselect}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export default App;
