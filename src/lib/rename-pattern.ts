import { EditableTags } from "@/lib/track-row";

// Characters illegal in filenames on Windows/Linux/macOS
const ILLEGAL_CHARS = /[/\\:*?"<>|]/g;

const TOKENS: Record<string, (tags: EditableTags) => string> = {
  title:        (t) => t.title,
  artist:       (t) => t.artist.split("; ")[0]?.trim() ?? "",
  album:        (t) => t.album,
  album_artist: (t) => t.albumArtist.split("; ")[0]?.trim() ?? "",
  track_number: (t) => /^\d+$/.test(t.trackNo) ? t.trackNo.padStart(2, "0") : t.trackNo,
  disc_number:  (t) => /^\d+$/.test(t.discNo)  ? t.discNo.padStart(2, "0")  : t.discNo,
  year:         (t) => t.year,
  genre:        (t) => t.genre,
  composer:     (t) => t.composer,
  bpm:          (t) => t.bpm,
};

export const RENAME_TOKEN_LIST = Object.keys(TOKENS).map((k) => `{${k}}`);

export function applyRenamePattern(
  pattern: string,
  tags: EditableTags,
  currentPath: string,
): string {
  const ext = currentPath.split(".").pop() ?? "";
  const originalFilename = currentPath.split(/[/\\]/).pop() ?? currentPath;

  let stem = pattern.replace(/\{(\w+)\}/g, (_, key: string) => {
    const fn_ = TOKENS[key];
    return fn_ ? fn_(tags) : `{${key}}`;
  });

  stem = stem.replace(ILLEGAL_CHARS, "");
  stem = stem.replace(/\s+/g, " ").trim();
  stem = stem.replace(/^[.\s]+|[.\s]+$/g, "");

  if (!stem) return originalFilename;

  return ext ? `${stem}.${ext}` : stem;
}
