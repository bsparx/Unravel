"""Lightweight cached Cairo Timer Ring & Today Progress Donut in Unravel's true palette.

Pre-renders the static dial base (ambient aura, 60 watchmaker compass ticks,
frosted sapphire inner dial, specular rim, and recessed track) into an offscreen
`cairo.ImageSurface` so live 1-second ticks only paint the active arc and text (<0.2ms).
"""

from __future__ import annotations

import math

import cairo
import gi

gi.require_version("Gtk", "4.0")
from gi.repository import Gtk


PALETTES = {
    "light": {
        "track": (0.957, 0.886, 0.937, 0.92),
        "well_top": (1.0, 0.992, 0.998, 0.92),
        "well_bot": (0.985, 0.968, 0.995, 0.86),
        "well_rim": (0.588, 0.345, 0.627, 0.14),
        "well_glint": (1.0, 1.0, 1.0, 0.95),
        "focus": (0.263, 0.400, 0.769, 1.0),
        "focus_hi": (0.412, 0.533, 0.890, 1.0),
        "flow": (0.094, 0.459, 0.396, 1.0),
        "flow_hi": (0.145, 0.635, 0.545, 1.0),
        "rest": (0.400, 0.455, 0.561, 1.0),
        "rest_hi": (0.525, 0.584, 0.698, 1.0),
        "overrun": (0.722, 0.204, 0.302, 1.0),
        "overrun_hi": (0.878, 0.329, 0.431, 1.0),
        "ink": (0.200, 0.157, 0.290, 1.0),
        "muted": (0.365, 0.314, 0.455, 1.0),
        "tick": (0.588, 0.345, 0.627, 0.22),
        "compass": (0.588, 0.345, 0.627, 0.15),
    },
    "dark": {
        "track": (0.106, 0.137, 0.251, 0.92),
        "well_top": (0.063, 0.114, 0.255, 0.86),
        "well_bot": (0.035, 0.067, 0.165, 0.90),
        "well_rim": (0.667, 0.729, 1.0, 0.18),
        "well_glint": (0.870, 0.902, 1.0, 0.26),
        "focus": (0.541, 0.635, 0.941, 1.0),
        "focus_hi": (0.694, 0.769, 1.0, 1.0),
        "flow": (0.259, 0.851, 0.722, 1.0),
        "flow_hi": (0.478, 0.949, 0.847, 1.0),
        "rest": (0.576, 0.627, 0.741, 1.0),
        "rest_hi": (0.725, 0.769, 0.867, 1.0),
        "overrun": (1.0, 0.486, 0.569, 1.0),
        "overrun_hi": (1.0, 0.651, 0.710, 1.0),
        "ink": (0.933, 0.945, 1.0, 1.0),
        "muted": (0.698, 0.753, 0.863, 1.0),
        "tick": (0.667, 0.729, 1.0, 0.32),
        "compass": (0.667, 0.729, 1.0, 0.16),
    },
}


class TimerRingWidget(Gtk.DrawingArea):
    """Cached watchmaker Time-Timer dial — ultra-low CPU on every live tick."""

    def __init__(self, size: int = 242, compact: bool = False) -> None:
        super().__init__()
        self._compact = compact
        self.set_content_width(size)
        self.set_content_height(size)
        self.set_halign(Gtk.Align.CENTER)
        self.set_valign(Gtk.Align.CENTER)

        self._progress = 1.0
        self._tone = "focus"
        self._readout = "25:00"
        self._eyebrow = ""
        self._subline = ""
        self._dark = False
        self._pulse = False
        self._tick_fractions: tuple[float, ...] = ()
        self._last_state: tuple | None = None

        self._base_key: tuple | None = None
        self._base_surf: cairo.ImageSurface | None = None

        self.set_draw_func(self._draw)

    def set_state(
        self,
        *,
        progress: float,
        tone: str,
        readout: str,
        eyebrow: str = "",
        subline: str = "",
        dark: bool = False,
        pulse: bool = False,
        tick_fractions: list[float] | None = None,
    ) -> None:
        clamped = max(0.0, min(1.0, progress))
        q_prog = round(clamped, 3)
        norm_tone = tone if tone in ("focus", "flow", "rest", "overrun") else "focus"
        ticks = tuple(round(t, 3) for t in (tick_fractions or ()))
        state = (q_prog, norm_tone, readout, eyebrow, subline, dark, pulse, ticks)
        if state == self._last_state:
            return
        self._last_state = state
        self._progress = clamped
        self._tone = norm_tone
        self._readout = readout
        self._eyebrow = eyebrow
        self._subline = subline
        self._dark = dark
        self._pulse = pulse
        self._tick_fractions = ticks
        self.queue_draw()

    def _get_base_surface(
        self,
        width: int,
        height: int,
        pal: dict,
        accent: tuple[float, float, float, float],
        stroke: float,
        radius: float,
    ) -> cairo.ImageSurface:
        key = (width, height, self._tone, self._dark, self._pulse, self._compact)
        if self._base_key == key and self._base_surf is not None:
            return self._base_surf

        surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, width, height)
        cr = cairo.Context(surf)
        cx = width / 2.0
        cy = height / 2.0
        size = min(width, height)

        if not self._compact:
            aura_alpha = (0.24 if self._dark else 0.18) if self._pulse else (0.14 if self._dark else 0.10)
            aura = cairo.RadialGradient(cx, cy, radius * 0.45, cx, cy, size * 0.50)
            aura.add_color_stop_rgba(0.0, accent[0], accent[1], accent[2], aura_alpha)
            aura.add_color_stop_rgba(0.66, accent[0], accent[1], accent[2], aura_alpha * 0.35)
            aura.add_color_stop_rgba(1.0, accent[0], accent[1], accent[2], 0.0)
            cr.set_source(aura)
            cr.arc(cx, cy, size * 0.50, 0, 2 * math.pi)
            cr.fill()

            compass_r_in = radius + stroke * 0.72
            for i in range(60):
                ang = -math.pi / 2.0 + (2.0 * math.pi * i) / 60.0
                major = (i % 5 == 0)
                length = 4.8 if major else 2.4
                cr.set_line_width(1.3 if major else 0.85)
                cr.set_source_rgba(
                    pal["compass"][0],
                    pal["compass"][1],
                    pal["compass"][2],
                    pal["compass"][3] * (1.75 if major else 0.85),
                )
                cr.move_to(cx + compass_r_in * math.cos(ang), cy + compass_r_in * math.sin(ang))
                cr.line_to(
                    cx + (compass_r_in + length) * math.cos(ang),
                    cy + (compass_r_in + length) * math.sin(ang),
                )
                cr.stroke()

        well_r = radius - stroke * 0.68
        well_grad = cairo.LinearGradient(cx, cy - well_r, cx, cy + well_r)
        well_grad.add_color_stop_rgba(0.0, *pal["well_top"])
        well_grad.add_color_stop_rgba(1.0, *pal["well_bot"])
        cr.arc(cx, cy, well_r, 0, 2 * math.pi)
        cr.set_source(well_grad)
        cr.fill()

        if not self._compact:
            cr.set_line_width(1.0)
            cr.arc(cx, cy, well_r, 0, 2 * math.pi)
            cr.set_source_rgba(*pal["well_rim"])
            cr.stroke()
            cr.set_line_width(1.2)
            cr.arc(cx, cy, well_r - 0.8, -math.pi * 0.82, -math.pi * 0.18)
            cr.set_source_rgba(*pal["well_glint"])
            cr.stroke()

        cr.set_line_width(stroke)
        cr.arc(cx, cy, radius, 0, 2 * math.pi)
        cr.set_source_rgba(*pal["track"])
        cr.stroke()

        if self._pulse and not self._compact:
            cr.set_line_width(stroke * 1.95)
            cr.arc(cx, cy, radius, 0, 2 * math.pi)
            cr.set_source_rgba(accent[0], accent[1], accent[2], 0.15)
            cr.stroke()

        surf.flush()
        self._base_key = key
        self._base_surf = surf
        return surf

    def _draw(self, _area: Gtk.DrawingArea, cr: cairo.Context, width: int, height: int) -> None:
        if width <= 0 or height <= 0:
            return
        pal = PALETTES["dark" if self._dark else "light"]
        accent = pal[self._tone]
        accent_hi = pal[f"{self._tone}_hi"]
        cx = width / 2.0
        cy = height / 2.0
        size = min(width, height)
        stroke = max(4.5, size * (0.098 if self._compact else 0.045))
        margin = 3.0 if self._compact else 16.0
        radius = (size / 2.0) - stroke - margin

        # 1. Blit pre-rendered static dial base in one operation
        base = self._get_base_surface(width, height, pal, accent, stroke, radius)
        cr.set_source_surface(base, 0, 0)
        cr.paint()

        # 2. Active gradient arc (12 o'clock clockwise)
        start_angle = -math.pi / 2.0
        if self._progress > 0.002:
            end_angle = start_angle + 2.0 * math.pi * self._progress
            arc_grad = cairo.LinearGradient(cx - radius, cy - radius, cx + radius, cy + radius)
            arc_grad.add_color_stop_rgba(0.0, *accent_hi)
            arc_grad.add_color_stop_rgba(1.0, *accent)
            cr.set_line_width(stroke)
            cr.set_line_cap(cairo.LINE_CAP_ROUND)
            cr.arc(cx, cy, radius, start_angle, end_angle)
            cr.set_source(arc_grad)
            cr.stroke()

            if not self._compact and 0.02 < self._progress < 0.995:
                tx = cx + radius * math.cos(end_angle)
                ty = cy + radius * math.sin(end_angle)
                cr.arc(tx, ty, stroke * 0.90, 0, 2 * math.pi)
                cr.set_source_rgba(accent[0], accent[1], accent[2], 0.24)
                cr.fill()
                cr.arc(tx, ty, stroke * 0.56, 0, 2 * math.pi)
                cr.set_source_rgba(1.0, 1.0, 1.0, 0.96)
                cr.fill()
                cr.set_line_width(2.0)
                cr.arc(tx, ty, stroke * 0.56, 0, 2 * math.pi)
                cr.set_source_rgba(*accent)
                cr.stroke()

        # 3. Multi-round notch ticks
        if not self._compact and self._tick_fractions:
            cr.set_line_width(1.6)
            cr.set_source_rgba(*pal["tick"])
            for frac in self._tick_fractions:
                if frac <= 0.01 or frac >= 0.99:
                    continue
                ang = start_angle + 2.0 * math.pi * frac
                r1 = radius - stroke * 0.45
                r2 = radius + stroke * 0.45
                cr.move_to(cx + r1 * math.cos(ang), cy + r1 * math.sin(ang))
                cr.line_to(cx + r2 * math.cos(ang), cy + r2 * math.sin(ang))
                cr.stroke()

        if self._compact:
            return

        # 4. Crisp digits & captions
        cr.select_font_face("Lato", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
        digit_scale = 0.190 if len(self._readout) <= 5 else 0.154 if len(self._readout) <= 7 else 0.132
        cr.set_font_size(size * digit_scale)
        ext = cr.text_extents(self._readout)
        cr.set_source_rgba(*pal["ink"])
        cr.move_to(cx - ext.width / 2.0 - ext.x_bearing, cy + ext.height / 2.0 - 2.0)
        cr.show_text(self._readout)

        if self._eyebrow:
            cr.select_font_face("Lato", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
            cr.set_font_size(max(9.5, size * 0.041))
            eyebrow_text = self._eyebrow.upper()
            e_ext = cr.text_extents(eyebrow_text)
            if self._tone in ("flow", "overrun", "rest"):
                cr.set_source_rgba(*accent)
            else:
                cr.set_source_rgba(*pal["muted"])
            cr.move_to(cx - e_ext.width / 2.0 - e_ext.x_bearing, cy - size * 0.142)
            cr.show_text(eyebrow_text)

        if self._subline:
            cr.select_font_face("Lato", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
            cr.set_font_size(max(10.5, size * 0.046))
            s_ext = cr.text_extents(self._subline)
            cr.set_source_rgba(*pal["muted"])
            cr.move_to(cx - s_ext.width / 2.0 - s_ext.x_bearing, cy + size * 0.180)
            cr.show_text(self._subline)


class DayProgressRing(Gtk.DrawingArea):
    """Compact 54×54 Cairo completion donut inside the Today hero header."""

    def __init__(self, size: int = 54) -> None:
        super().__init__()
        self.set_content_width(size)
        self.set_content_height(size)
        self.set_halign(Gtk.Align.CENTER)
        self.set_valign(Gtk.Align.CENTER)
        self._done = -1
        self._total = -1
        self._dark = False
        self.set_draw_func(self._draw)

    def set_progress(self, done: int, total: int, dark: bool) -> None:
        d = max(0, done)
        t = max(0, total)
        if d == self._done and t == self._total and dark == self._dark:
            return
        self._done = d
        self._total = t
        self._dark = dark
        self.queue_draw()

    def _draw(self, _area: Gtk.DrawingArea, cr: cairo.Context, width: int, height: int) -> None:
        cx, cy = width / 2.0, height / 2.0
        size = min(width, height)
        stroke = 4.6
        r = size / 2.0 - stroke - 1.5
        done = max(0, self._done)
        total = max(0, self._total)
        frac = (done / total) if total > 0 else 0.0

        track = (0.545, 0.627, 0.922, 0.18) if self._dark else (0.588, 0.345, 0.627, 0.16)
        ink = (0.933, 0.945, 1.0, 1.0) if self._dark else (0.200, 0.157, 0.290, 1.0)

        cr.set_line_width(stroke)
        cr.arc(cx, cy, r, 0, 2 * math.pi)
        cr.set_source_rgba(*track)
        cr.stroke()

        if frac > 0.005:
            grad = cairo.LinearGradient(cx - r, cy - r, cx + r, cy + r)
            if self._dark:
                grad.add_color_stop_rgba(0.0, 0.416, 0.510, 0.961, 1.0)
                grad.add_color_stop_rgba(1.0, 0.259, 0.851, 0.722, 1.0)
            else:
                grad.add_color_stop_rgba(0.0, 0.761, 0.239, 0.510, 1.0)
                grad.add_color_stop_rgba(1.0, 0.263, 0.400, 0.769, 1.0)
            cr.set_line_width(stroke)
            cr.set_line_cap(cairo.LINE_CAP_ROUND)
            cr.arc(cx, cy, r, -math.pi / 2.0, -math.pi / 2.0 + 2.0 * math.pi * min(1.0, frac))
            cr.set_source(grad)
            cr.stroke()

        label = "✓" if (total > 0 and done >= total) else (f"{done}/{total}" if total > 0 else "—")
        cr.select_font_face("Lato", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
        cr.set_font_size(14.0 if label == "✓" else 11.5)
        ext = cr.text_extents(label)
        cr.set_source_rgba(*ink)
        cr.move_to(cx - ext.width / 2.0 - ext.x_bearing, cy + ext.height / 2.0 - 0.5)
        cr.show_text(label)
