# Sonora

A creative music studio in the browser, with a dedicated introduction site.

[Visit Sonora](https://sonora-pi-one.vercel.app/) · [Open the studio](https://sonora-pi-one.vercel.app/studio/)

- **Introduction:** expressive visuals, an interactive listening room, responsive layouts, and a direct launch into the studio.
- **Studio:** arrangement, piano roll, synth and drum design, audio import and recording, effects, automation, mixing, MIDI, and WAV export.
- **Instruments:** layered oscillators, FM harmonics, sub and noise, filter envelopes, stereo unison, LFO modulation, and per-drum tuning.
- **Piano:** synthesized Studio Grand, Felt Piano and Mellow Upright; brightness, hammer, string character, decay and release controls; 25/49/88-key performance layouts, polyphony, chord assistance, sustain and MIDI pedal input.
- **Piano roll:** chord building and inversions, arpeggiation, precise note controls, scrollable rows, zoom, scale locking, ghost notes, velocity editing, humanize, legato, keyboard input, and undo.
- **Projects:** browser autosave and portable `.sonora` project downloads, including imported audio.

## Run locally

Uses Node.js 24. No dependencies to install.

```sh
npm run build
npm run dev
```

Open `http://127.0.0.1:4180` for the introduction or `/studio/` for the app.

```sh
npm run check
```

## Source layout

`site/` contains the introduction. `studio/` contains the original self-contained workstation and the Studio / Pro extensions. `scripts/build.cjs` creates `dist/`, which Vercel hosts as a static site.

The generated studio HTML is reproducible from source; edit the source files rather than the generated file. `studio/sonora-studio.test.js` checks the audio, history, import, recording, project round-trip, and export flows. `studio/sonora-pro.test.js` checks instrument design, patch storage and note editing. `studio/sonora-piano.test.js` checks piano customization, polyphony, sustain, chord recording, chord tools and piano WAV export. Run these expressions in a disposable browser session after a real click on Play / Stop unlocks Web Audio. The tests alter that session's project and storage.

## Data and browser support

The studio stores projects in local storage and imported audio in IndexedDB. Device storage can be cleared by the browser; download projects to keep a portable copy. Microphone recording requires permission and HTTPS or localhost. Web MIDI availability depends on the browser and connected hardware.

Desktop Chromium browsers offer the most complete studio experience. The introduction supports desktop and mobile; the dense studio workspace has a minimum width of 760 px. The introduction loads typography from Google Fonts with local fallbacks. Audio starts only through a user action.

## Deploy

Import this repository into Vercel. The included `vercel.json` selects `npm run build` and the `dist` output directory. The introduction is served at `/`, and the workstation at `/studio/`.
