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
        <MetadataPane />
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel defaultSize="75%">
        <FilesPane tracks={tracks} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export default App;
