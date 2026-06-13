# Ferrotag

A fast, minimal desktop music tag editor built with Tauri, React, and Rust.

![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- Edit tags for MP3, FLAC, OGG, M4A, WAV, AIFF, APE, Opus, and WavPack files
- Open individual files or entire folders via the file picker, or drag and drop either onto the window
- Batch edit — select multiple tracks and update shared fields at once
- Album art — embed, replace, extract, or remove cover art; drag an image onto the art well to set it
- File renamer — rename files on save or instantly (without saving tags) using patterns like `{artist} – {track_number:2} – {title}`; supports `{artist:2}` for multi-artist files; pattern persists between sessions
- Metadata rules — batch-transform tags via an optional `rules.json`: trim whitespace globally, zero-pad numbers, extract year from dates, copy one field to another, and more; supports multiple ops per field and a `*` wildcard to target all fields at once
- Extended tag support: credits, sort fields, dates, BPM, comments, and more
- Virtualised file list — smooth scrolling for libraries of any size
- Progressive loading — tracks stream into the list as they are read, no waiting for the full scan to finish
- Resizable split-panel interface with recursive folder scanning, resizable file-list columns, and a metadata pane you can move to either side — all of which persist
- Keyboard shortcuts: `Ctrl+S` save, `Ctrl+A` select all, `↑ ↓` navigate

## Supported Formats

| Format | Extension |
|--------|-----------|
| MP3 | `.mp3` |
| FLAC | `.flac` |
| OGG Vorbis | `.ogg` |
| MPEG-4 Audio | `.m4a` |
| WAV | `.wav` |
| AIFF | `.aiff` |
| Monkey's Audio | `.ape` |
| Opus | `.opus` |
| WavPack | `.wv` |

## Rename Patterns

Type a pattern in the **Rename:** toolbar field. Files are renamed whenever you **Save**, but you can also click the **→** button next to the field to rename all loaded files immediately without saving any tag changes. Leave the field empty to skip renaming.

Available tokens:

| Token | Value |
|-------|-------|
| `{title}` | Track title |
| `{artist}` | Primary (first) artist |
| `{album}` | Album name |
| `{album_artist}` | Primary (first) album artist |
| `{track_number}` | Track number |
| `{disc_number}` | Disc number |
| `{year}` | Year |
| `{genre}` | Genre |
| `{composer}` | Composer |
| `{bpm}` | BPM |

**Multiple artists** — for files with more than one artist (e.g. FLAC), append a 1-based index to pick a specific one:

| Pattern | Artists | Result |
|---------|---------|--------|
| `{artist}` | `Alice; Bob` | `Alice` |
| `{artist:1}` | `Alice; Bob` | `Alice` |
| `{artist:2}` | `Alice; Bob` | `Bob` |

`{artist}` and `{artist:1}` are equivalent and always return the primary artist. Returns an empty string if the index exceeds the number of artists. `{album_artist}` supports the same syntax.

**Zero-padding** — numeric tokens accept an optional pad width:

| Pattern | Tag value | Result |
|---------|-----------|--------|
| `{track_number}` | `3` | `3` |
| `{track_number:2}` | `3` | `03` |
| `{track_number:3}` | `3` | `003` |

Padding is only applied when the tag value is a plain integer. Non-numeric values (e.g. `03/12`) are left as-is.

Example: `{track_number:2} – {title}` → `03 – Blue in Green.flac`

The original file extension is always preserved. Characters illegal in filenames are stripped automatically.

## Metadata Rules

Rules let you batch-clean tags across every loaded file. Choose **Edit → Apply Rules to All** to run them, then **Save** to write the changes to disk (nothing is written until you save).

Rules are **optional** and require no setup — there are no rules out of the box, so Apply Rules does nothing until you add some. To customize them, choose **Edit → Edit Rules File…**, which creates `rules.json` (if it doesn't exist yet) and opens it in your default editor. The file is self-documenting.

Config location:

| OS | Path |
|----|------|
| Linux | `~/.config/ferrotag/rules.json` |
| macOS | `~/Library/Application Support/ferrotag/rules.json` |
| Windows | `%APPDATA%\ferrotag\rules.json` |

Each rule targets a `field` and specifies one or more ops to run on it.

Rules run top to bottom. Any extra keys (such as `_README`) are ignored, and individual invalid rules are skipped with a warning rather than failing the whole file.

### Single op

```json
{
  "rules": [
    { "field": "track_number", "op": "pad", "width": 2 },
    { "field": "disc_number",  "op": "pad", "width": 2 },
    { "field": "year",         "op": "yearOnly" },
    { "field": "genre",        "op": "blank" }
  ]
}
```

### Multiple ops on one field

Pass an array to `op`. Bare strings work for ops that need no parameters; use an object for ops that take parameters:

```json
{
  "rules": [
    {
      "field": "track_number",
      "op": ["trim", { "op": "pad", "width": 2 }]
    }
  ]
}
```

Ops in the array run left to right, each receiving the output of the previous one.

### Wildcard field

Use `"*"` as the field to apply an op to every field at once:

```json
{
  "rules": [
    { "field": "*", "op": "trim" }
  ]
}
```

Putting the wildcard rule first means all fields are trimmed before your field-specific rules run.

### Copy from another field

The `copy` op sets a field to the current value of another field:

```json
{
  "rules": [
    { "field": "*",           "op": "trim" },
    { "field": "sort_artist", "op": { "op": "copy", "from": "artist" } }
  ]
}
```

`copy` reads from the in-progress state, so it picks up values already modified by earlier rules in the same run. It can also be combined with other ops in an array:

```json
{
  "rules": [
    {
      "field": "sort_artist",
      "op": [{ "op": "copy", "from": "artist" }, "trim"]
    }
  ]
}
```

### Available ops

| Op | Extra key | Effect |
|----|-----------|--------|
| `trim` | — | Removes leading/trailing whitespace |
| `blank` | — | Clears the field |
| `set` | `value` | Sets the field to a fixed string |
| `pad` | `width` | Zero-pads a number to `width` digits (`3` → `03`, `3/12` → `03/12`); non-numeric values are left as-is |
| `yearOnly` | — | Reduces a date to its first 4-digit year (`2021-05-13` → `2021`) |
| `copy` | `from` | Copies the value of another field into this one |

### Available fields

`title`, `artist`, `album`, `album_artist`, `genre`, `composer`, `track_number`, `disc_number`, `bpm`, `year`, `year_legacy`, `release_date`, `original_release_date`, `comment`, `description`, `lyricist`, `conductor`, `arranger`, `remixer`, `copyright`, `encoded_by`, `sort_title`, `sort_artist`, `sort_album`, `sort_album_artist`

## Tech Stack

| Layer | Tools |
|-------|-------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Rust, Tauri 2, Lofty, Rayon |
| Bundler | Bun |

## Prerequisites

- [Rust](https://rustup.rs/) stable toolchain
- [Bun](https://bun.sh/)
- Platform system dependencies — see the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/)

**Linux only:** for Wayland support, ensure `libwayland-dev` and `libwebkit2gtk-4.1-dev` are installed. The app auto-detects Wayland or X11 at runtime based on your session — no flags needed.

## Getting Started

```bash
bun install
bun run tauri dev
```

## Build

```bash
bun run tauri build
```

Output is in `src-tauri/target/release/bundle/`.

## Platform Builds

Ferrotag uses GitHub Actions to build for all platforms. Pushing a version tag triggers a release:

```bash
git tag v1.0.0
git push --tags
```

| Platform | Output |
|----------|--------|
| Linux | `.deb`, `.rpm`, `.AppImage` |
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |
| Windows | `.msi`, `.exe` |

## Project Structure

```
ferrotag/
├── src/                        # React/TypeScript frontend
│   ├── App.tsx                 # Root component, state, save/rename logic
│   ├── panes/
│   │   ├── FilesPane.tsx       # Virtualised track list
│   │   └── MetadataPane.tsx    # Tag editor and album art
│   └── lib/
│       ├── track-row.ts        # Row model and dirty tracking
│       ├── rename-pattern.ts   # File rename pattern resolver
│       └── rules.ts            # Metadata rules schema and transforms
└── src-tauri/                  # Rust backend
    ├── resources/
    │   └── default-rules.json  # Documented default rules (embedded at build)
    └── src/
        ├── commands/           # Tauri commands (scan, tags, art, rename, config)
        └── metadata/           # Tag reading and TrackMetadata struct
```

## License

MIT — see [LICENSE](LICENSE).
