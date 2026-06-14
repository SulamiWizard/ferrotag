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

const TOKEN_RE = /\{(\w+)(?::(\d+))?\}/g;

// Resolve a single {token} or {token:N} to its string value.
// Returns "" when the token resolves to an empty value.
// Returns the original "{key}" text for unknown tokens.
function resolveToken(
  key: string,
  numStr: string | undefined,
  tags: EditableTags,
): string {
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
}

export function applyRenamePattern(
  pattern: string,
  tags: EditableTags,
  currentPath: string,
): string {
  const ext = currentPath.split(".").pop() ?? "";
  const originalFilename = currentPath.split(/[/\\]/).pop() ?? currentPath;

  // Optional segments [...] are only included when every token inside resolves
  // to a non-empty string.  Use this to attach surrounding punctuation/spaces
  // that should disappear when a value is absent.
  // Example: {artist:1}[, {artist:2}] — the ", " is dropped for single-artist tracks.
  let stem = pattern.replace(/\[([^\]]*)\]/g, (_, inner: string) => {
    let empty = false;
    const rendered = inner.replace(
      TOKEN_RE,
      (_, key: string, numStr?: string) => {
        const v = resolveToken(key, numStr, tags);
        if (!v || v.startsWith("{")) empty = true;
        return v;
      },
    );
    return empty ? "" : rendered;
  });

  // Regular (non-optional) tokens
  stem = stem.replace(TOKEN_RE, (_, key: string, numStr?: string) =>
    resolveToken(key, numStr, tags),
  );

  stem = stem.replace(ILLEGAL_CHARS, "");
  stem = stem.replace(/\s+/g, " ").trim();
  stem = stem.replace(/^[.\s]+|[.\s]+$/g, "");

  if (!stem) return originalFilename;

  return ext ? `${stem}.${ext}` : stem;
}
