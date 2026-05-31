// Mirrors the Rust TrackMetadata struct in src-tauri/src/metadata/track.rs.
// Tauri serializes the struct to JSON and TypeScript deserializes it automatically,
// so field names must match exactly (snake_case on both sides).
//
// If you add a new field: add it here, add it to TrackMetadata in Rust,
// read it in metadata/track.rs (read_track), and write it in commands/tags.rs (save_track).
//
// artists and album_artists are arrays because a track can have multiple.
// In the UI they're joined/split with "\\" as a delimiter — see src/lib/tauri.ts.
export interface Track {
  path: string;
  title?: string;
  artists: string[];
  album?: string;
  album_artists: string[];
  year?: string;
  release_date?: string;
  recording_date?: string;
  original_release_date?: string;
  track_number?: string;
  disc_number?: string;
  genre?: string;
  comment?: string;
  description?: string;
}
