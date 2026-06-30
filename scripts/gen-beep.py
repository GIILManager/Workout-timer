#!/usr/bin/env python3
"""Generate a short double-beep alert tone (stdlib only) -> assets/sounds/beep.wav.

Two ~120ms 880Hz tones with a short gap, 16-bit PCM mono @ 22050Hz.
Small (~12KB), permissively self-generated, committed to the repo so it's
available in the GitHub Actions build.
"""
import math
import struct
import wave
from pathlib import Path

RATE = 22050
FREQ = 880.0
TONE = 0.12   # seconds per beep
GAP = 0.08    # silence between beeps
AMP = 0.6     # 0..1


def samples():
    def tone(dur):
        n = int(RATE * dur)
        for i in range(n):
            # short linear fade in/out to avoid clicks
            env = min(1.0, i / (RATE * 0.01), (n - i) / (RATE * 0.01))
            yield int(AMP * env * 32767 * math.sin(2 * math.pi * FREQ * (i / RATE)))

    def silence(dur):
        for _ in range(int(RATE * dur)):
            yield 0

    for s in tone(TONE):
        yield s
    for s in silence(GAP):
        yield s
    for s in tone(TONE):
        yield s


def main():
    out = Path(__file__).resolve().parent.parent / "assets" / "sounds" / "beep.wav"
    out.parent.mkdir(parents=True, exist_ok=True)
    data = b"".join(struct.pack("<h", s) for s in samples())
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data)
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
