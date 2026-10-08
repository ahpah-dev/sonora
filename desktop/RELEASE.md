Sonora 5.2.1 fixes clip trim previews.

- Notes and waveforms redraw during edge trimming instead of squeezing before release.
- Left-edge previews reflect the pending trim while keeping the source pattern intact until commit.
- Both trim directions retain one-step Undo.

Sonora 5.2.0 improves composition, instrument sound and everyday workflow.

- Find actions, tracks and sounds with Ctrl/Cmd + K. Add an instrument, drum or audio track through a clear picker, with no prefilled clips. Context controls follow your selection.
- Play ten new acoustic patches across recorded cello, flute, harp, marimba and upright bass banks. Adjust tone, dynamics, attack, release and tuning. All recordings and CC0 notices are bundled for offline use.
- Guide AI with an optional creative brief: style, key, length, energy and development. Your written request takes precedence. Quick draft uses one Low-effort pass.
- Rewrite a selected clip while preserving the other clips and track settings. Native validation checks the edit scope; Apply supports one-step Undo.
- Review harmonic overlaps, bass/kick timing and recognizable motifs. The bounded refinement pass preserves passage boundaries and can explicitly protect motifs.
- Render a stable session snapshot while continuing to edit. Preview the actual WAV, check peak/RMS, and download it when ready. Optional peak protection reduces excessive levels without compression; normalization can boost quieter mixes.
- Verify the packaged renderer with real offline PCM, instrument loading, workflow, export and AI Apply/Undo regression tests.

Sonora 5.1.9 improves AI composition and musical development.

- Plan shared harmony, complementary instrument roles, recognizable melodic motifs, answering phrases, contrast and endings.
- Account for actual preset octave transposition, four-bar MIDI repeats and one-bar drum repeats. Variations and fills use separate clips.
- Review the whole arrangement for patterns, dynamics, sounding registers, section activity, duplicate notes and articulation.
- Refine composition makes one extra pass using the same selected model and effort, with MIDI observations and enabled local audio feedback. Disable it for a faster single request.
- Keep the first valid draft if refinement fails or introduces more duplicate notes, mix clipping or empty musical changes. Cancellation covers both passes.
- Review the final editable proposal and audio preview before applying it. The complete change supports one-step Undo.

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
