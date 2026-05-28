import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Track } from "@/types/track";
import { useEffect, useState } from "react";

interface MetadataFieldProps {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
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

export default function MetadataPane({
  track,
  albumArt,
  onEdit,
}: MetadataPaneProps) {
  // local track state to allow for the inputs to update as you type
  const [fields, setFields] = useState({
    title: track?.title ?? "",
    artists: track?.artists.join("\\\\") ?? "",
    album: track?.album ?? "",
    album_artists: track?.album_artists.join("\\\\") ?? "",
    year: track?.year ?? "",
    track_number: track?.track_number ?? "",
    disc_number: track?.disc_number ?? "",
    genre: track?.genre ?? "",
    comment: track?.comment ?? "",
  });
  // when a new track is selected, reset the fields
  useEffect(() => {
    setFields({
      title: track?.title ?? "",
      artists: track?.artists.join("\\\\") ?? "",
      album: track?.album ?? "",
      album_artists: track?.album_artists.join("\\\\") ?? "",
      year: track?.year ?? "",
      track_number: track?.track_number ?? "",
      disc_number: track?.disc_number ?? "",
      genre: track?.genre ?? "",
      comment: track?.comment ?? "",
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
      <MetadataField
        label="Year"
        value={fields.year}
        onChange={(v) => handleChange("year", v)}
      />
      <MetadataField
        label="Track"
        value={fields.track_number}
        onChange={(v) => handleChange("track_number", v)}
      />
      <MetadataField
        label="Disc Number"
        value={fields.disc_number}
        onChange={(v) => handleChange("disc_number", v)}
      />
      <MetadataField
        label="Genre"
        value={fields.genre}
        onChange={(v) => handleChange("genre", v)}
      />
      <MetadataField
        label="Comment"
        value={fields.comment}
        onChange={(v) => handleChange("comment", v)}
      />

      {/* Album art section */}
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

      {/* Directory is read-only */}
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
