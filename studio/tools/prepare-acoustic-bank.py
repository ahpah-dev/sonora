"""Reproduce Sonora's compact CC0 orchestral sample bank.

Requires numpy, scipy and soundfile. It downloads only the pinned source WAVs,
keeps their SFZ pitch maps, and writes mono 32 kHz Vorbis recordings. This is an
authoring tool, not part of Sonora's runtime or build.
"""
import concurrent.futures
import hashlib
import io
import json
import math
import pathlib
import re
import tempfile
import urllib.parse
import urllib.request

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "site" / "assets" / "acoustic"
SOURCE_COMMIT = "440300901dfe9275fd84e0b7763af1f8443ae62e"
MAPPING_COMMIT = "6dd651d55dde97fd4028699be9d4481f26917891"
CACHE = pathlib.Path(tempfile.gettempdir()) / "sonora-acoustic-source"
SAMPLE_RATE = 32000
CONFIG = {
    "cello": ("CelloEnsSusVib.sfz", "Strings/Cello Section/susvib", True),
    "bass": ("ContrabassPizz.sfz", "Strings/Solo Contrabass/Pizz", False),
    "harp": ("Harp.sfz", "Strings/Harp", False),
    "marimba": ("Marimba.sfz", "Percussion/Marimba", False),
    "flute": ("FluteSusNV.sfz", "Woodwinds/Flute/susNV", True),
}


def fetch(path, commit=SOURCE_COMMIT):
    url = "https://raw.githubusercontent.com/sgossner/VSCO-2-CE/" + commit + "/" + urllib.parse.quote(path, safe="/")
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=45) as response:
                return response.read()
        except Exception as error:
            last = error
    raise last


def regions(text):
    result = []
    for region in re.split(r"<region>", text)[1:]:
        region = re.split(r"<(?:group|global|control)>", region)[0]
        sample = re.search(r"sample=([^\r\n]+)", region)
        root = re.search(r"pitch_keycenter=(\d+)", region)
        if not sample or not root:
            continue
        name = sample.group(1).strip()
        # The source has occasional alternate takes named _2. One source take
        # plus the bass's explicitly marked RR1/RR2 keeps the bank compact.
        if re.search(r"_v\d+_2\.wav$", name):
            continue
        velocity = re.search(r"_v(\d+)_", name)
        layer = "soft" if not velocity or int(velocity.group(1)) == 1 else "hard"
        rr = re.search(r"_rr(\d+)", name, re.I)
        result.append({"sourceFile": name, "root": int(root.group(1)), "layer": layer, "roundRobin": int(rr.group(1)) if rr else 1})
    return list({entry["sourceFile"]: entry for entry in result}.values())


def convert(task):
    bank, entry, directory, sustained = task
    source_path = directory + "/" + entry["sourceFile"]
    cache_path = CACHE / bank / entry["sourceFile"]
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    if cache_path.exists():
        raw = cache_path.read_bytes()
    else:
        raw = fetch(source_path)
        cache_path.write_bytes(raw)
    samples, rate = sf.read(io.BytesIO(raw), dtype="float32", always_2d=True)
    # Keep instrument body and transients; remove only leading near-silence.
    mono = samples.mean(axis=1)
    peak = float(np.max(np.abs(mono)))
    active = np.flatnonzero(np.abs(mono) > max(0.00003, peak * 0.002))
    onset = max(0, int(active[0]) - round(rate * 0.012)) if active.size else 0
    mono = mono[onset:]
    divisor = math.gcd(rate, SAMPLE_RATE)
    mono = resample_poly(mono, SAMPLE_RATE // divisor, rate // divisor).astype("float32")
    limit = 4.2 if sustained else 6.5
    mono = mono[: round(limit * SAMPLE_RATE)]
    # Peak normalization leaves 3.35 dB of asset headroom. Runtime velocity,
    # per-instrument gain and compensated EQ provide the musical dynamics.
    mono *= 0.68 / max(float(np.max(np.abs(mono))), 1e-8)
    fade = min(len(mono) // 4, round(SAMPLE_RATE * 0.018))
    mono[:min(40, len(mono))] *= np.linspace(0, 1, min(40, len(mono)))
    mono[-fade:] *= np.linspace(1, 0, fade)
    metadata = {}
    if sustained and len(mono) >= SAMPLE_RATE * 2.5:
        loop_start = round(SAMPLE_RATE * 1.05)
        loop_end = min(round(SAMPLE_RATE * 3.45), len(mono) - round(SAMPLE_RATE * 0.2))
        crossfade = round(SAMPLE_RATE * 0.18)
        # Blend the final loop segment into the samples immediately before its
        # start, making the BufferSource wrap continuous without an onset repeat.
        blend = np.linspace(0, 1, crossfade)
        mono[loop_end-crossfade:loop_end] = mono[loop_end-crossfade:loop_end] * (1-blend) + mono[loop_start-crossfade:loop_start] * blend
        metadata = {"loopStart": loop_start / SAMPLE_RATE, "loopEnd": loop_end / SAMPLE_RATE}
    filename = f"{bank}-{entry['root']}-{entry['layer']}-{entry['roundRobin']}.ogg"
    target = OUTPUT / filename
    sf.write(target, mono, SAMPLE_RATE, format="OGG", subtype="VORBIS")
    encoded = target.read_bytes()
    decoded, decoded_rate = sf.read(target, dtype="float32")
    return {
        **entry,
        "file": filename,
        "duration": round(len(decoded) / decoded_rate, 5),
        **metadata,
        "bytes": len(encoded),
        "sha256": hashlib.sha256(encoded).hexdigest(),
        "sourcePath": source_path,
        "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "decodedPeak": round(float(np.max(np.abs(decoded))), 5),
    }


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    tasks = []
    maps = {}
    for bank, (mapping, directory, sustained) in CONFIG.items():
        text = fetch(mapping, MAPPING_COMMIT).decode("utf-8-sig")
        selected = regions(text)
        maps[bank] = {"mapping": mapping, "sustained": sustained}
        tasks.extend((bank, entry, directory, sustained) for entry in selected)
    keys = [(bank, entry["root"], entry["layer"], entry["roundRobin"]) for bank, entry, _, _ in tasks]
    if len(set(keys)) != len(keys):
        raise ValueError("Duplicate output pitch/layer/round-robin mapping")
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        converted = list(pool.map(convert, tasks))
    for bank in maps:
        samples = [entry for entry in converted if entry["file"].startswith(bank + "-")]
        maps[bank]["midiRange"] = [min(entry["root"] for entry in samples), max(entry["root"] for entry in samples)]
        maps[bank]["samples"] = sorted(samples, key=lambda entry: (entry["root"], entry["layer"], entry["roundRobin"]))
    manifest = {"format": "sonora-acoustic-bank", "version": 1, "sampleRate": SAMPLE_RATE, "channels": 1, "source": "VSCO 2 Community Edition", "sourceCommit": SOURCE_COMMIT, "mappingCommit": MAPPING_COMMIT, "license": "CC0-1.0", "banks": maps}
    (OUTPUT / "index.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "LICENSE.txt").write_bytes(fetch("LICENSE"))
    (OUTPUT / "UPSTREAM-README.txt").write_bytes(fetch("Readme.txt"))
    print(json.dumps({"files": len(converted), "bytes": sum(entry["bytes"] for entry in converted), "banks": {bank: {"notes": len(value["samples"]), "range": value["midiRange"]} for bank, value in maps.items()}}, indent=2))


if __name__ == "__main__":
    main()
