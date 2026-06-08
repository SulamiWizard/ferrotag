import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Channel, invoke } from "@tauri-apps/api/core";
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
import { applyRenamePattern } from "@/lib/rename-pattern";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

interface DragDropPayload {
  paths: string[];
}

const ART_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];
const AUDIO_EXTENSIONS = ["mp3", "flac", "ogg", "m4a", "wav", "aiff", "ape", "opus", "wv"];

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
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </>
  ),
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
  const [renamePattern, setRenamePattern] = useState("");
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const selRows = useMemo(() => rows.filter((r) => selectedIds.has(r.id)), [rows, selectedIds]);
  const dirtyCount = useMemo(() => rows.filter((r) => r.modified || r.pendingArtPath || r.pendingArtRemove).length, [rows]);

  // Streams tracks from Rust via a Channel, rendering each batch of 25 as it
  // arrives. Art is not pre-loaded here — it loads lazily on selection.
  const openTracks = useCallback(async (paths: string[]) => {
    setRows([]);
    setSelectedIds(new Set());

    const accumulated: TrackRow[] = [];
    const channel = new Channel<Track[]>();

    channel.onmessage = (batch) => {
      const newRows = batch.map(trackToRow);
      accumulated.push(...newRows);
      setRows([...accumulated]);
    };

    await invoke("load_tracks", { onBatch: channel, paths });
  }, []);

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

  // Load art for selected rows that haven't been fetched yet.
  const loadArtForIds = useCallback(async (ids: Set<string>) => {
    const toLoad = rowsRef.current
      .filter((row) => ids.has(row.id) && row.artUrl === undefined)
      .map((row) => row.id);
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
    const dirty = rows.filter((r) => r.modified || r.pendingArtPath || r.pendingArtRemove);
    if (dirty.length === 0) return;

    const pathUpdates = new Map<string, string>(); // oldId -> newPath
    const failedIds = new Set<string>();

    for (const row of dirty) {
      try {
        const changes = buildSaveChanges(row.tags, row.orig);
        if (Object.keys(changes).length > 0) {
          await invoke("save_track", { path: row.path, changes });
        }
        if (row.pendingArtRemove) {
          await invoke("remove_album_art", { audioPaths: [row.path] });
        } else if (row.pendingArtPath) {
          await invoke("set_album_art", { audioPaths: [row.path], imagePath: row.pendingArtPath });
        }
      } catch (e) {
        console.error(`Failed to save ${row.file}:`, e);
        failedIds.add(row.id);
        continue;
      }

      if (renamePattern.trim()) {
        const newFilename = applyRenamePattern(renamePattern, row.tags, row.path);
        const lastSep = Math.max(row.path.lastIndexOf("/"), row.path.lastIndexOf("\\"));
        const dir = lastSep >= 0 ? row.path.slice(0, lastSep + 1) : "";
        const newPath = dir + newFilename;
        if (newPath !== row.path) {
          try {
            await invoke("rename_file", { from: row.path, to: newPath });
            pathUpdates.set(row.id, newPath);
          } catch {
            // Skip rename on conflict; tags are already saved
          }
        }
      }
    }

    if (failedIds.size > 0) {
      const names = dirty
        .filter((r) => failedIds.has(r.id))
        .map((r) => r.file)
        .join(", ");
      setNotice(`Failed to save: ${names}`);
    }

    setRows((prev) =>
      prev.map((r) => {
        if (!r.modified && !r.pendingArtPath && !r.pendingArtRemove) return r;
        if (failedIds.has(r.id)) return r; // keep dirty state for failed saves
        const newPath = pathUpdates.get(r.id);
        const base = {
          ...r,
          orig: { ...r.tags },
          modified: false,
          pendingArtPath: null,
          pendingArtRemove: false,
        };
        if (!newPath) return base;
        return {
          ...base,
          id: newPath,
          path: newPath,
          file: newPath.split(/[/\\]/).pop() ?? newPath,
        };
      }),
    );

    if (pathUpdates.size > 0) {
      setSelectedIds((prev) => {
        const next = new Set<string>();
        for (const id of prev) next.add(pathUpdates.get(id) ?? id);
        return next;
      });
    }
  }, [rows, renamePattern]);

  // Revert all dirty rows to their orig snapshot.
  const handleRevert = useCallback(async () => {
    // Collect rows whose art was staged so we can reload from disk after reverting.
    const artToReload = rowsRef.current
      .filter((r) => r.pendingArtPath || r.pendingArtRemove)
      .map((r) => r.id);

    setRows((prev) =>
      prev.map((r) => {
        if (!r.modified && !r.pendingArtPath && !r.pendingArtRemove) return r;
        // Clear artUrl so the art well resets — actual value reloaded below.
        const artUrl = (r.pendingArtPath || r.pendingArtRemove) ? undefined : r.artUrl;
        return { ...r, tags: { ...r.orig }, modified: false, pendingArtPath: null, pendingArtRemove: false, artUrl };
      }),
    );

    if (artToReload.length === 0) return;
    const results = await Promise.all(
      artToReload.map((id) => invoke<string | null>("load_album_art", { path: id })),
    );
    const updates = new Map(artToReload.map((id, i) => [id, results[i]]));
    setRows((prev) =>
      prev.map((row) =>
        updates.has(row.id) ? { ...row, artUrl: updates.get(row.id) ?? null } : row,
      ),
    );
  }, []);

  // Open a folder via dialog.
  const handleOpen = async () => {
    const dir = await open({ directory: true, multiple: false });
    if (!dir || typeof dir !== "string") return;
    await openTracks([dir]);
  };

  // Open individual audio files via dialog.
  const handleOpenFiles = async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Audio", extensions: AUDIO_EXTENSIONS }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    if (paths.length === 0) return;
    await openTracks(paths);
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

  const handleArtRemove = useCallback(() => {
    setRows((prev) =>
      prev.map((row) => {
        if (!selectedIds.has(row.id)) return row;
        return { ...row, artUrl: null, pendingArtPath: null, pendingArtRemove: true };
      }),
    );
  }, [selectedIds]);

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

  // Stable refs so event listeners (registered once) always call the latest handler.
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const handleOpenRef = useRef(handleOpen);
  handleOpenRef.current = handleOpen;
  const handleArtDropRef = useRef(handleArtDrop);
  handleArtDropRef.current = handleArtDrop;
  const displayedRef = useRef(displayed);
  displayedRef.current = displayed;

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
            setScrollToId(displayed[next].id);
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
            setScrollToId(displayed[next].id);
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

  // Global Tauri drag-drop handler. Routes drops to openTracks or handleArtDrop.
  // Anything that isn't a recognised image extension (including directories and
  // audio files) is forwarded to openTracks; the backend handles walking dirs.
  // Only when every dropped path is an image is it treated as an art drop.
  useEffect(() => {
    const imageExts = new Set(ART_EXTENSIONS);
    const isImage = (p: string) => imageExts.has(p.split(".").pop()?.toLowerCase() ?? "");
    const unlisten = listen<DragDropPayload>("tauri://drag-drop", async (event) => {
      const paths = event.payload.paths;
      const nonImagePaths = paths.filter((p) => !isImage(p));
      if (nonImagePaths.length > 0) {
        await openTracks(nonImagePaths);
      } else {
        const imagePath = paths.find(isImage);
        if (imagePath) await handleArtDropRef.current(imagePath);
      }
    });
    return () => { unlisten.then((f) => f()); };
  }, [openTracks]);

  // Native menu bar events emitted from Rust via app.emit().
  useEffect(() => {
    const unlisteners = Promise.all([
      listen("menu-open", () => handleOpenRef.current()),
      listen("menu-save", () => handleSaveRef.current()),
      listen("menu-select-all", () => {
        setSelectedIds(new Set(displayedRef.current.map((r) => r.id)));
      }),
      listen("menu-clear", () => {
        setRows([]);
        setSelectedIds(new Set());
      }),
      listen<boolean>("context-menu-registered", (e) => {
        setNotice(e.payload ? "Context menu registered." : "Failed to register context menu.");
      }),
      listen<boolean>("context-menu-unregistered", (e) => {
        setNotice(e.payload ? "Context menu unregistered." : "Failed to unregister context menu.");
      }),
    ]);
    return () => { unlisteners.then((fns) => fns.forEach((f) => f())); };
  }, []);

  // Open the folder passed as a CLI argument (e.g. from Windows context menu).
  useEffect(() => {
    invoke<string | null>("get_startup_path").then((path) => {
      if (path) openTracks([path]);
    });
  }, [openTracks]);

  useEffect(() => {
    if (!notice) return;
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  }, [notice]);

  // Compute art state for the editor from selected rows.
  const artUrls = selRows.map((r) => r.artUrl);
  const sharedArtUrl = artUrls.length > 0 && artUrls.every((u) => u === artUrls[0]) ? artUrls[0] : null;
  const mixedArt = artUrls.length > 1 && !artUrls.every((u) => u === artUrls[0]);

  return (
    <div className="win" data-theme="dark" data-density="balanced">
      {/* ——— toolbar ——— */}
      <div className="toolbar">
        <div className="toolbar__group">
          <button className="tbtn" onClick={handleOpenFiles}>
            <Icon d={ICONS.file} />
            <span>Files…</span>
          </button>
          <button className="tbtn" onClick={handleOpen}>
            <Icon d={ICONS.folder} />
            <span>Folder…</span>
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
          <div className="rename-bar">
            <span className="rename-bar__label">Rename:</span>
            <div className={`rename-bar__input-wrap${renamePattern ? " rename-bar__input-wrap--active" : ""}`}>
              <input
                className="rename-bar__input"
                placeholder="{artist} – {track_number} – {title}"
                value={renamePattern}
                title="Rename files on save. Tokens: {title} {artist} {album} {album_artist} {track_number} {disc_number} {year} {genre} {composer} {bpm}. Leave empty to skip renaming."
                onChange={(e) => setRenamePattern(e.target.value)}
              />
              {renamePattern && (
                <button className="searchbox__clear" onClick={() => setRenamePattern("")}>
                  <Icon d={ICONS.x} size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="toolbar__sep" />
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
            scrollToId={scrollToId}
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
            onArtExtract={handleArtExtract}
            onArtRemove={handleArtRemove}
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
            <span className="sb-sep" />
            <span className="dim">{formatBytes(selRows[0]?.size ?? 0)}</span>
          </>
        ) : (
          <>
            <span>{selectedIds.size} files selected</span>
            <span className="sb-sep" />
            <span className="dim">{formatBytes(selRows.reduce((s, r) => s + r.size, 0))}</span>
          </>
        )}
        <div style={{ flex: 1 }} />
        {notice && (
          <>
            <span className="sb-sep" />
            <span className="sb-notice">{notice}</span>
          </>
        )}
        {renamePattern.trim() && selRows.length === 1 && (
          <>
            <span className="dim">→</span>
            <span className="sb-rename">
              {applyRenamePattern(renamePattern, selRows[0].tags, selRows[0].path)}
            </span>
            <span className="sb-sep" />
          </>
        )}
        {dirtyCount > 0 ? (
          <span className="sb-dirty">● {dirtyCount} unsaved</span>
        ) : (
          <span className="dim">All changes saved</span>
        )}
      </div>
    </div>
  );
}
