# Ferrotag

A fast, minimal desktop music tag editor built with Tauri, React, and Rust.

![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- Edit tags for MP3, FLAC, OGG, M4A, WAV, AIFF, APE, Opus, and WavPack files
- Open individual files or entire folders via the file picker, or drag and drop either onto the window
- Batch edit — select multiple tracks and update shared fields at once
- Album art — embed, replace, extract, or remove cover art; drag an image onto the art well to set it
- File renamer — optionally rename files on save using tag-based patterns like `{artist} – {track_number} – {title}`; your pattern persists between sessions
- Metadata rules — apply batch transforms (zero-pad numbers, blank fields, reduce dates to the year, trim whitespace) to every loaded file via an optional JSON config
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

Type a pattern in the **Rename:** toolbar field to rename files on save. Leave it empty to skip renaming.

Available tokens:

| Token | Value |
|-------|-------|
| `{title}` | Track title |
| `{artist}` | First artist |
| `{album}` | Album name |
| `{album_artist}` | First album artist |
| `{track_number}` | Track number, zero-padded to 2 digits |
| `{disc_number}` | Disc number, zero-padded to 2 digits |
| `{year}` | Year |
| `{genre}` | Genre |
| `{composer}` | Composer |
| `{bpm}` | BPM |

Tokens that hold a number accept an optional pad width using `{token:N}`:

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

Each rule has a `field` and an `op`:

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

Rules run top to bottom. Any extra keys (such as `_README`) are ignored, and individual invalid rules are skipped with a warning rather than failing the whole file.

Available ops:

| Op | Extra key | Effect |
|----|-----------|--------|
| `blank` | — | Clears the field |
| `set` | `value` | Sets the field to a fixed string (omit `value` to clear) |
| `pad` | `width` | Zero-pads a number to `width` digits (`3` → `03`, `3/12` → `03/12`); non-numeric values are left as-is |
| `yearOnly` | — | Reduces a date to its first 4-digit year (`2021-05-13` → `2021`) |
| `trim` | — | Removes leading/trailing whitespace |

Available fields:

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
