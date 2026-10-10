# KeyJam

A tiny standalone macOS/desktop experiment that turns ordinary typing into sound.

## Menu bar app

KeyJam lives in the menu bar (keycap-with-a-note icon) and has no Dock icon.

- **Click** the icon to show or hide the small panel in the top-right corner of the screen.
- **Right-click** it to switch between Music / FX / Off or quit.
- In the panel, **Esc** or **✕** hides it. KeyJam keeps listening while hidden.

## Modes

### 1. FX mode
- Enter → bomb
- Space → gunshot
- Backspace → “pupu” explosion
- Other keys → squeezed toy duck

The FX samples in `assets/sounds/` come from [CodeDuck](https://github.com/emmaruyiyang/CodeDuck/tree/main/data/sound). If a sample fails to load, KeyJam falls back to a synthesized Web Audio version of that sound.

### 2. BAD Remix
Typing plays ATEEZ “BAD” from 0:25 to 3:13.9 of the MV, with the quiet break at 2:26.6–2:40.4 cut out (~2:35, `assets/music/bad.mp3`), looping at the end. The song keeps going from where it left off while you type and fades out when you pause longer than **Stop after** (100–2000 ms, default 250 ms). Start typing again and it resumes from the same spot.

## Run (development)

```bash
npm install
npm start
```

Keep KeyJam open and type in another app. `npm start` unsets `ELECTRON_RUN_AS_NODE`, which VS Code's terminal sets and which would otherwise make Electron run as plain Node.

Global key capture (`uiohook-napi`) needs Accessibility access. In development macOS attributes it to the app that launched KeyJam (VS Code, Terminal, iTerm), so enable that one in **System Settings → Privacy & Security → Accessibility**. The packaged build asks for access as KeyJam itself.

## Build a pilot DMG

```bash
npm run dist
```

Outputs `release/KeyJam-mac.dmg` for Apple Silicon Macs only (~97 MB; Intel Macs aren't supported). The app is ad-hoc signed and **not notarized**, which is fine for a small pilot but means macOS will warn on first open.

## Installing the pilot build (for testers)

1. Open the DMG and drag **KeyJam** into **Applications**.
2. Open KeyJam. macOS will say it can't verify the developer. Click **Done**, then go to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to KeyJam.
   - Alternative: run `xattr -dr com.apple.quarantine /Applications/KeyJam.app` in Terminal, then open it normally.
3. KeyJam asks for **Accessibility** access. Click **Open System Settings** in the yellow banner and turn on **KeyJam**. It starts listening automatically; if the banner says *Almost there*, click **Restart KeyJam**.
4. Type in any other app. KeyJam stays in the menu bar; click its icon to open the panel.

**Updating to a new build:** each build has a new ad-hoc signature, so macOS treats it as a different app. Remove the old KeyJam entry from the Accessibility list (select it, click **−**), then grant access again.

KeyJam only reads which key was pressed to choose a sound. It doesn't record what you type and makes no network requests.

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
    │   └── bad.mp3
    └── sounds/
        ├── bomb.mp3
        ├── gun.mp3
        ├── pupu.mp3
        └── duck.mp3
```

## Next experiments

Tune **Stop after**: too short and the music stutters between keystrokes, too long and it keeps playing after you've stopped. 250 ms suits fast typists; slower typists may want 400–600 ms.
