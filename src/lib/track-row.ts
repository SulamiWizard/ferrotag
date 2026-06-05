import { Track } from "@/types/track";

// Flat string representation of all editable tag fields.
// Artists/album-artists are stored as "; "-joined strings for display/editing.
export interface EditableTags {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  // Year group — recording_date is the primary "Year" field shown in the editor.
  // yearLegacy (TYER/ID3v2.3), releaseDate, and originalReleaseDate are sub-fields.
  year: string;           // recording_date (TDRC / primary)
  yearLegacy: string;     // year (TYER / ID3v2.3)
  releaseDate: string;    // release_date
  originalReleaseDate: string; // original_release_date
  genre: string;
  trackNo: string;
  discNo: string;
  comment: string;
  description: string;    // sub-field under Comment
}

// A loaded track decorated with per-track editable state for dirty tracking.
export interface TrackRow {
  id: string;            // = path, stable unique key
  path: string;
  file: string;          // filename portion of path
  fmt: string;           // format derived from extension (FLAC, MP3, …)
  // artUrl: undefined = not yet loaded; null = loaded, no art; string = data URI
  tags: EditableTags;    // live editable copy
  orig: EditableTags;    // pristine snapshot (updated on save)
  modified: boolean;
  artUrl: string | null | undefined;
  pendingArtPath: string | null;  // staged art image path, written on save
}

export type SortKey = "trackNo" | "title" | "artist" | "album" | "year" | "fmt";
export type SortDir = "asc" | "desc";

export function trackToRow(t: Track): TrackRow {
  const tags = trackToTags(t);
  return {
    id: t.path,
    path: t.path,
    file: t.path.split(/[/\\]/).pop() ?? t.path,
    fmt: pathToFormat(t.path),
    tags,
    orig: { ...tags },
    modified: false,
    artUrl: undefined,
    pendingArtPath: null,
  };
}

function trackToTags(t: Track): EditableTags {
  return {
    title: t.title ?? "",
    artist: t.artists.join("; "),
    album: t.album ?? "",
    albumArtist: t.album_artists.join("; "),
    year: t.recording_date ?? "",
    yearLegacy: t.year ?? "",
    releaseDate: t.release_date ?? "",
    originalReleaseDate: t.original_release_date ?? "",
    genre: t.genre ?? "",
    trackNo: t.track_number ?? "",
    discNo: t.disc_number ?? "",
    comment: t.comment ?? "",
    description: t.description ?? "",
  };
}

export function pathToFormat(path: string): string {
  const ext = (path.split(".").pop() ?? "").toUpperCase();
  return ["FLAC", "WAV", "MP3", "M4A", "OGG", "AIFF", "APE", "OPUS", "WV"].includes(ext)
    ? ext
    : "AUDIO";
}

// Sentinel string for "multiple differing values" in a batch selection.
export const MULTI = "​__MULTI__";

export function sharedTagValue(rows: TrackRow[], key: keyof EditableTags): string {
  if (rows.length === 0) return "";
  const first = rows[0].tags[key];
  return rows.every((r) => r.tags[key] === first) ? first : MULTI;
}

export function isTagsDirty(tags: EditableTags, orig: EditableTags): boolean {
  return (Object.keys(tags) as Array<keyof EditableTags>).some((k) => tags[k] !== orig[k]);
}

export function sortedRows(rows: TrackRow[], key: SortKey, dir: SortDir): TrackRow[] {
  return [...rows].sort((a, b) => {
    let va: string | number, vb: string | number;
    if (key === "trackNo") {
      va = parseInt(a.tags.trackNo, 10) || Infinity;
      vb = parseInt(b.tags.trackNo, 10) || Infinity;
    } else if (key === "fmt") {
      va = a.fmt.toLowerCase();
      vb = b.fmt.toLowerCase();
    } else if (key === "title") {
      va = (a.tags.title || a.file).toLowerCase();
      vb = (b.tags.title || b.file).toLowerCase();
    } else {
      const tagKey: Record<string, keyof EditableTags> = {
        artist: "artist",
        album: "album",
        year: "year",
      };
      va = (a.tags[tagKey[key]] ?? "").toLowerCase();
      vb = (b.tags[tagKey[key]] ?? "").toLowerCase();
    }
    if (va < vb) return dir === "asc" ? -1 : 1;
    if (va > vb) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

// Build the partial changes record to pass to Tauri's save_track.
// Only includes fields that differ from the orig snapshot.
export function buildSaveChanges(tags: EditableTags, orig: EditableTags): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if (tags.title !== orig.title) c.title = tags.title;
  if (tags.artist !== orig.artist)
    c.artists = tags.artist.split("; ").map((s) => s.trim()).filter(Boolean);
  if (tags.album !== orig.album) c.album = tags.album;
  if (tags.albumArtist !== orig.albumArtist)
    c.album_artists = tags.albumArtist.split("; ").map((s) => s.trim()).filter(Boolean);
  if (tags.year !== orig.year) c.recording_date = tags.year;
  if (tags.yearLegacy !== orig.yearLegacy) c.year = tags.yearLegacy;
  if (tags.releaseDate !== orig.releaseDate) c.release_date = tags.releaseDate;
  if (tags.originalReleaseDate !== orig.originalReleaseDate)
    c.original_release_date = tags.originalReleaseDate;
  if (tags.genre !== orig.genre) c.genre = tags.genre;
  if (tags.trackNo !== orig.trackNo) c.track_number = tags.trackNo;
  if (tags.discNo !== orig.discNo) c.disc_number = tags.discNo;
  if (tags.comment !== orig.comment) c.comment = tags.comment;
  if (tags.description !== orig.description) c.description = tags.description;
  return c;
}
