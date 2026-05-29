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
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([]);
  const [edits, setEdits] = useState<Partial<Track>>({});
  const [albumArt, setAlbumArt] = useState<string | null>(null);

  const handleEdit = (field: keyof Track, value: string | undefined) => {
    if (value === undefined) {
      setEdits((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    } else {
      setEdits((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleSelect = async (newTracks: Track[]) => {
    setSelectedTracks(newTracks);
    setEdits({});
    if (newTracks.length === 0) {
      setAlbumArt(null);
      return;
    }
    const arts = await Promise.all(
      newTracks.map((t) =>
        invoke<string | null>("load_album_art", { path: t.path }),
      ),
    );
    const first = arts[0];
    setAlbumArt(arts.every((a) => a === first) ? first : null);
  };

  const handleDeselect = () => {
    setSelectedTracks([]);
    setEdits({});
    setAlbumArt(null);
  };

  const handleSave = async () => {
    if (selectedTracks.length === 0) return;
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
    for (const track of selectedTracks) {
      await saveTrack(track.path, edits);
    }
    setTracks((prev) =>
      prev.map((t) =>
        selectedTracks.some((s) => s.path === t.path)
          ? { ...t, ...parsedEdits }
          : t,
      ),
    );
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (tracks.length === 0) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const anchor = selectedTracks[selectedTracks.length - 1];
      const currentIndex = anchor
        ? tracks.findIndex((t) => t.path === anchor.path)
        : -1;
      const nextIndex =
        e.key === "ArrowDown"
          ? Math.min(currentIndex + 1, tracks.length - 1)
          : Math.max(currentIndex - 1, 0);
      if (nextIndex !== currentIndex) handleSelect([tracks[nextIndex]]);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tracks, selectedTracks]);

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
              tracks={selectedTracks}
              albumArt={albumArt}
              onEdit={handleEdit}
            />
          </div>
          <div className="border-t border-border/50 p-3">
            <button
              onClick={handleSave}
              disabled={selectedTracks.length === 0 || !hasEdits}
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
          selectedTracks={selectedTracks}
          onSelect={handleSelect}
          onDeselect={handleDeselect}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export default App;
