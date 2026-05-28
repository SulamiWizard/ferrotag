import { invoke } from "@tauri-apps/api/core";

export async function saveTrack(path: string, fields: Record<string, unknown>) {
  const changes = {
    ...fields,
    artists:
      typeof fields.artists === "string"
        ? fields.artists
            .split("\\\\")
            .map((a: string) => a.trim())
            .filter(Boolean)
        : fields.artists,
    album_artists:
      typeof fields.album_artists === "string"
        ? fields.album_artists
            .split("\\\\")
            .map((a: string) => a.trim())
            .filter(Boolean)
        : fields.album_artists,
  };

  await invoke("save_track", { path, changes });
}
