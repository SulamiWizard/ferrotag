import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface MetadataFieldProps {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
}

function MetadataField({ label, value, onChange }: MetadataFieldProps) {
  // TODO:
  // after wiring real metadata from rust, this state should get lifted to
  // App.tsx and pass down value and onChange as props, local state will then go away
  // and the parent will own it
  const [local, setLocal] = useState(value ?? "");
  return (
    <div>
      <Label>{label}</Label>
      <Input
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          onChange?.(e.target.value);
        }}
        className="h-7 text-sm"
      />
    </div>
  );
}
export default function MetadataPane() {
  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full w-full">
      <MetadataField label="Title" />
      <MetadataField label="Artist" />
      <MetadataField label="Album" />
      <MetadataField label="Album Artist" />
      <MetadataField label="Year" />
      <MetadataField label="Track" />
      <MetadataField label="Disc Number" />
      <MetadataField label="Genre" />
      <MetadataField label="Comment" />

      {/* Album art section */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Album Art</Label>
        <div className="w-full aspect-square bg-muted rounded flex items-center justify-center border">
          <span className="text-xs text-muted-foreground">No art</span>
        </div>
      </div>

      {/* Directory is read-only */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Directory</Label>
        <Input
          readOnly
          className="h-7 text-sm text-muted-foreground bg-muted"
        />
      </div>
    </div>
  );
}
