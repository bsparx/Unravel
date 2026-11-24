"""Serene Cairo Time-Timer ring widget with radial glow, tick marks, and leading dot."""

from __future__ import annotations

import math

import cairo
import gi

gi.require_version("Gtk", "4.0")
from gi.repository import Gtk


PALETTES = {
    "light": {
        "track": (0.06, 0.09, 0.16, 0.085),
        "well": (1.0, 1.0, 1.0, 0.86),
        "well_rim": (0.06, 0.09, 0.16, 0.06),
        "focus": (0.05, 0.54, 0.50, 1.0),
        "flow": (0.03, 0.62, 0.44, 1.0),
        "rest": (0.39, 0.40, 0.90, 1.0),
        "overrun": (0.86, 0.23, 0.27, 1.0),
        "ink": (0.08, 0.10, 0.16, 1.0),
        "muted": (0.39, 0.45, 0.54, 1.0),
        "tick": (0.06, 0.09, 0.16, 0.22),
    },
    "dark": {
        "track": (1.0, 1.0, 1.0, 0.10),
        "well": (0.10, 0.13, 0.20, 0.88),
        "well_rim": (1.0, 1.0, 1.0, 0.08),
        "focus": (0.18, 0.82, 0.75, 1.0),
        "flow": (0.20, 0.86, 0.60, 1.0),
        "rest": (0.56, 0.58, 0.98, 1.0),
        "overrun": (0.97, 0.44, 0.44, 1.0),
        "ink": (0.96, 0.97, 1.0, 1.0),
        "muted": (0.63, 0.69, 0.79, 1.0),
        "tick": (1.0, 1.0, 1.0, 0.28),
    },
}


class TimerRingWidget(Gtk.DrawingArea):
    """Draining Time-Timer arc with ambient glow, round ticks, and centered digits."""

    def __init__(self, size: int = 264, compact: bool = False) -> None:
        super().__init__()
        self._compact = compact
        self.set_content_width(size)
        self.set_content_height(size)
        self.set_halign(Gtk.Align.CENTER)
        self.set_valign(Gtk.Align.CENTER)

        self._progress = 1.0
        self._tone = "focus"  # focus | flow | rest | overrun
        self._readout = "25:00"
        self._eyebrow = ""
        self._subline = ""
        self._dark = False
        self._pulse = False
        self._tick_fractions: list[float] = []

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
        self._progress = max(0.0, min(1.0, progress))
        self._tone = tone if tone in ("focus", "flow", "rest", "overrun") else "focus"
        self._readout = readout
        self._eyebrow = eyebrow
        self._subline = subline
        self._dark = dark
        self._pulse = pulse
        self._tick_fractions = tick_fractions or []
        self.queue_draw()

    def _draw(self, _area: Gtk.DrawingArea, cr: cairo.Context, width: int, height: int) -> None:
        pal = PALETTES["dark" if self._dark else "light"]
        accent = pal[self._tone]
        cx = width / 2.0
        cy = height / 2.0
        size = min(width, height)
        stroke = max(4.5, size * (0.095 if self._compact else 0.048))
        margin = 3.0 if self._compact else 12.0
        radius = (size / 2.0) - stroke - margin

        # Ambient radial aura behind ring (full mode only)
        if not self._compact:
            aura_alpha = 0.20 if self._pulse else 0.11
            grad = cairo.RadialGradient(cx, cy, radius * 0.55, cx, cy, size * 0.50)
            grad.add_color_stop_rgba(0.0, accent[0], accent[1], accent[2], aura_alpha)
            grad.add_color_stop_rgba(0.68, accent[0], accent[1], accent[2], aura_alpha * 0.35)
            grad.add_color_stop_rgba(1.0, accent[0], accent[1], accent[2], 0.0)
            cr.set_source(grad)
            cr.arc(cx, cy, size * 0.50, 0, 2 * math.pi)
            cr.fill()

        # Frosted inner dial well + subtle hairline rim
        well_r = radius - stroke * 0.62
        cr.arc(cx, cy, well_r, 0, 2 * math.pi)
        cr.set_source_rgba(*pal["well"])
        cr.fill()
        if not self._compact:
            cr.set_line_width(1.0)
            cr.arc(cx, cy, well_r, 0, 2 * math.pi)
            cr.set_source_rgba(*pal["well_rim"])
            cr.stroke()

        # Track circle
        cr.set_line_width(stroke)
        cr.arc(cx, cy, radius, 0, 2 * math.pi)
        cr.set_source_rgba(*pal["track"])
        cr.stroke()

        # Subtle outer halo during Flow / Recovery
        if self._pulse and not self._compact:
            cr.set_line_width(stroke * 1.85)
            cr.arc(cx, cy, radius, 0, 2 * math.pi)
            cr.set_source_rgba(accent[0], accent[1], accent[2], 0.14)
            cr.stroke()

        # Active arc (12 o'clock clockwise)
        start_angle = -math.pi / 2.0
        if self._progress > 0.002:
            end_angle = start_angle + 2.0 * math.pi * self._progress
            cr.set_line_width(stroke)
            cr.set_line_cap(cairo.LINE_CAP_ROUND)
            cr.arc(cx, cy, radius, start_angle, end_angle)
            cr.set_source_rgba(*accent)
            cr.stroke()

            # Glowing leading-edge bead on full ring when partially drained
            if not self._compact and 0.02 < self._progress < 0.995:
                tx = cx + radius * math.cos(end_angle)
                ty = cy + radius * math.sin(end_angle)
                cr.arc(tx, ty, stroke * 0.58, 0, 2 * math.pi)
                cr.set_source_rgba(1.0, 1.0, 1.0, 0.92 if not self._dark else 0.96)
                cr.fill()
                cr.set_line_width(2.0)
                cr.arc(tx, ty, stroke * 0.58, 0, 2 * math.pi)
                cr.set_source_rgba(*accent)
                cr.stroke()

        # Subtle multi-round tick marks
        if not self._compact and self._tick_fractions:
            cr.set_line_width(1.5)
            cr.set_source_rgba(*pal["tick"])
            for frac in self._tick_fractions:
                if frac <= 0.01 or frac >= 0.99:
                    continue
                ang = start_angle + 2.0 * math.pi * frac
                r1 = radius - stroke * 0.42
                r2 = radius + stroke * 0.42
                cr.move_to(cx + r1 * math.cos(ang), cy + r1 * math.sin(ang))
                cr.line_to(cx + r2 * math.cos(ang), cy + r2 * math.sin(ang))
                cr.stroke()

        if self._compact:
            return

        # Centered readout digits
        cr.select_font_face("Sans", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
        digit_scale = 0.195 if len(self._readout) <= 5 else 0.16 if len(self._readout) <= 7 else 0.135
        cr.set_font_size(size * digit_scale)
        ext = cr.text_extents(self._readout)
        cr.set_source_rgba(*pal["ink"])
        cr.move_to(cx - ext.width / 2.0 - ext.x_bearing, cy + ext.height / 2.0 - 2.0)
        cr.show_text(self._readout)

        # Eyebrow above digits
        if self._eyebrow:
            cr.select_font_face("Sans", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
            cr.set_font_size(max(9.5, size * 0.041))
            eyebrow_text = self._eyebrow.upper()
            e_ext = cr.text_extents(eyebrow_text)
            if self._tone in ("flow", "overrun", "rest"):
                cr.set_source_rgba(*accent)
            else:
                cr.set_source_rgba(*pal["muted"])
            cr.move_to(cx - e_ext.width / 2.0 - e_ext.x_bearing, cy - size * 0.145)
            cr.show_text(eyebrow_text)

        # Subline beneath digits
        if self._subline:
            cr.select_font_face("Sans", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
            cr.set_font_size(max(10.0, size * 0.046))
            s_ext = cr.text_extents(self._subline)
            cr.set_source_rgba(*pal["muted"])
            cr.move_to(cx - s_ext.width / 2.0 - s_ext.x_bearing, cy + size * 0.185)
            cr.show_text(self._subline)
