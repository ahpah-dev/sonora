Sonora 5.1.8 fixes applying AI proposals.

- Zoom, track selection and piano pitch scrolling no longer invalidate a generated proposal.
- Apply closes the assistant and reveals the affected clip, even on later bars or tracks below the viewport.
- Apply failures display a clear message beside the button.
- Real musical changes still require a fresh proposal to protect your edits.
- Applied notes persist locally and the entire proposal can be undone in one step.

Sonora 5.1.7 improves timeline editing.

- Zoom the arrangement from 12.5% to 400% with the zoom buttons or Ctrl / Cmd + wheel. Clips and the timeline physically shrink when zooming out.
- Drag an empty timeline area with the Select tool to box-select clips across tracks. Shift adds to the selection or toggles a clip.
- Move selected clips together, duplicate the group or delete the selection. Each edit supports Undo.
- Selection remains accurate after zooming and scrolling. Escape cancels an unfinished selection or group move.

Sonora 5.1.6 adds local music analysis for GPT-6 Astra, GPT-6 Luna and GPT-6.1 Sol.

- Render up to 28 seconds of the audible session locally before generating.
- Give the model bar-by-bar pitch content, repeated MIDI timing, swing and measured mix information.
- Render and analyze the proposed mix before applying it; audition its preview.
- Request a revision with Improve using this analysis.
- Detect clipping, silence and strong stereo phase cancellation.
- Raw audio stays on the device. This is local signal analysis, not direct model hearing.

Sonora 5.1 adds a portable Windows music studio and a Codex/OpenAI music assistant.

- Download the Windows x64 executable and open it. Instruments and Codex are bundled; no Node.js installation is required.
- Open **Create with AI**. Use an existing local Codex sign-in or connect with ChatGPT through device-code sign-in. Alternatively, connect an OpenAI API key stored using Windows credential encryption.
- Select GPT-6 Astra, GPT-6 Luna, or GPT-6.1 Sol and a supported reasoning effort. Model access and usage limits depend on your OpenAI account.
- Ask for melodies, drum patterns, arrangements or instrument changes. Review the proposal, apply it to the session and use Undo to restore the previous version.
- Normal music production and bundled instruments work offline. AI generation requires internet access. Imported audio recordings are not sent to OpenAI.
- Use Download project / Open project to move sessions between desktop and browser.

This release is unsigned. Windows may show a publisher confirmation. Compare the downloaded file's SHA-256 hash with SHA256SUMS.txt.

Source: https://github.com/ahpah-dev/sonora · Website: https://sonoradaw.vercel.app/
