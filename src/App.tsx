import FilesPane from "./panes/FilesPane";
import MetadataPane from "./panes/MetadataPane";
import "./App.css";
import { Track } from "@/types/track";

import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

interface DragDropPayload {
  paths: string[];
}

function App() {
  const [tracks, setTracks] = useState<Track[]>([]);

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
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Left panel, fixed width */}
      <div className="w-72 min-w-72 border-r flex flex-col">
        <MetadataPane />
      </div>

      {/* Right panel, takes remaining space */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <FilesPane tracks={tracks} />
      </div>
    </div>
  );
}

export default App;
