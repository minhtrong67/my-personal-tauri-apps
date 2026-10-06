<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="112" alt="Material Video Editor icon">

# Material Video Editor

**A simple, CapCut-inspired video editor with a Material Design 3 look.**
*Trình chỉnh sửa video đơn giản, lấy cảm hứng từ CapCut, thiết kế theo Material Design 3.*

Tauri 2 · Vanilla JS · Canvas + WebAudio · EN / VI

</div>

---

## Features / Tính năng

- **Multi-track timeline** – text, overlay, main (ripple) and audio tracks; drag to move, trim, reorder, snap, zoom, scrub.
- **Media library** – import video, audio and images (button or drag & drop); thumbnails and waveforms.
- **Editing** – split, duplicate, delete, speed, volume, fade, undo/redo.
- **Transitions** – fade, slide, slide-up, wipe, zoom, dip-to-black; apply to one cut or all.
- **Filters** – presets plus brightness, contrast, saturation, hue, grayscale, sepia, blur, vignette.
- **Text** – presets, font, colour, outline, shadow, background box, entrance animations; drag and scale directly on the preview.
- **Aspect ratios** – 16:9, 9:16, 1:1, 4:3, 21:9.
- **Export** – 480p to 1440p, 24/30/60 fps, 3 quality levels; MP4 or WebM (optional FFmpeg for MP4).
- **Projects** – saved as `.mvep` (JSON), with autosaved draft recovery.
- **Material Design 3** – dynamic colour from any seed, light / dark / system theme, motion that respects *reduced motion*.
- **English & Tiếng Việt** UI.

## Shortcuts / Phím tắt

| Key | Action |
|---|---|
| Space | Play / Pause |
| S | Split at playhead |
| Delete | Delete selection |
| Ctrl+D | Duplicate |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+O / Ctrl+S | Open / Save project |
| Ctrl+E | Export |
| ← / → | Step one frame (Shift: 1 s) |
| Home / End | Jump to start / end |
| Ctrl+I | Import media |

## Getting started / Bắt đầu

Requirements: Node.js 18+, Rust (stable), and the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run dev      # run in development
npm run build    # produce installers (NSIS on Windows)
npm run icons    # regenerate icons (needs Python + Pillow)
```

The project is a member of a Cargo workspace (`members = ["*/src-tauri"]`) and shares the workspace `target/` directory.

## How it works

Clips are decoded by the webview, composited on a `<canvas>` (transforms, filters, transitions, text) and mixed through the WebAudio API. Export records the canvas and audio mix in real time with `MediaRecorder`, then streams the result to disk in chunks through a Rust command.

## Limitations / Lưu ý

- **Export is real time** – a 1-minute video takes about 1 minute; keep the window visible during export.
- **Codec support depends on the system webview.** WebView2 (Windows) records H.264 MP4. If only WebM is available, install [FFmpeg](https://ffmpeg.org/) and add it to `PATH` to enable "MP4 via FFmpeg".
- Canvas filters (`ctx.filter`) are not supported by WebKit-based webviews (macOS/Linux); filters are ignored there.
- Projects reference media by path-less metadata: on reopening, media appears **offline** until you re-import the same files (matched by name and size).

## Project structure

```
src/            UI (ES modules): store, engine, timeline, inspector, exporter, i18n…
src-tauri/      Rust backend, config, icons
tools/          Icon generator
```

## Credits

Created by **minhtrong67** with AI assistance from **Claude** (Anthropic).

## License

[MIT](LICENSE)
