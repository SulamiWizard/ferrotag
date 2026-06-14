import { EditableTags } from "@/lib/track-row";

// Characters illegal in filenames on Windows/Linux/macOS
const ILLEGAL_CHARS = /[/\\:*?"<>|]/g;

// Tokens whose value is a "; "-joined list — support {token:N} to pick the Nth entry (1-based).
const MULTI_VALUE_TOKENS = new Set(["artist", "album_artist"]);

const TOKENS: Record<string, (tags: EditableTags) => string> = {
  title: (t) => t.title,
  artist: (t) => t.artist,
  album: (t) => t.album,
  album_artist: (t) => t.albumArtist,
  track_number: (t) => t.trackNo,
  disc_number: (t) => t.discNo,
  year: (t) => t.year,
  genre: (t) => t.genre,
  composer: (t) => t.composer,
  bpm: (t) => t.bpm,
};

export const RENAME_TOKEN_LIST = Object.keys(TOKENS).map((k) => `{${k}}`);

export function applyRenamePattern(
  pattern: string,
  tags: EditableTags,
  currentPath: string,
): string {
  const ext = currentPath.split(".").pop() ?? "";
  const originalFilename = currentPath.split(/[/\\]/).pop() ?? currentPath;

  // {token:N} — for multi-value tokens (artist, album_artist) N is a 1-based index;
  // for numeric tokens (track_number, disc_number) N is a zero-pad width.
  let stem = pattern.replace(
    /\{(\w+)(?::(\d+))?\}/g,
    (_, key: string, numStr: string | undefined) => {
      const fn_ = TOKENS[key];
      if (!fn_) return `{${key}}`;
      const value = fn_(tags);
      const num = numStr !== undefined ? parseInt(numStr, 10) : undefined;
      if (MULTI_VALUE_TOKENS.has(key)) {
        const idx = (num ?? 1) - 1;
        return value.split("; ")[idx]?.trim() ?? "";
      }
      if (num !== undefined && /^\d+$/.test(value)) {
        return value.padStart(num, "0");
      }
      return value;
    },
  );

  stem = stem.replace(ILLEGAL_CHARS, "");
  stem = stem.replace(/\s+/g, " ").trim();
  stem = stem.replace(/^[.\s]+|[.\s]+$/g, "");

  if (!stem) return originalFilename;

  return ext ? `${stem}.${ext}` : stem;
}
