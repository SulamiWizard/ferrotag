import FilesPane from "./panes/FilesPane";
import MetadataPane from "./panes/MetadataPane";
import "./App.css";
import { Track } from "@/types/track";
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
  return (
    <ResizablePanelGroup orientation="horizontal" className="h-screen w-screen">
      <ResizablePanel defaultSize="50%" minSize="15%" maxSize="75%">
        <MetadataPane
          track={selectedTrack}
          albumArt={albumArt}
          onEdit={handleEdit}
        />
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel defaultSize="75%">
        <FilesPane
          tracks={tracks}
          selectedTrack={selectedTrack}
          onSelect={handleSelect}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export default App;
