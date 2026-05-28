# Ferrotag

A desktop music metadata editor built with Tauri, React, and Rust.

![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- Drag and drop audio files or folders to load tracks
- View and edit track metadata: title, artist, album, year, track number, disc number, genre, and comments
- Album art display
- Supports MP3, FLAC, OGG, M4A, WAV, and AIFF
- Resizable split-panel interface
- Recursive directory scanning

## Tech Stack

| Layer    | Tools                                    |
| -------- | ---------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend  | Rust, Tauri 2, Lofty                     |
| Bundler  | Bun                                      |

## Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- [Bun](https://bun.sh/)
- Tauri system dependencies for your platform — see the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/)

## Getting Started

```bash
# Install frontend dependencies
bun install

# Start the development app (Rust + Vite)
bun run tauri dev
```

## Build

```bash
# Bundle a production desktop application
bun run tauri build
```

The output installer/binary will be in `src-tauri/target/release/bundle/`.

## Project Structure

```
ferrotag/
├── src/                  # React/TypeScript frontend
│   ├── App.tsx           # Root component, drag-drop and save logic
│   ├── panes/
│   │   ├── MetadataPane.tsx   # Tag editor and album art
│   │   └── FilesPane.tsx      # Track list
│   ├── types/track.ts    # Shared Track type
│   └── lib/tauri.ts      # Tauri command wrappers
└── src-tauri/            # Rust backend
    └── src/
        ├── commands/     # Tauri commands (scan, save, art)
        └── metadata/     # Tag reading and TrackMetadata struct
```

## License

MIT — see [LICENSE](LICENSE).
