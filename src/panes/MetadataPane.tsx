import { ChevronRight, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Track } from "@/types/track";
import { useEffect, useRef, useState } from "react";

interface MetadataPaneProps {
  tracks: Track[];
  albumArt: string | null;
  onEdit: (field: keyof Track, value: string | undefined) => void;
  onArtClick: () => void;
  onArtExtract: () => void;
}

// null = mixed values across selected tracks → show <keep> placeholder
function sharedValue(tracks: Track[], field: keyof Track): string | null {
  if (tracks.length === 0) return "";
  const values = tracks.map((t) => {
    const v = t[field];
    if (Array.isArray(v)) return v.join("\\\\");
    return (v as string | undefined) ?? "";
  });
  const first = values[0];
  return values.every((v) => v === first) ? first : null;
}

function initialFields(tracks: Track[]) {
  return {
    title: sharedValue(tracks, "title"),
    artists: sharedValue(tracks, "artists"),
    album: sharedValue(tracks, "album"),
    album_artists: sharedValue(tracks, "album_artists"),
    year: sharedValue(tracks, "year"),
    release_date: sharedValue(tracks, "release_date"),
    recording_date: sharedValue(tracks, "recording_date"),
    original_release_date: sharedValue(tracks, "original_release_date"),
    track_number: sharedValue(tracks, "track_number"),
    disc_number: sharedValue(tracks, "disc_number"),
    genre: sharedValue(tracks, "genre"),
    comment: sharedValue(tracks, "comment"),
    description: sharedValue(tracks, "description"),
  };
}

interface ComboInputProps {
  value: string | null;
  originalValue: string | null;
  onChange: (value: string) => void;
  onKeep: () => void;
  onBlank: () => void;
}

function ComboInput({ value, originalValue, onChange, onKeep, onBlank }: ComboInputProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex w-full">
      <Input
        value={value ?? ""}
        placeholder={value === null ? "<keep>" : ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-sm rounded-r-none border-r-0"
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-7 px-1.5 border border-input rounded-r-md bg-background hover:bg-muted transition-colors shrink-0"
      >
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-0.5 bg-popover border border-border rounded-md shadow-md overflow-hidden">
          {originalValue !== null && originalValue !== "" && (
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors truncate"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(originalValue); setOpen(false); }}
            >
              {originalValue}
            </button>
          )}
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors font-mono"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onKeep(); setOpen(false); }}
          >
            &lt;keep&gt;
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors font-mono"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onBlank(); setOpen(false); }}
          >
            &lt;blank&gt;
          </button>
        </div>
      )}
    </div>
  );
}

interface ComboFieldProps {
  label: string;
  value: string | null;
  originalValue: string | null;
  onChange: (value: string) => void;
  onKeep: () => void;
  onBlank: () => void;
}

function ComboField({ label, value, originalValue, onChange, onKeep, onBlank }: ComboFieldProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <ComboInput value={value} originalValue={originalValue} onChange={onChange} onKeep={onKeep} onBlank={onBlank} />
    </div>
  );
}

interface CollapsibleComboGroupProps {
  primaryLabel: string;
  primaryValue: string | null;
  primaryOriginalValue: string | null;
  onPrimaryChange: (value: string) => void;
  onPrimaryKeep: () => void;
  onPrimaryBlank: () => void;
  children: React.ReactNode;
}

function CollapsibleComboGroup({
  primaryLabel,
  primaryValue,
  primaryOriginalValue,
  onPrimaryChange,
  onPrimaryKeep,
  onPrimaryBlank,
  children,
}: CollapsibleComboGroupProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1 w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 w-fit"
      >
        <ChevronRight
          className={`h-3 w-3 text-muted-foreground transition-transform duration-150 ${open ? "rotate-90" : ""}`}
        />
        <Label className="text-xs text-muted-foreground cursor-pointer pointer-events-none">
          {primaryLabel}
        </Label>
      </button>
      <ComboInput
        value={primaryValue}
        originalValue={primaryOriginalValue}
        onChange={onPrimaryChange}
        onKeep={onPrimaryKeep}
        onBlank={onPrimaryBlank}
      />
      {open && (
        <div className="flex flex-col gap-3 ml-2 pl-3 border-l border-border mt-1">
          {children}
        </div>
      )}
    </div>
  );
}

export default function MetadataPane({ tracks, albumArt, onEdit, onArtClick, onArtExtract }: MetadataPaneProps) {
  const [fields, setFields] = useState(initialFields(tracks));
  const [originals, setOriginals] = useState(initialFields(tracks));

  useEffect(() => {
    const init = initialFields(tracks);
    setFields(init);
    setOriginals(init);
  }, [tracks]);

  const handleChange = (field: keyof typeof fields, value: string) => {
    setFields((prev) => ({ ...prev, [field]: value }));
    onEdit(field as keyof Track, value);
  };

  const handleKeep = (field: keyof typeof fields) => {
    setFields((prev) => ({ ...prev, [field]: sharedValue(tracks, field as keyof Track) }));
    onEdit(field as keyof Track, undefined);
  };

  const handleBlank = (field: keyof typeof fields) => {
    setFields((prev) => ({ ...prev, [field]: "" }));
    onEdit(field as keyof Track, "");
  };

  const [artContextMenu, setArtContextMenu] = useState(false);
  const artContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!artContextMenu) return;
    const handler = (e: MouseEvent) => {
      if (!artContainerRef.current?.contains(e.target as Node))
        setArtContextMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [artContextMenu]);

  const firstTrack = tracks[0] ?? null;

  return (
    <div className="flex flex-col gap-3 p-3 w-full">
      <ComboField
        label="Title"
        value={fields.title}
        originalValue={originals.title}
        onChange={(v) => handleChange("title", v)}
        onKeep={() => handleKeep("title")}
        onBlank={() => handleBlank("title")}
      />
      <ComboField
        label="Artist"
        value={fields.artists}
        originalValue={originals.artists}
        onChange={(v) => handleChange("artists", v)}
        onKeep={() => handleKeep("artists")}
        onBlank={() => handleBlank("artists")}
      />
      <ComboField
        label="Album"
        value={fields.album}
        originalValue={originals.album}
        onChange={(v) => handleChange("album", v)}
        onKeep={() => handleKeep("album")}
        onBlank={() => handleBlank("album")}
      />
      <ComboField
        label="Album Artist"
        value={fields.album_artists}
        originalValue={originals.album_artists}
        onChange={(v) => handleChange("album_artists", v)}
        onKeep={() => handleKeep("album_artists")}
        onBlank={() => handleBlank("album_artists")}
      />

      <CollapsibleComboGroup
        primaryLabel="Year"
        primaryValue={fields.recording_date}
        primaryOriginalValue={originals.recording_date}
        onPrimaryChange={(v) => handleChange("recording_date", v)}
        onPrimaryKeep={() => handleKeep("recording_date")}
        onPrimaryBlank={() => handleBlank("recording_date")}
      >
        <ComboField
          label="Year (TYER)"
          value={fields.year}
          originalValue={originals.year}
          onChange={(v) => handleChange("year", v)}
          onKeep={() => handleKeep("year")}
          onBlank={() => handleBlank("year")}
        />
        <ComboField
          label="Release Date"
          value={fields.release_date}
          originalValue={originals.release_date}
          onChange={(v) => handleChange("release_date", v)}
          onKeep={() => handleKeep("release_date")}
          onBlank={() => handleBlank("release_date")}
        />
        <ComboField
          label="Original Release Date"
          value={fields.original_release_date}
          originalValue={originals.original_release_date}
          onChange={(v) => handleChange("original_release_date", v)}
          onKeep={() => handleKeep("original_release_date")}
          onBlank={() => handleBlank("original_release_date")}
        />
      </CollapsibleComboGroup>

      <CollapsibleComboGroup
        primaryLabel="Track"
        primaryValue={fields.track_number}
        primaryOriginalValue={originals.track_number}
        onPrimaryChange={(v) => handleChange("track_number", v)}
        onPrimaryKeep={() => handleKeep("track_number")}
        onPrimaryBlank={() => handleBlank("track_number")}
      >
        <ComboField
          label="Disc Number"
          value={fields.disc_number}
          originalValue={originals.disc_number}
          onChange={(v) => handleChange("disc_number", v)}
          onKeep={() => handleKeep("disc_number")}
          onBlank={() => handleBlank("disc_number")}
        />
      </CollapsibleComboGroup>

      <ComboField
        label="Genre"
        value={fields.genre}
        originalValue={originals.genre}
        onChange={(v) => handleChange("genre", v)}
        onKeep={() => handleKeep("genre")}
        onBlank={() => handleBlank("genre")}
      />

      <CollapsibleComboGroup
        primaryLabel="Comment"
        primaryValue={fields.comment}
        primaryOriginalValue={originals.comment}
        onPrimaryChange={(v) => handleChange("comment", v)}
        onPrimaryKeep={() => handleKeep("comment")}
        onPrimaryBlank={() => handleBlank("comment")}
      >
        <ComboField
          label="Description"
          value={fields.description}
          originalValue={originals.description}
          onChange={(v) => handleChange("description", v)}
          onKeep={() => handleKeep("description")}
          onBlank={() => handleBlank("description")}
        />
      </CollapsibleComboGroup>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Album Art</Label>
        <div ref={artContainerRef} className="relative w-full max-w-60">
          <div
            onClick={tracks.length > 0 ? onArtClick : undefined}
            onContextMenu={(e) => {
              if (!albumArt) return;
              e.preventDefault();
              setArtContextMenu(true);
            }}
            className={`w-full aspect-square bg-muted/50 rounded-lg overflow-hidden flex items-center justify-center border border-border/50 group relative
              ${tracks.length > 0 ? "cursor-pointer" : ""}`}
          >
            {albumArt ? (
              <img src={albumArt} alt="Album Art" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground/50 select-none">
                {tracks.length > 0 ? "Click to add art" : "No art"}
              </span>
            )}
            {tracks.length > 0 && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-medium select-none">Change image</span>
              </div>
            )}
          </div>
          {artContextMenu && (
            <div className="absolute top-2 left-2 z-50 bg-popover border border-border rounded-md shadow-md overflow-hidden">
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors whitespace-nowrap"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onArtExtract(); setArtContextMenu(false); }}
              >
                Extract image
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors whitespace-nowrap"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onArtClick(); setArtContextMenu(false); }}
              >
                Change image
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Directory</Label>
        <Input
          readOnly
          value={
            tracks.length === 0
              ? ""
              : tracks.length === 1
                ? firstTrack!.path
                : `${tracks.length} files selected`
          }
          className="h-7 text-sm text-muted-foreground bg-muted"
        />
      </div>
    </div>
  );
}
