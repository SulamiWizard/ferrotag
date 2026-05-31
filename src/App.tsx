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
import { open, save } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";

interface DragDropPayload {
  paths: string[];
}

// App is the single source of truth for all state. Child components (FilesPane,
// MetadataPane) receive data as props and call callbacks to request changes —
// they never own or mutate state themselves.
function App() {
  const [tracks, setTracks] = useState<Track[]>([]);           // all loaded files
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([]); // current selection
  const [edits, setEdits] = useState<Partial<Track>>({});      // pending changes, keyed by field
  const [albumArt, setAlbumArt] = useState<string | null>(null);     // base64 data URI preview
  const [pendingArtPath, setPendingArtPath] = useState<string | null>(null); // image to embed on save

  // Add or remove a single field from the edits map.
  // Passing undefined removes the field (effectively "<keep>" — leave it unchanged on save).
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

  // Called when the user clicks a row (or navigates with arrow keys).
  // Clears pending edits and loads album art for the new selection.
  // If multiple tracks are selected, art is shown only if all share the same image.
  const handleSelect = async (newTracks: Track[]) => {
    setSelectedTracks(newTracks);
    setEdits({});
    setPendingArtPath(null);
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
    setPendingArtPath(null);
  };

  // Writes pending edits to every selected file, then updates the in-memory
  // track list to reflect the saved values so the UI stays in sync.
  // Artist splitting (UI string → array) happens inside saveTrack() in lib/tauri.ts.
  // Album art is applied separately after tag edits.
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
    if (pendingArtPath) {
      await invoke("set_album_art", {
        audioPaths: selectedTracks.map((t) => t.path),
        imagePath: pendingArtPath,
      });
      setPendingArtPath(null);
    }
    // Update in-memory tracks so FilesPane reflects the new values immediately
    setTracks((prev) =>
      prev.map((t) =>
        selectedTracks.some((s) => s.path === t.path)
          ? { ...t, ...parsedEdits }
          : t,
      ),
    );
  };

  // Opens a file picker, previews the chosen image in the UI, and stores the
  // path so it can be embedded into the audio files when the user hits Save.
  const handleArtClick = async () => {
    if (selectedTracks.length === 0) return;
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Image",
          extensions: ["jpg", "jpeg", "png", "gif", "webp", "bmp"],
        },
      ],
    });
    if (!selected || typeof selected !== "string") return;
    const preview = await invoke<string | null>("read_image", {
      path: selected,
    });
    if (preview) {
      setAlbumArt(preview);
      setPendingArtPath(selected);
    }
  };

  // Opens a save dialog and extracts the embedded art from the first selected file.
  const handleArtExtract = async () => {
    if (!albumArt || selectedTracks.length === 0) return;
    const destPath = await save({
      defaultPath: "cover.jpg",
      filters: [
        { name: "Image", extensions: ["jpg", "jpeg", "png", "webp", "bmp"] },
      ],
    });
    if (!destPath) return;
    await invoke("extract_album_art", {
      audioPath: selectedTracks[0].path,
      destPath,
    });
  };

  // Arrow key navigation — moves selection one row at a time.
  // Re-registers whenever tracks or selectedTracks change so it always
  // references the latest state values.
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

  // Listen for files/folders dropped onto the window (Tauri drag-drop event).
  // Calls the Rust load_tracks command which recursively scans for audio files
  // and returns their metadata. Runs once on mount; the cleanup unsubscribes.
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

  const hasEdits = Object.keys(edits).length > 0 || pendingArtPath !== null;

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      style={{ height: "100vh", width: "100vw", overflow: "hidden" }}
    >
      {/* Left panel: metadata form + save button. Save is outside the scrollable
          area so it's always visible regardless of how many fields are shown. */}
      <ResizablePanel defaultSize="50%" minSize="15%" maxSize="75%">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
          }}
        >
          <div style={{ flex: 1, overflow: "hidden" }}>
            <MetadataPane
              tracks={selectedTracks}
              albumArt={albumArt}
              onEdit={handleEdit}
              onArtClick={handleArtClick}
              onArtExtract={handleArtExtract}
            />
          </div>
          <div
            style={{ borderTop: "1px solid", padding: "12px", flexShrink: 0 }}
          >
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

      {/* Right panel: sortable, scrollable file list */}
      <ResizablePanel defaultSize="75%">
        <div style={{ height: "100%", overflowY: "auto" }}>
          <FilesPane
            tracks={tracks}
            selectedTracks={selectedTracks}
            onSelect={handleSelect}
            onDeselect={handleDeselect}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export default App;
