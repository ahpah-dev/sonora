# Sonora

A free and open source digital audio workstation for the browser. Compose, record, arrange, and mix music without installing software or creating an account. Licensed under the [MIT License](LICENSE).

[Visit Sonora](https://sonoradaw.vercel.app/) · [Open the studio](https://sonoradaw.vercel.app/studio/) · [Download for Windows](https://sonoradaw.vercel.app/download/)

## Desktop and AI music assistant

Sonora 5.1 includes a portable Windows 10/11 x64 app. Instruments and the official Codex CLI are bundled. Normal music production works offline; AI generation requires internet access. This release is unsigned; checksums accompany the [GitHub release](https://github.com/ahpah-dev/sonora/releases/tag/v5.1.1).

Open **Create with AI** in the desktop app. Connect Codex using ChatGPT device-code sign-in (or reuse an existing local Codex sign-in), or connect an OpenAI API key. Keys are verified, encrypted using Electron's Windows-backed `safeStorage`, and never stored in browser local storage, projects or source code. Sonora does not log out your shared Codex CLI account.

The model selector contains only `gpt-6-astra`, `gpt-6-luna`, and `gpt-6.1-sol`. Reasoning effort is low/medium/high/xhigh/max, plus none for Luna. Account access and limits still apply. Codex uses your ChatGPT/Codex limits; API requests have separate usage charges. [Official model catalog](https://developers.openai.com/api/docs/models) · [Codex authentication](https://learn.chatgpt.com/docs/auth)

Ask for a melody, beat, arrangement, mix adjustment or instrument change. Scope requests to the selected track, add new tracks, or arrange the session. Review a typed proposal before applying it; each application is one undoable edit. Existing imported audio is preserved. Music generation sends the prompt, MIDI patterns and instrument settings to OpenAI; audio recordings and audio bytes are excluded. Model-generated code is never evaluated. Codex runs ephemerally with user configuration, shell, plugins, apps, web search and MCP disabled; only validated musical proposals reach the session.

The web studio shows the assistant's controls and links to the Windows download. Account connections run in the desktop app, not the public website. Use portable `.sonora` projects to transfer your work between desktop and browser.

### Build the Windows app

```sh
npm ci --prefix desktop
npm run desktop:package
```

The executable is written to `desktop-release/Sonora-5.1.1-win-x64.exe`. `npm run desktop:dev` opens the development app. A matching `v5.1.1` tag runs the pinned GitHub Actions workflow, checks the web build/tests, builds the portable executable and publishes it with a SHA-256 checksum.

`npm test` includes typed proposal validation, privacy, supported model/effort combinations, preserving existing content, edit scope, cancellation and Responses API contract tests. To explicitly test a live signed-in Codex account, run `node scripts/assistant.test.cjs --live`. `/__assistant-ui/` on the localhost dev server then exposes a clearly marked UI fixture using the resulting proposal to check review/apply/undo without another inference call. Neither fixture ships to production.

- **Introduction:** expressive visuals, an interactive listening room, responsive layouts, and a direct launch into the studio.
- **Studio:** arrangement, piano roll, synth and drum design, audio import and recording, effects, automation, mixing, MIDI, and WAV export.
- **Instruments:** 49 factory sounds; layered oscillators, FM, saturation, key tracking, dynamic response, stereo unison and LFO modulation. Seven layered drum voices offer tuning, tone, decay, gain and pan, with closed/open-hat choking.
- **Piano:** recorded Studio Grand and Felt Piano use smoothly blended velocity layers from locally hosted Steinway recordings. Mellow Upright preserves the website's synthesized piano voice. Nine controls shape tone, attack, body, decay, release, dynamics, stereo spread and tuning. Performance supports 25/49/88 keys, polyphony, chord assistance, sustain and MIDI pedal input.
- **Piano roll:** all 128 MIDI pitches, drag drawing, both-edge note trimming, Alt-drag copying, pitch/time zoom, auto-scroll, chord building, scale guides, ghost notes, velocity editing, humanize, legato, keyboard input and undo.
- **Arrangement:** split, trim, duplicate and move clips; choose a loop range from a clip or enter its boundaries. Count-in and metronome follow the audio clock. MIDI records only inside the selected clip after count-in.
- **Projects:** browser autosave, five recovery snapshots, session templates and portable `.sonora` projects including imported audio.
- **Export:** stereo 16/24-bit PCM WAV at 44.1/48/96 kHz, full mix or selected channel, arrangement or loop range, effect tails, optional −1 dBFS peak normalization, and MIDI export.

## Run locally

Uses Node.js 24. No dependencies to install.

```sh
npm run build
npm run dev
```

Open `http://127.0.0.1:4180` for the introduction or `/studio/` for the app.

```sh
npm run check
npm test
```

## Source layout

`site/` contains the introduction. `studio/` contains the self-contained workstation and its Studio, Pro, Piano, Design and Session extensions. Design controls presentation and layout; Session handles recovery, loop transport and export. `scripts/build.cjs` creates `dist/`, which Vercel hosts as a static site.

The generated studio HTML is reproducible from source; edit the source files rather than the generated file. `npm test` checks trimmed-note timing and PCM serialization. The development-only `/__verify/` page offers Editor, Audio and Session regression suites: click Play then Stop once to unlock Web Audio and run each suite. These tests exercise gestures, undo, real offline audio, piano spectral differences, dynamic response, drum choking, count-in, recovery and WAV export. Use a disposable localhost session: the tests modify its project and browser storage. The verification page and its test API are never included in the production build.

## Data and browser support

The studio stores projects in local storage and imported audio in IndexedDB. Device storage can be cleared by the browser; download projects to keep a portable copy. Microphone recording requires permission and HTTPS or localhost. Web MIDI availability depends on the browser and connected hardware.

Desktop Chromium browsers offer the most complete studio experience. The introduction supports desktop and mobile; the dense studio workspace has a minimum width of 760 px. The introduction loads typography from Google Fonts with local fallbacks. Audio starts only through a user action.

## Current scope

Sonora is a browser DAW with built-in instruments and audio tracks. Instrument clips use a repeating four-bar note pattern; drum clips repeat a one-bar step pattern. WAV ranges support up to 20 minutes. It does not host VST/AU plugins, stretch recorded audio to tempo, or provide multichannel audio-interface routing. Microphone capture depends on the browser and has not been validated against professional audio interfaces. A full commercial-DAW replacement requires further engineering and real hardware testing.

## Deploy

Import this repository into Vercel. The included `vercel.json` selects `npm run build` and the `dist` output directory. The introduction is served at `/`, and the workstation at `/studio/`.
