# KeyJam

A tiny standalone macOS/desktop experiment that turns ordinary typing into sound.

## Modes

### 1. FX mode
- Enter → bomb
- Space → gunshot
- Backspace → “pupu” explosion
- Other keys → squeezed toy duck

The FX samples in `assets/sounds/` come from [CodeDuck](https://github.com/emmaruyiyang/CodeDuck/tree/main/data/sound). If a sample fails to load, KeyJam falls back to a synthesized Web Audio version of that sound.

### 2. She So Bad Remix
Uses a short local sample from the supplied BAD video and slices it **in memory** every time you type. No hundreds of tiny files are created.

Three behaviors:
- **Key mapped** — same physical key = same music chunk
- **Sequence** — keystrokes move through the phrase in order; your typing controls rhythm
- **Shuffle** — every keystroke jumps to another chunk

Chunk size is adjustable from **120–600 ms**. Start around **280 ms**, then compare ~180 ms (glitchier) and ~450 ms (more recognizable).

## Run

```bash
npm install
npm start
```

Keep KeyJam open and type in another app.

## macOS permission

Global keyboard capture uses `uiohook-napi`. macOS may ask for Accessibility permission for Electron or the Terminal app that launched KeyJam:

**System Settings → Privacy & Security → Accessibility**

Enable the relevant app, then restart KeyJam.

## Structure

```text
KeyJam/
├── main.js
├── preload.js
├── package.json
├── renderer/
│   ├── index.html
│   └── app.js
└── assets/
    ├── music/
    │   └── she-so-bad.mp3
    └── sounds/
        ├── bomb.mp3
        ├── gun.mp3
        ├── pupu.mp3
        └── duck.mp3
```

## Next experiments

The first useful question is not “can it play audio?” but **which slicing behavior feels musically coherent while still letting typing reshape the song?** The fastest comparison is 180 / 280 / 450 ms across mapped vs sequence modes.
