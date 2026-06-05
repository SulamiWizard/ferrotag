import { Track } from "@/types/track";

// Flat string representation of all editable tag fields.
// Artists/album-artists are stored as "; "-joined strings for display/editing.
export interface EditableTags {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  year: string;
  yearLegacy: string;
  releaseDate: string;
  originalReleaseDate: string;
  genre: string;
  trackNo: string;
  discNo: string;
  composer: string;
  bpm: string;
  comment: string;
  description: string;
  lyricist: string;
  conductor: string;
  arranger: string;
  remixer: string;
  copyright: string;
  encodedBy: string;
  sortTitle: string;
  sortArtist: string;
  sortAlbum: string;
  sortAlbumArtist: string;
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
  pendingArtPath: string | null;
  pendingArtRemove: boolean;
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
    pendingArtRemove: false,
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
    composer: t.composer ?? "",
    bpm: t.bpm ?? "",
    comment: t.comment ?? "",
    description: t.description ?? "",
    lyricist: t.lyricist ?? "",
    conductor: t.conductor ?? "",
    arranger: t.arranger ?? "",
    remixer: t.remixer ?? "",
    copyright: t.copyright ?? "",
    encodedBy: t.encoded_by ?? "",
    sortTitle: t.sort_title ?? "",
    sortArtist: t.sort_artist ?? "",
    sortAlbum: t.sort_album ?? "",
    sortAlbumArtist: t.sort_album_artist ?? "",
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
  if (tags.composer !== orig.composer) c.composer = tags.composer;
  if (tags.bpm !== orig.bpm) c.bpm = tags.bpm;
  if (tags.comment !== orig.comment) c.comment = tags.comment;
  if (tags.description !== orig.description) c.description = tags.description;
  if (tags.lyricist !== orig.lyricist) c.lyricist = tags.lyricist;
  if (tags.conductor !== orig.conductor) c.conductor = tags.conductor;
  if (tags.arranger !== orig.arranger) c.arranger = tags.arranger;
  if (tags.remixer !== orig.remixer) c.remixer = tags.remixer;
  if (tags.copyright !== orig.copyright) c.copyright = tags.copyright;
  if (tags.encodedBy !== orig.encodedBy) c.encoded_by = tags.encodedBy;
  if (tags.sortTitle !== orig.sortTitle) c.sort_title = tags.sortTitle;
  if (tags.sortArtist !== orig.sortArtist) c.sort_artist = tags.sortArtist;
  if (tags.sortAlbum !== orig.sortAlbum) c.sort_album = tags.sortAlbum;
  if (tags.sortAlbumArtist !== orig.sortAlbumArtist) c.sort_album_artist = tags.sortAlbumArtist;
  return c;
}
