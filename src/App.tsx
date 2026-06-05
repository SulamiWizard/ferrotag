import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import "./App.css";

import FilesPane from "./panes/FilesPane";
import TagEditor from "./panes/MetadataPane";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { useKeyBindings } from "@/hooks/useKeyBindings";
import { Track } from "@/types/track";
import {
  TrackRow,
  SortKey,
  SortDir,
  trackToRow,
  sortedRows,
  buildSaveChanges,
  isTagsDirty,
  EditableTags,
} from "@/lib/track-row";

interface DragDropPayload {
  paths: string[];
}

const ART_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];

function Icon({ d, size = 16 }: { d: React.ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {d}
    </svg>
  );
}

const ICONS = {
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  save: (
    <>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v5h7" />
      <path d="M8 20v-6h8v6" />
    </>
  ),
  undo: (
    <>
      <path d="M9 7L4 12l5 5" />
      <path d="M4 12h11a5 5 0 0 1 0 10h-2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
};

export default function App() {
  const [rows, setRows] = useState<TrackRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "trackNo", dir: "asc" });
  const [search, setSearch] = useState("");
  const [folderPath, setFolderPath] = useState<string | null>(null);

  const displayed = useMemo(() => {
    let r = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((row) =>
        [row.file, row.tags.title, row.tags.artist, row.tags.album, row.tags.genre].some((v) =>
          v.toLowerCase().includes(q),
        ),
      );
    }
    return sortedRows(r, sort.key, sort.dir);
  }, [rows, sort, search]);

  const selRows = useMemo(() => rows.filter((r) => selectedIds.has(r.id)), [rows, selectedIds]);
  const dirtyCount = useMemo(() => rows.filter((r) => r.modified || r.pendingArtPath).length, [rows]);

  // Batch-load art for all rows in the background, 8 concurrent calls at a time.
  // Art is loaded progressively so the UI updates as each batch completes.
  const loadAllArtRef = useRef<AbortController | null>(null);

  const loadAllArt = useCallback(async (newRows: TrackRow[]) => {
    // Cancel any in-flight load from a previous track load.
    loadAllArtRef.current?.abort();
    const controller = new AbortController();
    loadAllArtRef.current = controller;

    const BATCH = 8;
    for (let i = 0; i < newRows.length; i += BATCH) {
      if (controller.signal.aborted) break;
      const batch = newRows.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((r) => invoke<string | null>("load_album_art", { path: r.path })),
      );
      if (controller.signal.aborted) break;
      const updates = new Map(batch.map((r, j) => [r.id, results[j]]));
      setRows((prev) =>
        prev.map((row) =>
          updates.has(row.id) ? { ...row, artUrl: updates.get(row.id) ?? null } : row,
        ),
      );
    }
  }, []);

  // Convert Tauri Track[] → TrackRow[] then kick off background art loading.
  const loadTracks = useCallback(async (tracks: Track[], folder?: string) => {
    const newRows = tracks.map(trackToRow);
    setRows(newRows);
    setSelectedIds(new Set());
    if (folder) setFolderPath(folder);
    loadAllArt(newRows);
  }, [loadAllArt]);

  // Update a tag field on all selected rows and recompute their dirty flag.
  const applyEdit = useCallback((key: keyof EditableTags, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (!selectedIds.has(row.id)) return row;
        const tags = { ...row.tags, [key]: value };
        return { ...row, tags, modified: isTagsDirty(tags, row.orig) || !!row.pendingArtPath };
      }),
    );
  }, [selectedIds]);

  // Priority-load art for any selected rows that the background loader hasn't reached yet.
  const loadArtForIds = useCallback(async (ids: Set<string>) => {
    const toLoad: string[] = [];
    setRows((prev) => {
      for (const row of prev) {
        if (ids.has(row.id) && row.artUrl === undefined) toLoad.push(row.id);
      }
      return prev;
    });
    if (toLoad.length === 0) return;
    const results = await Promise.all(
      toLoad.map((id) => invoke<string | null>("load_album_art", { path: id })),
    );
    const updates = new Map(toLoad.map((id, i) => [id, results[i]]));
    setRows((prev) =>
      prev.map((row) =>
        updates.has(row.id) ? { ...row, artUrl: updates.get(row.id) ?? null } : row,
      ),
    );
  }, []);

  const handleSelect = useCallback(
    (ids: Set<string>) => {
      setSelectedIds(ids);
      loadArtForIds(ids);
    },
    [loadArtForIds],
  );

  // Save all dirty rows to disk.
  const handleSave = useCallback(async () => {
    const dirty = rows.filter((r) => r.modified || r.pendingArtPath);
    if (dirty.length === 0) return;
    for (const row of dirty) {
      const changes = buildSaveChanges(row.tags, row.orig);
      if (Object.keys(changes).length > 0) {
        await invoke("save_track", { path: row.path, changes });
      }
      if (row.pendingArtPath) {
        await invoke("set_album_art", { audioPaths: [row.path], imagePath: row.pendingArtPath });
      }
    }
    setRows((prev) =>
      prev.map((r) =>
        r.modified || r.pendingArtPath
          ? { ...r, orig: { ...r.tags }, modified: false, pendingArtPath: null }
          : r,
      ),
    );
  }, [rows]);

  // Revert all dirty rows to their orig snapshot.
  const handleRevert = useCallback(() => {
    setRows((prev) =>
      prev.map((r) =>
        r.modified || r.pendingArtPath
          ? { ...r, tags: { ...r.orig }, modified: false, pendingArtPath: null }
          : r,
      ),
    );
  }, []);

  // Open a folder via dialog.
  const handleOpen = async () => {
    const dir = await open({ directory: true, multiple: false });
    if (!dir || typeof dir !== "string") return;
    const tracks = await invoke<Track[]>("load_tracks", { paths: [dir] });
    await loadTracks(tracks, dir);
  };

  // Stage new album art from a file picker for all selected tracks.
  const handleArtClick = async (currentArtUrl: string | null) => {
    if (selRows.length === 0) return;
    if (currentArtUrl) {
      // Click on existing art: open picker to replace
    }
    const selected = await open({
      multiple: false,
      filters: [{ name: "Image", extensions: ART_EXTENSIONS }],
    });
    if (!selected || typeof selected !== "string") return;
    const preview = await invoke<string | null>("read_image", { path: selected });
    if (!preview) return;
    setRows((prev) =>
      prev.map((row) => {
        if (!selectedIds.has(row.id)) return row;
        return {
          ...row,
          artUrl: preview,
          pendingArtPath: selected,
          modified: isTagsDirty(row.tags, row.orig) || true,
        };
      }),
    );
  };

  // Drop art onto the art well.
  const handleArtDrop = async (filePath: string) => {
    if (selRows.length === 0) return;
    const preview = await invoke<string | null>("read_image", { path: filePath });
    if (!preview) return;
    setRows((prev) =>
      prev.map((row) => {
        if (!selectedIds.has(row.id)) return row;
        return {
          ...row,
          artUrl: preview,
          pendingArtPath: filePath,
          modified: isTagsDirty(row.tags, row.orig) || true,
        };
      }),
    );
  };

  // Extract embedded art from the first selected file to disk.
  const handleArtExtract = async () => {
    if (selRows.length === 0) return;
    const hasArt = selRows[0].artUrl;
    if (!hasArt) return;
    const destPath = await save({
      defaultPath: "cover.jpg",
      filters: [{ name: "Image", extensions: ["jpg", "jpeg", "png", "webp", "bmp"] }],
    });
    if (!destPath) return;
    await invoke("extract_album_art", { audioPath: selRows[0].path, destPath });
  };

  // Keyboard navigation + shortcuts.
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useKeyBindings(
    useMemo(
      () => ({
        arrowdown: (e: KeyboardEvent) => {
          if (displayed.length === 0) return;
          e.preventDefault();
          const ids = [...selectedIds];
          const lastId = ids[ids.length - 1];
          const idx = lastId ? displayed.findIndex((r) => r.id === lastId) : -1;
          const next = Math.min(idx + 1, displayed.length - 1);
          if (next !== idx) {
            const newIds = new Set([displayed[next].id]);
            setSelectedIds(newIds);
            loadArtForIds(newIds);
          }
        },
        arrowup: (e: KeyboardEvent) => {
          if (displayed.length === 0) return;
          e.preventDefault();
          const ids = [...selectedIds];
          const lastId = ids[ids.length - 1];
          const idx = lastId ? displayed.findIndex((r) => r.id === lastId) : -1;
          const next = Math.max(idx - 1, 0);
          if (next !== idx) {
            const newIds = new Set([displayed[next].id]);
            setSelectedIds(newIds);
            loadArtForIds(newIds);
          }
        },
        "mod+s": (e: KeyboardEvent) => {
          e.preventDefault();
          handleSaveRef.current();
        },
        "mod+a": (e: KeyboardEvent) => {
          e.preventDefault();
          setSelectedIds(new Set(displayed.map((r) => r.id)));
        },
      }),
      [displayed, selectedIds, loadArtForIds],
    ),
  );

  // Tauri drag-drop for audio files onto the window.
  useEffect(() => {
    const unlisten = listen<DragDropPayload>("tauri://drag-drop", async (event) => {
      const paths = event.payload.paths;
      const tracks = await invoke<Track[]>("load_tracks", { paths });
      await loadTracks(tracks);
    });
    return () => { unlisten.then((f) => f()); };
  }, [loadTracks]);

  // Compute art state for the editor from selected rows.
  const artUrls = selRows.map((r) => r.artUrl);
  const sharedArtUrl = artUrls.length > 0 && artUrls.every((u) => u === artUrls[0]) ? artUrls[0] : null;
  const mixedArt = artUrls.length > 1 && !artUrls.every((u) => u === artUrls[0]);

  const appWin = getCurrentWindow();

  // Display folder name in titlebar.
  const folderDisplay = folderPath
    ? folderPath.replace(/^\/home\/[^/]+/, "~")
    : rows.length > 0
    ? "…"
    : null;

  return (
    <div className="win" data-theme="dark" data-density="balanced">
      {/* ——— title bar ——— */}
      <div className="titlebar" data-tauri-drag-region>
        <div className="titlebar__lights">
          <button className="tl tl--c" title="Close" onClick={() => appWin.close()} />
          <button className="tl tl--m" title="Minimize" onClick={() => appWin.minimize()} />
          <button className="tl tl--x" title="Maximize" onClick={() => appWin.toggleMaximize()} />
        </div>
        <div className="titlebar__title">
          <span className="brand">
            ferro<span className="brand__tag">tag</span>
          </span>
          {folderDisplay && (
            <span className="titlebar__doc mono" title={folderPath ?? ""}>
              {folderDisplay}
            </span>
          )}
        </div>
        <div className="titlebar__right mono">{rows.length > 0 ? `${rows.length} files` : ""}</div>
      </div>

      {/* ——— toolbar ——— */}
      <div className="toolbar">
        <div className="toolbar__group">
          <button className="tbtn" onClick={handleOpen}>
            <Icon d={ICONS.folder} />
            <span>Open</span>
          </button>
          <button
            className="tbtn tbtn--primary"
            disabled={dirtyCount === 0}
            onClick={handleSave}
          >
            <Icon d={ICONS.save} />
            <span>Save{dirtyCount > 0 ? ` (${dirtyCount})` : ""}</span>
          </button>
          <button
            className="tbtn"
            disabled={dirtyCount === 0}
            onClick={handleRevert}
          >
            <Icon d={ICONS.undo} />
            <span>Revert</span>
          </button>
        </div>
        <div className="toolbar__spacer" />
        <div className="toolbar__group">
          <div className="searchbox">
            <Icon d={ICONS.search} size={14} />
            <input
              placeholder="Filter library…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="searchbox__clear" onClick={() => setSearch("")}>
                <Icon d={ICONS.x} size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ——— main panes ——— */}
      <ResizablePanelGroup
        orientation="horizontal"
        style={{ minHeight: 0 }}
        className="panes"
      >
        <ResizablePanel defaultSize={68} minSize={30} className="pane pane--list">
          <FilesPane
            rows={displayed}
            selectedIds={selectedIds}
            sort={sort}
            search={search}
            totalCount={rows.length}
            onSort={(key, dir) => setSort({ key, dir })}
            onSelect={handleSelect}
          />
        </ResizablePanel>

        <ResizableHandle className="pane-handle" />

        <ResizablePanel defaultSize={32} minSize={20} className="pane pane--editor">
          <TagEditor
            selRows={selRows}
            artUrl={sharedArtUrl ?? null}
            mixedArt={mixedArt}
            onEdit={applyEdit}
            onArtClick={handleArtClick}
            onArtDrop={handleArtDrop}
            onArtExtract={handleArtExtract}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* ——— status bar ——— */}
      <div className="statusbar mono">
        {selectedIds.size === 0 ? (
          <span className="dim">No selection</span>
        ) : selectedIds.size === 1 ? (
          <>
            <span>{selRows[0]?.fmt ?? ""}</span>
            <span className="sb-sep" />
            <span className="dim">{selRows[0]?.file ?? ""}</span>
          </>
        ) : (
          <span>{selectedIds.size} files selected</span>
        )}
        <div style={{ flex: 1 }} />
        {dirtyCount > 0 ? (
          <span className="sb-dirty">● {dirtyCount} unsaved</span>
        ) : (
          <span className="dim">All changes saved</span>
        )}
      </div>
    </div>
  );
}
