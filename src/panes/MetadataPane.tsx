import { useEffect, useRef, useState } from "react";
import { TrackRow, EditableTags, MULTI, sharedTagValue } from "@/lib/track-row";

function formatArtBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

interface TagEditorProps {
  selRows: TrackRow[];
  artUrl: string | null;
  mixedArt: boolean;
  onEdit: (key: keyof EditableTags, value: string) => void;
  onArtClick: (currentArtUrl: string | null) => void;
  onArtExtract: () => void;
  onArtRemove: () => void;
}

// ——— plain field ———

interface TagFieldDef {
  key: keyof EditableTags;
  label: string;
  narrow?: boolean;
  mono?: boolean;
  multiline?: boolean;
}

function Field({
  field,
  sel,
  onChange,
}: {
  field: TagFieldDef;
  sel: TrackRow[];
  onChange: (key: keyof EditableTags, value: string) => void;
}) {
  const val = sharedTagValue(sel, field.key);
  const isMulti = val === MULTI;
  const cls = `tf-input${field.mono ? " mono" : ""}${isMulti ? " is-multi" : ""}`;
  const props = {
    className: cls,
    value: isMulti ? "" : val,
    placeholder: isMulti ? "‹ multiple values ›" : "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(field.key, e.target.value),
  };
  return (
    <label className={`tf${field.narrow ? " tf--narrow" : ""}`}>
      <div className="tf-label-row">
        <span className="tf-label">{field.label}</span>
        {isMulti && (
          <button
            type="button"
            className="tf-clear"
            title="Clear all selected tracks"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(field.key, "")}
          >
            Clear all
          </button>
        )}
      </div>
      {field.multiline ? <textarea {...props} rows={2} /> : <input {...props} />}
    </label>
  );
}

// ——— expandable group of sub-fields ———

function ExpandGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="tf-expand"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`tf-expand__arrow${open ? " tf-expand__arrow--open" : ""}`}>▶</span>
        {label}
      </button>
      {open && <div className="tf-sub">{children}</div>}
    </>
  );
}

// ——— album art well ———

function AlbumArt({
  artUrl,
  mixedArt,
  hasSel,
  onArtClick,
  onArtExtract,
  onArtRemove,
}: {
  artUrl: string | null;
  mixedArt: boolean;
  hasSel: boolean;
  onArtClick: (current: string | null) => void;
  onArtExtract: () => void;
  onArtRemove: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const [menu, setMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [artInfo, setArtInfo] = useState<{ w: number; h: number; bytes: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menu]);

  useEffect(() => {
    if (!artUrl || mixedArt) { setArtInfo(null); return; }
    // Byte size: strip the data URI prefix, decode base64 length to raw bytes
    const b64 = artUrl.split(",")[1] ?? "";
    const padding = (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
    const bytes = Math.floor(b64.length * 0.75) - padding;
    // Resolve pixel dimensions by loading into a temporary Image
    const img = new Image();
    img.onload = () => setArtInfo({ w: img.naturalWidth, h: img.naturalHeight, bytes });
    img.src = artUrl;
  }, [artUrl, mixedArt]);

  const hasArt = !!artUrl && !mixedArt;

  return (
    <div className="art" ref={containerRef}>
      <div
        className={`art__well${hasArt ? " has-art" : ""}${drag ? " is-drag" : ""}`}
        onClick={() => hasSel && onArtClick(artUrl)}
        onContextMenu={(e) => {
          if (!artUrl && !mixedArt) return;
          e.preventDefault();
          const rect = containerRef.current!.getBoundingClientRect();
          setMenuPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          setMenu(true);
        }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          // File path resolution is handled by the global tauri://drag-drop
          // listener in App.tsx — the Web File API doesn't expose paths in Tauri.
        }}
        title={
          hasArt
            ? "Click to replace · right-click for options"
            : "Click or drop an image to add cover art"
        }
      >
        {hasArt ? (
          <>
            <img className="art__img" src={artUrl} alt="Album art" />
            <div className="art__vignette" />
          </>
        ) : mixedArt ? (
          <div className="art__mixed">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="1.8" fill="currentColor" />
              <path d="M5 18l5-5 4 4 2-2 3 3" />
            </svg>
            <span className="mono" style={{ fontSize: "11px" }}>multiple covers</span>
          </div>
        ) : (
          <div className="art__drop">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="1.8" fill="currentColor" />
              <path d="M5 18l5-5 4 4 2-2 3 3" />
            </svg>
            <span className="mono">drop cover art</span>
            <span className="art__hint mono">JPG · PNG · 1400×1400+</span>
          </div>
        )}
      </div>
      <div className="art__meta mono">
        {hasArt && artInfo
          ? `${artInfo.w} × ${artInfo.h} · ${formatArtBytes(artInfo.bytes)}`
          : hasArt
          ? "embedded"
          : mixedArt
          ? "multiple covers"
          : "no artwork"}
      </div>
      {menu && (
        <div className="art-menu" style={{ top: menuPos.y, left: menuPos.x }}>
          <button
            type="button"
            className="art-menu__item"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onArtExtract(); setMenu(false); }}
          >
            Extract image
          </button>
          <button
            type="button"
            className="art-menu__item"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onArtClick(artUrl); setMenu(false); }}
          >
            Change image
          </button>
          <button
            type="button"
            className="art-menu__item art-menu__item--danger"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onArtRemove(); setMenu(false); }}
          >
            Remove art
          </button>
        </div>
      )}
    </div>
  );
}

// ——— tag editor ———

export default function TagEditor({
  selRows,
  artUrl,
  mixedArt,
  onEdit,
  onArtClick,
  onArtExtract,
  onArtRemove,
}: TagEditorProps) {
  if (selRows.length === 0) {
    return (
      <div className="editor editor--empty">
        <div className="editor__emptymsg mono">
          <span className="kbd">↕</span> select a file to edit its tags
        </div>
      </div>
    );
  }

  const batch = selRows.length > 1;

  const f = (key: keyof EditableTags, label: string, opts?: Partial<TagFieldDef>): TagFieldDef =>
    ({ key, label, ...opts });

  return (
    <div className="editor">
      {/* header */}
      <div className="editor__head">
        <div className="editor__title">
          {batch ? (
            <>
              <span className="batch-badge">{selRows.length}</span>
              <span>files selected</span>
            </>
          ) : (
            <span className="ed-filename mono" title={selRows[0].path}>
              {selRows[0].file}
            </span>
          )}
        </div>
        {batch && <div className="editor__sub mono">edits apply to all selected</div>}
      </div>

      {/* scrollable body */}
      <div className="editor__scroll">
        {/* album art */}
        <div className="editor__art-inline">
          <AlbumArt
            artUrl={artUrl}
            mixedArt={mixedArt}
            hasSel={selRows.length > 0}
            onArtClick={onArtClick}
            onArtExtract={onArtExtract}
            onArtRemove={onArtRemove}
          />
        </div>

        {/* ——— Core section ——— */}
        <div className="tf-section">
          <div className="tf-section__label">Core</div>
          <div className="tf-grid">
            <Field field={f("title",       "Title")}        sel={selRows} onChange={onEdit} />
            <Field field={f("artist",      "Artist")}       sel={selRows} onChange={onEdit} />
            <Field field={f("album",       "Album")}        sel={selRows} onChange={onEdit} />
            <Field field={f("albumArtist", "Album Artist")} sel={selRows} onChange={onEdit} />
            <Field field={f("trackNo", "Track #", { narrow: true, mono: true })} sel={selRows} onChange={onEdit} />
            <Field field={f("year",    "Year",    { narrow: true, mono: true })} sel={selRows} onChange={onEdit} />
            <Field field={f("genre", "Genre")} sel={selRows} onChange={onEdit} />

            <ExpandGroup label="More date fields">
              <div className="tf-grid">
                <Field field={f("yearLegacy",          "Year (TYER)",           { narrow: true, mono: true })} sel={selRows} onChange={onEdit} />
                <Field field={f("releaseDate",         "Release Date",          { narrow: true, mono: true })} sel={selRows} onChange={onEdit} />
                <Field field={f("originalReleaseDate", "Original Release Date", { narrow: true, mono: true })} sel={selRows} onChange={onEdit} />
              </div>
            </ExpandGroup>

            <ExpandGroup label="More credits">
              <div className="tf-grid">
                <Field field={f("lyricist",  "Lyricist")}  sel={selRows} onChange={onEdit} />
                <Field field={f("conductor", "Conductor")} sel={selRows} onChange={onEdit} />
                <Field field={f("arranger",  "Arranger")}  sel={selRows} onChange={onEdit} />
                <Field field={f("remixer",   "Remixer")}   sel={selRows} onChange={onEdit} />
              </div>
            </ExpandGroup>
          </div>
        </div>

        {/* ——— Extended section ——— */}
        <div className="tf-section">
          <div className="tf-section__label">Extended</div>
          <div className="tf-grid">
            <Field field={f("discNo",    "Disc #",   { narrow: true, mono: true })} sel={selRows} onChange={onEdit} />
            <Field field={f("bpm",       "BPM",      { narrow: true, mono: true })} sel={selRows} onChange={onEdit} />
            <Field field={f("composer",  "Composer")}                               sel={selRows} onChange={onEdit} />
            <Field field={f("comment",   "Comment",  { multiline: true })}          sel={selRows} onChange={onEdit} />

            <ExpandGroup label="More comment fields">
              <Field field={f("description", "Description", { multiline: true })} sel={selRows} onChange={onEdit} />
            </ExpandGroup>
          </div>
        </div>

        {/* ——— Sort section ——— */}
        <div className="tf-section">
          <div className="tf-section__label">Sort</div>
          <div className="tf-grid">
            <ExpandGroup label="Sort fields">
              <div className="tf-grid">
                <Field field={f("sortTitle",       "Sort Title")}        sel={selRows} onChange={onEdit} />
                <Field field={f("sortArtist",      "Sort Artist")}       sel={selRows} onChange={onEdit} />
                <Field field={f("sortAlbum",       "Sort Album")}        sel={selRows} onChange={onEdit} />
                <Field field={f("sortAlbumArtist", "Sort Album Artist")} sel={selRows} onChange={onEdit} />
              </div>
            </ExpandGroup>
          </div>
        </div>

        {/* ——— Technical section ——— */}
        <div className="tf-section">
          <div className="tf-section__label">Technical</div>
          <div className="tf-grid">
            <ExpandGroup label="Technical fields">
              <div className="tf-grid">
                <Field field={f("copyright", "Copyright")} sel={selRows} onChange={onEdit} />
                <Field field={f("encodedBy", "Encoded By")} sel={selRows} onChange={onEdit} />
              </div>
            </ExpandGroup>
          </div>
        </div>
      </div>
    </div>
  );
}
