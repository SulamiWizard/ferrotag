import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Track } from "@/types/track";
import { useState } from "react";

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
    <div>
      <Label>{label}</Label>
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
  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full w-full">
      <MetadataField label="Title" value={track?.title} />
      <MetadataField label="Artist" value={track?.artists.join("\\\\")} />
      <MetadataField label="Album" value={track?.album} />
      <MetadataField
        label="Album Artist"
        value={track?.album_artists.join("\\\\")}
      />
      <MetadataField label="Year" value={track?.year} />
      <MetadataField label="Track" value={track?.track_number} />
      <MetadataField label="Disc Number" value={track?.disc_number} />
      <MetadataField label="Genre" value={track?.genre} />
      <MetadataField label="Comment" value={track?.comment} />

      {/* Album art section */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Album Art</Label>
        <div className="w-full aspect-square bg-muted rounded flex items-center justify-center border">
          {albumArt ? (
            <img
              src={albumArt}
              alt="Album Art"
              className="h-full w-full object-contain"
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
