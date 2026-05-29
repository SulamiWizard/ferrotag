import { ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Track } from "@/types/track";
import { useEffect, useState } from "react";

interface MetadataFieldProps {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
}

interface CollapsibleMetadataGroupProps {
  primaryLabel: string;
  primaryValue?: string;
  onPrimaryChange?: (value: string) => void;
  children: React.ReactNode;
}

interface MetadataPaneProps {
  track: Track | null;
  albumArt: string | null;
  onEdit: (field: keyof Track, value: string) => void;
}

function MetadataField({ label, value, onChange }: MetadataFieldProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="h-7 text-sm w-full"
      />
    </div>
  );
}

function CollapsibleMetadataGroup({
  primaryLabel,
  primaryValue,
  onPrimaryChange,
  children,
}: CollapsibleMetadataGroupProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1 w-full">
      <button
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
      <Input
        value={primaryValue ?? ""}
        onChange={(e) => onPrimaryChange?.(e.target.value)}
        className="h-7 text-sm w-full"
      />
      {open && (
        <div className="flex flex-col gap-3 ml-2 pl-3 border-l border-border mt-1">
          {children}
        </div>
      )}
    </div>
  );
}

export default function MetadataPane({
  track,
  albumArt,
  onEdit,
}: MetadataPaneProps) {
  const [fields, setFields] = useState({
    title: track?.title ?? "",
    artists: track?.artists.join("\\\\") ?? "",
    album: track?.album ?? "",
    album_artists: track?.album_artists.join("\\\\") ?? "",
    year: track?.year ?? "",
    release_date: track?.release_date ?? "",
    recording_date: track?.recording_date ?? "",
    original_release_date: track?.original_release_date ?? "",
    track_number: track?.track_number ?? "",
    disc_number: track?.disc_number ?? "",
    genre: track?.genre ?? "",
    comment: track?.comment ?? "",
    description: track?.description ?? "",
  });

  useEffect(() => {
    setFields({
      title: track?.title ?? "",
      artists: track?.artists.join("\\\\") ?? "",
      album: track?.album ?? "",
      album_artists: track?.album_artists.join("\\\\") ?? "",
      year: track?.year ?? "",
      release_date: track?.release_date ?? "",
      recording_date: track?.recording_date ?? "",
      original_release_date: track?.original_release_date ?? "",
      track_number: track?.track_number ?? "",
      disc_number: track?.disc_number ?? "",
      genre: track?.genre ?? "",
      comment: track?.comment ?? "",
      description: track?.description ?? "",
    });
  }, [track]);

  const handleChange = (field: keyof typeof fields, value: string) => {
    setFields((prev) => ({ ...prev, [field]: value }));
    onEdit(field as keyof Track, value);
  };

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full w-full">
      <MetadataField
        label="Title"
        value={fields.title}
        onChange={(v) => handleChange("title", v)}
      />
      <MetadataField
        label="Artist"
        value={fields.artists}
        onChange={(v) => handleChange("artists", v)}
      />
      <MetadataField
        label="Album"
        value={fields.album}
        onChange={(v) => handleChange("album", v)}
      />
      <MetadataField
        label="Album Artist"
        value={fields.album_artists}
        onChange={(v) => handleChange("album_artists", v)}
      />

      <CollapsibleMetadataGroup
        primaryLabel="Year"
        primaryValue={fields.year}
        onPrimaryChange={(v) => handleChange("year", v)}
      >
        <MetadataField
          label="Release Date"
          value={fields.release_date}
          onChange={(v) => handleChange("release_date", v)}
        />
        <MetadataField
          label="Recording Date"
          value={fields.recording_date}
          onChange={(v) => handleChange("recording_date", v)}
        />
        <MetadataField
          label="Original Release Date"
          value={fields.original_release_date}
          onChange={(v) => handleChange("original_release_date", v)}
        />
      </CollapsibleMetadataGroup>

      <CollapsibleMetadataGroup
        primaryLabel="Track"
        primaryValue={fields.track_number}
        onPrimaryChange={(v) => handleChange("track_number", v)}
      >
        <MetadataField
          label="Disc Number"
          value={fields.disc_number}
          onChange={(v) => handleChange("disc_number", v)}
        />
      </CollapsibleMetadataGroup>

      <MetadataField
        label="Genre"
        value={fields.genre}
        onChange={(v) => handleChange("genre", v)}
      />

      <CollapsibleMetadataGroup
        primaryLabel="Comment"
        primaryValue={fields.comment}
        onPrimaryChange={(v) => handleChange("comment", v)}
      >
        <MetadataField
          label="Description"
          value={fields.description}
          onChange={(v) => handleChange("description", v)}
        />
      </CollapsibleMetadataGroup>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Album Art</Label>
        <div className="w-full max-w-80 max-h-80 bg-muted rounded overflow-hidden flex items-center justify-center border">
          {albumArt ? (
            <img
              src={albumArt}
              alt="Album Art"
              className="max-w-full max-h-80 object-contain"
            />
          ) : (
            <span className="text-xs text-muted-foreground">No art</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Directory</Label>
        <Input
          readOnly
          value={track?.path ?? ""}
          className="h-7 text-sm text-muted-foreground bg-muted"
        />
      </div>
    </div>
  );
}
