import { EditableTags } from "@/lib/track-row";

// Characters illegal in filenames on Windows/Linux/macOS
const ILLEGAL_CHARS = /[/\\:*?"<>|]/g;

const TOKENS: Record<string, (tags: EditableTags) => string> = {
  title:        (t) => t.title,
  artist:       (t) => t.artist.split("; ")[0]?.trim() ?? "",
  album:        (t) => t.album,
  album_artist: (t) => t.albumArtist.split("; ")[0]?.trim() ?? "",
  track_number: (t) => t.trackNo,
  disc_number:  (t) => t.discNo,
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

  // Tokens support an optional zero-pad width: {track_number:3} → "003"
  let stem = pattern.replace(/\{(\w+)(?::(\d+))?\}/g, (_, key: string, width: string | undefined) => {
    const fn_ = TOKENS[key];
    if (!fn_) return `{${key}}`;
    const value = fn_(tags);
    if (width && /^\d+$/.test(value)) {
      return value.padStart(parseInt(width, 10), "0");
    }
    return value;
  });

  stem = stem.replace(ILLEGAL_CHARS, "");
  stem = stem.replace(/\s+/g, " ").trim();
  stem = stem.replace(/^[.\s]+|[.\s]+$/g, "");

  if (!stem) return originalFilename;

  return ext ? `${stem}.${ext}` : stem;
}
