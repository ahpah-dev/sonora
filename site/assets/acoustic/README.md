# Sonora acoustic instrument bank

118 local recordings selected from **VS Chamber Orchestra: Community Edition**
by Versilian Studios / Sam Gossner, with Simon Dalzell / Ivy Audio and sample
editing by Elan Hickler / Soundemote. The upstream project dedicates these
recordings to the public domain under **CC0 1.0 Universal**.

- Primary source: https://github.com/sgossner/VSCO-2-CE
- Primary license: https://github.com/sgossner/VSCO-2-CE/blob/master/LICENSE
- Project: http://vis.versilstudios.net/vsco-community.html
- Pinned recordings: `440300901dfe9275fd84e0b7763af1f8443ae62e`
- Pinned SFZ pitch maps: `6dd651d55dde97fd4028699be9d4481f26917891`

`LICENSE.txt` and `UPSTREAM-README.txt` retain the source notices. `index.json`
records each original path, original WAV SHA-256, output OGG SHA-256, pitch,
velocity layer, round robin and loop points. The original
SFZ root pitches are retained, including the instruments' differing octave
conventions.

Sonora's adaptation uses mono 32 kHz Vorbis to keep the complete bank below
4 MB. Near-silence at the onset is removed while retaining natural attacks;
recordings are resampled, peak-normalized to 0.68, and gently faded at their
ends. Cello and flute receive a 180 ms loop crossfade. Bass, harp and marimba
retain their natural decay and do not loop. Velocity, tone and note-off
envelopes are applied by the shared live/offline instrument engine.

The selected recordings cover cello ensemble, pizzicato double bass, concert
harp, marimba and non-vibrato flute. This is a compact playable bank; it does
not contain a complete orchestral articulation collection. The application
bundles every recording, so no third-party request or API key is required
during playback. Browser playback needs its files downloaded once; packaged
desktop playback uses local files.

Reproduction tool: `studio/tools/prepare-acoustic-bank.py` (numpy, scipy,
soundfile; not required to run or build Sonora).
