import { invoke } from "@tauri-apps/api/core";

// Sends pending metadata changes for a single file to Rust via the save_track command.
// Artists are edited as "; " delimited strings in the UI (e.g. "Artist A; Artist B")
// but Rust expects string arrays, so this function splits them before invoking.
// Only fields present in `fields` are written — omitted fields are left untouched.
export async function saveTrack(path: string, fields: Record<string, unknown>) {
  const changes = {
    ...fields,
    artists:
      typeof fields.artists === "string"
        ? fields.artists
            .split("; ")
            .map((a: string) => a.trim())
            .filter(Boolean)
        : fields.artists,
    album_artists:
      typeof fields.album_artists === "string"
        ? fields.album_artists
            .split("; ")
            .map((a: string) => a.trim())
            .filter(Boolean)
        : fields.album_artists,
  };

  await invoke("save_track", { path, changes });
}
