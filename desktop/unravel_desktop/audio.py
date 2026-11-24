"""Gentle synthesized chimes played asynchronously via PipeWire (`pw-play`)."""

from __future__ import annotations

import math
import shutil
import struct
import subprocess
import wave
from pathlib import Path

from .config import CACHE_DIR

SAMPLE_RATE = 44100


def _render_chime(path: Path, notes: list[tuple[float, float, float, float]]) -> None:
    """Render soft exponential-decay sine bells to a 16-bit mono WAV file.

    Each note is (start_sec, duration_sec, freq_hz, amplitude).
    """
    total_sec = max(s + d for s, d, _, _ in notes) + 0.05
    n_samples = int(total_sec * SAMPLE_RATE)
    buf = [0.0] * n_samples

    for start, dur, freq, amp in notes:
        i0 = int(start * SAMPLE_RATE)
        n = int(dur * SAMPLE_RATE)
        attack = max(1, int(0.015 * SAMPLE_RATE))
        for k in range(n):
            idx = i0 + k
            if idx >= n_samples:
                break
            t = k / SAMPLE_RATE
            env = min(1.0, k / attack) * math.exp(-4.2 * (t / dur))
            # Fundamental + quiet 2nd harmonic for warm singing-bowl tone.
            sample = math.sin(2.0 * math.pi * freq * t) + 0.22 * math.sin(4.0 * math.pi * freq * t)
            buf[idx] += amp * env * sample

    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for val in buf:
            clamped = max(-0.95, min(0.95, val))
            frames.extend(struct.pack("<h", int(clamped * 32767)))
        wf.writeframes(bytes(frames))


class SoundPlayer:
    """Lazy-cached gentle chime player using PipeWire (`pw-play`) or `canberra-gtk-play`."""

    CHIMES: dict[str, list[tuple[float, float, float, float]]] = {
        # Soft ascending triad (C5 -> E5 -> G5) when focus completes
        "focus_done": [
            (0.00, 0.70, 523.25, 0.30),
            (0.14, 0.75, 659.25, 0.28),
            (0.28, 0.95, 783.99, 0.30),
        ],
        # Single calm singing-bowl pulse (E5 + B5 shimmer) when Pomodoro Flow baseline is met
        "flow_baseline": [
            (0.00, 1.05, 659.25, 0.26),
            (0.06, 0.90, 987.77, 0.14),
        ],
        # Warm two-note nudge (G5 -> D5) when a break ends or runs over
        "break_overrun": [
            (0.00, 0.55, 783.99, 0.28),
            (0.22, 0.80, 587.33, 0.28),
        ],
    }

    def __init__(self, cache_dir: Path = CACHE_DIR) -> None:
        self._cache_dir = cache_dir
        self._pw_play = shutil.which("pw-play")
        self._aplay = shutil.which("aplay")
        self._canberra = shutil.which("canberra-gtk-play")

    def _ensure_wav(self, name: str) -> Path | None:
        notes = self.CHIMES.get(name)
        if not notes:
            return None
        wav_path = self._cache_dir / f"chime-{name}.wav"
        if not wav_path.exists():
            try:
                _render_chime(wav_path, notes)
            except OSError:
                return None
        return wav_path

    def play(self, name: str, enabled: bool = True) -> None:
        if not enabled:
            return
        wav = self._ensure_wav(name)
        cmd: list[str] | None = None
        if wav and self._pw_play:
            cmd = [self._pw_play, str(wav)]
        elif wav and self._aplay:
            cmd = [self._aplay, "-q", str(wav)]
        elif self._canberra:
            cmd = [self._canberra, "-i", "complete"]
        if not cmd:
            return
        try:
            subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
        except OSError:
            pass
