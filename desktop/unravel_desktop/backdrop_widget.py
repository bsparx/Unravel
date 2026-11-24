"""GPU-cached atmospheric backdrop matching Unravel's Cotton Candy & The Night themes.

Renders each theme ONCE into an offscreen Cairo surface, uploads it to a static
`Gdk.MemoryTexture`, and displays it via `Gtk.Picture` so GTK4's GPU compositor
draws it at 0.0% CPU during scrolling, hovering, clicking, and timer ticks.
"""

from __future__ import annotations

import math

import cairo
import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Gdk", "4.0")
gi.require_version("GLib", "2.0")
from gi.repository import Gdk, GLib, Gtk


def _generate_stars(count: int = 72) -> list[tuple[float, float, float, float, bool]]:
    """Deterministic quasi-random starfield across the upper 68% of the sky."""
    stars: list[tuple[float, float, float, float, bool]] = []
    for i in range(1, count + 1):
        nx = (i * 0.61803398875 + 0.13) % 1.0
        raw_y = ((i * 0.38196601125) * 1.7320508 + 0.07) % 1.0
        ny = raw_y * 0.68
        fade = max(0.0, 1.0 - (ny / 0.72) ** 1.6)
        bright = (i % 13 == 0)
        r = 1.45 if bright else (1.05 if i % 4 == 0 else 0.72)
        alpha = (0.78 if bright else (0.50 if i % 3 == 0 else 0.32)) * fade
        warm = (i % 9 == 0)
        if alpha > 0.06:
            stars.append((nx, ny, r, alpha, warm))
    return stars


_STARS = _generate_stars(72)


def _render_cotton_candy(w: int, h: int) -> cairo.ImageSurface:
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, w, h)
    cr = cairo.Context(surf)
    wf, hf = float(w), float(h)

    base = cairo.LinearGradient(0, 0, wf * 0.85, hf)
    base.add_color_stop_rgb(0.0, 1.0, 0.949, 0.976)
    base.add_color_stop_rgb(0.48, 0.984, 0.957, 1.0)
    base.add_color_stop_rgb(1.0, 0.941, 0.969, 1.0)
    cr.set_source(base)
    cr.rectangle(0, 0, wf, hf)
    cr.fill()

    diag = math.hypot(wf, hf)
    washes = [
        (0.05 * wf, 0.08 * hf, diag * 0.46, (1.0, 0.690, 0.847, 0.66)),
        (0.95 * wf, 0.10 * hf, diag * 0.48, (0.667, 0.847, 1.0, 0.70)),
        (0.84 * wf, 0.88 * hf, diag * 0.48, (1.0, 0.769, 0.894, 0.58)),
        (0.16 * wf, 0.92 * hf, diag * 0.48, (0.729, 0.816, 1.0, 0.54)),
        (0.52 * wf, 0.46 * hf, diag * 0.52, (0.925, 0.863, 1.0, 0.42)),
    ]
    for cx, cy, r, (rr, gg, bb, aa) in washes:
        grad = cairo.RadialGradient(cx, cy, 0, cx, cy, r)
        grad.add_color_stop_rgba(0.0, rr, gg, bb, aa)
        grad.add_color_stop_rgba(0.55, rr, gg, bb, aa * 0.38)
        grad.add_color_stop_rgba(1.0, rr, gg, bb, 0.0)
        cr.set_source(grad)
        cr.rectangle(0, 0, wf, hf)
        cr.fill()
    surf.flush()
    return surf


def _render_night(w: int, h: int) -> cairo.ImageSurface:
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, w, h)
    cr = cairo.Context(surf)
    wf, hf = float(w), float(h)

    sky = cairo.LinearGradient(0, 0, 0, hf)
    sky.add_color_stop_rgb(0.0, 0.012, 0.020, 0.055)
    sky.add_color_stop_rgb(0.46, 0.020, 0.035, 0.094)
    sky.add_color_stop_rgb(1.0, 0.039, 0.063, 0.188)
    cr.set_source(sky)
    cr.rectangle(0, 0, wf, hf)
    cr.fill()

    diag = math.hypot(wf, hf)

    neb1 = cairo.RadialGradient(0.06 * wf, 0.06 * hf, 0, 0.06 * wf, 0.06 * hf, diag * 0.46)
    neb1.add_color_stop_rgba(0.0, 0.118, 0.196, 0.502, 0.48)
    neb1.add_color_stop_rgba(0.55, 0.118, 0.196, 0.502, 0.16)
    neb1.add_color_stop_rgba(1.0, 0.118, 0.196, 0.502, 0.0)
    cr.set_source(neb1)
    cr.rectangle(0, 0, wf, hf)
    cr.fill()

    neb2 = cairo.RadialGradient(0.60 * wf, 0.34 * hf, 0, 0.60 * wf, 0.34 * hf, diag * 0.44)
    neb2.add_color_stop_rgba(0.0, 0.251, 0.157, 0.541, 0.20)
    neb2.add_color_stop_rgba(1.0, 0.251, 0.157, 0.541, 0.0)
    cr.set_source(neb2)
    cr.rectangle(0, 0, wf, hf)
    cr.fill()

    cr.save()
    cr.translate(wf * 0.5, hf * 1.06)
    cr.scale(1.6, 0.55)
    hor = cairo.RadialGradient(0, 0, 0, 0, 0, wf * 0.58)
    hor.add_color_stop_rgba(0.0, 0.180, 0.227, 0.588, 0.40)
    hor.add_color_stop_rgba(0.55, 0.180, 0.227, 0.588, 0.14)
    hor.add_color_stop_rgba(1.0, 0.180, 0.227, 0.588, 0.0)
    cr.set_source(hor)
    cr.arc(0, 0, wf * 0.58, 0, 2 * math.pi)
    cr.fill()
    cr.restore()

    mx, my = wf * 0.88, hf * 0.09
    halo = cairo.RadialGradient(mx, my, 0, mx, my, diag * 0.28)
    halo.add_color_stop_rgba(0.0, 0.92, 0.94, 1.0, 0.24)
    halo.add_color_stop_rgba(0.08, 0.82, 0.86, 1.0, 0.13)
    halo.add_color_stop_rgba(0.32, 0.58, 0.66, 1.0, 0.05)
    halo.add_color_stop_rgba(1.0, 0.55, 0.62, 1.0, 0.0)
    cr.set_source(halo)
    cr.rectangle(0, 0, wf, hf)
    cr.fill()

    for nx, ny, rad, alpha, warm in _STARS:
        sx = nx * wf
        sy = ny * hf
        if math.hypot(sx - mx, sy - my) < 26:
            continue
        if warm:
            cr.set_source_rgba(1.0, 0.955, 0.865, alpha)
        else:
            cr.set_source_rgba(0.91, 0.935, 1.0, alpha)
        cr.arc(sx, sy, rad, 0, 2 * math.pi)
        cr.fill()
        if rad >= 1.4:
            cr.set_source_rgba(0.88, 0.92, 1.0, alpha * 0.22)
            cr.arc(sx, sy, rad * 2.7, 0, 2 * math.pi)
            cr.fill()

    surf.flush()
    return surf


def _surface_to_texture(surf: cairo.ImageSurface) -> Gdk.MemoryTexture:
    raw = bytes(surf.get_data())
    return Gdk.MemoryTexture.new(
        surf.get_width(),
        surf.get_height(),
        Gdk.MemoryFormat.B8G8R8A8_PREMULTIPLIED,
        GLib.Bytes.new(raw),
        surf.get_stride(),
    )


class AtmosphereBackdrop(Gtk.Picture):
    """Static GPU-textured backdrop with zero per-frame Python/Cairo repaint overhead."""

    _textures: dict[bool, Gdk.MemoryTexture] = {}

    def __init__(self, dark: bool = False) -> None:
        super().__init__()
        self._dark: bool | None = None
        self.set_hexpand(True)
        self.set_vexpand(True)
        self.set_can_shrink(True)
        self.set_content_fit(Gtk.ContentFit.FILL)
        self.set_can_target(False)
        self.set_can_focus(False)
        self.set_dark(dark)

    @classmethod
    def _get_texture(cls, dark: bool) -> Gdk.MemoryTexture:
        tex = cls._textures.get(dark)
        if tex is None:
            # Smooth pastel gradients upscale invisibly from 480x360 (~3ms once);
            # Night starfield renders at 980x710 (~20ms once) for razor-sharp stars.
            surf = _render_night(1120, 900) if dark else _render_cotton_candy(480, 360)
            tex = _surface_to_texture(surf)
            cls._textures[dark] = tex
        return tex

    def set_dark(self, dark: bool) -> None:
        if self._dark == dark:
            return
        self._dark = dark
        self.set_paintable(self._get_texture(dark))
