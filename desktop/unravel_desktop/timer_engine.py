"""Pure wall-clock timer engine — 1:1 port of Unravel's `lib/timer-math.ts`.

Rule: elapsed time is ALWAYS derived from wall-clock timestamps (`time.time()`),
never accumulated by ticking. Suspend, lock screen, or UI lag cannot drift it.
"""

from __future__ import annotations

import math
import time
import uuid
from dataclasses import dataclass, field
from typing import Literal

TimerMode = Literal["POMODORO", "BASIC", "FLOW", "RECOVERY"]
IntervalKind = Literal["FOCUS", "SHORT_BREAK", "LONG_BREAK", "RECOVERY"]
TimerPhase = Literal["IDLE", "RUNNING", "PAUSED", "ENDED"]

MIN_TARGET_SECONDS = 60
MAX_TARGET_SECONDS = 8 * 60 * 60
MAX_INTERVALS = 12
MIN_BREAK_SECONDS = 60
MAX_BREAK_SECONDS = 60 * 60

DEFAULTS = {
    "target_seconds": 25 * 60,
    "focus_seconds": 25 * 60,
    "short_break_seconds": 5 * 60,
    "long_break_seconds": 15 * 60,
    "long_break_every": 4,
}

CADENCE_PRESETS = [
    (15, 3, "15 / 3", "Gentle start"),
    (25, 5, "25 / 5", "Classic"),
    (45, 10, "45 / 10", "Deep block"),
    (50, 10, "50 / 10", "Long flow"),
]

BASIC_MINUTE_PRESETS = [10, 15, 25, 45, 60]

MODE_LABELS: dict[str, str] = {
    "POMODORO": "Pomodoro",
    "FLOW": "Pomodoro Flow",
    "BASIC": "Timer",
    "RECOVERY": "Recovery",
}

MODE_DESCRIPTIONS: dict[str, str] = {
    "POMODORO": "Classic focus rounds with automatic breaks.",
    "FLOW": "Work baseline keeps flowing smoothly past the mark until you take a break or stop.",
    "BASIC": "One focused countdown block, no scheduled breaks.",
    "RECOVERY": "Open-ended deliberate rest, logged separately from focus time.",
}

INTERVAL_LABELS: dict[str, str] = {
    "FOCUS": "Focus",
    "SHORT_BREAK": "Short break",
    "LONG_BREAK": "Long break",
    "RECOVERY": "Recovery",
}


def has_intervals(mode: str) -> bool:
    return mode in ("POMODORO", "FLOW")


def is_break_kind(kind: str) -> bool:
    return kind in ("SHORT_BREAK", "LONG_BREAK")


def ends_automatically(mode: str) -> bool:
    return mode in ("BASIC", "POMODORO")


def clamp_target(seconds: float) -> int:
    if not math.isfinite(seconds):
        return DEFAULTS["target_seconds"]
    return min(MAX_TARGET_SECONDS, max(MIN_TARGET_SECONDS, round(seconds)))


def clamp_break(seconds: float) -> int:
    if not math.isfinite(seconds):
        return DEFAULTS["short_break_seconds"]
    return min(MAX_BREAK_SECONDS, max(MIN_BREAK_SECONDS, round(seconds)))


def clamp_intervals(count: float) -> int:
    if not math.isfinite(count):
        return 1
    return min(MAX_INTERVALS, max(1, round(count)))


def suggest_intervals(target_seconds: int, focus_seconds: int) -> int:
    if focus_seconds <= 0:
        return 1
    return clamp_intervals(round(target_seconds / focus_seconds) or 1)


@dataclass
class TimerSettings:
    focus_seconds: int = 1500
    short_break_seconds: int = 300
    long_break_seconds: int = 900
    long_break_every: int = 4
    auto_start_breaks: bool = False
    auto_start_next_focus: bool = False
    sound_enabled: bool = True
    haptics_enabled: bool = True
    return_alerts_enabled: bool = True

    @classmethod
    def from_api(cls, data: dict) -> TimerSettings:
        return cls(
            focus_seconds=int(data.get("focusSeconds", 1500)),
            short_break_seconds=int(data.get("shortBreakSeconds", 300)),
            long_break_seconds=int(data.get("longBreakSeconds", 900)),
            long_break_every=int(data.get("longBreakEvery", 4)),
            auto_start_breaks=bool(data.get("autoStartBreaks", False)),
            auto_start_next_focus=bool(data.get("autoStartNextFocus", False)),
            sound_enabled=bool(data.get("soundEnabled", True)),
            haptics_enabled=bool(data.get("hapticsEnabled", True)),
            return_alerts_enabled=bool(data.get("returnAlertsEnabled", True)),
        )


@dataclass
class TimerConfig:
    mode: TimerMode = "FLOW"
    target_seconds: int = 1500
    intervals: int = 1
    focus_seconds: int = 1500
    short_break_seconds: int = 300
    long_break_seconds: int = 900
    long_break_every: int = 4

    @classmethod
    def from_settings(cls, settings: TimerSettings, mode: TimerMode = "FLOW") -> TimerConfig:
        return cls(
            mode=mode,
            target_seconds=0 if mode == "RECOVERY" else settings.focus_seconds,
            intervals=1,
            focus_seconds=settings.focus_seconds,
            short_break_seconds=settings.short_break_seconds,
            long_break_seconds=settings.long_break_seconds,
            long_break_every=settings.long_break_every,
        )


@dataclass(frozen=True)
class PlannedInterval:
    index: int
    kind: IntervalKind
    target_seconds: int


@dataclass(frozen=True)
class RoundExtension:
    intervals: int
    target_seconds: int
    break_kind: Literal["SHORT_BREAK", "LONG_BREAK"]
    break_seconds: int


@dataclass
class AttachedTask:
    id: str
    title: str
    type: Literal["TODO", "HABIT"]
    estimated_seconds: int | None = None
    default_mode: str | None = None
    planned_intervals: int | None = None


def per_focus_seconds(config: TimerConfig) -> int:
    count = clamp_intervals(config.intervals)
    return max(MIN_TARGET_SECONDS, round(config.target_seconds / count))


def build_interval_plan(config: TimerConfig) -> list[PlannedInterval]:
    if config.mode == "RECOVERY":
        return [PlannedInterval(index=0, kind="RECOVERY", target_seconds=0)]
    if not has_intervals(config.mode):
        return [PlannedInterval(index=0, kind="FOCUS", target_seconds=config.target_seconds)]

    count = clamp_intervals(config.intervals)
    per_focus = per_focus_seconds(config)
    plan: list[PlannedInterval] = []
    focuses_so_far = 0

    for i in range(count):
        plan.append(PlannedInterval(index=len(plan), kind="FOCUS", target_seconds=per_focus))
        focuses_so_far += 1
        if i == count - 1:
            break
        is_long = config.long_break_every > 0 and focuses_so_far % config.long_break_every == 0
        plan.append(
            PlannedInterval(
                index=len(plan),
                kind="LONG_BREAK" if is_long else "SHORT_BREAK",
                target_seconds=config.long_break_seconds if is_long else config.short_break_seconds,
            )
        )
    return plan


def next_round_extension(config: TimerConfig) -> RoundExtension | None:
    if config.mode != "FLOW":
        return None
    current_count = clamp_intervals(config.intervals)
    if current_count >= MAX_INTERVALS:
        return None
    focus_block = per_focus_seconds(config)
    next_intervals = current_count + 1
    next_target = focus_block * next_intervals
    if next_target > MAX_TARGET_SECONDS:
        return None
    is_long = config.long_break_every > 0 and current_count % config.long_break_every == 0
    return RoundExtension(
        intervals=next_intervals,
        target_seconds=next_target,
        break_kind="LONG_BREAK" if is_long else "SHORT_BREAK",
        break_seconds=config.long_break_seconds if is_long else config.short_break_seconds,
    )


def arc_progress(elapsed_seconds: float, target_seconds: float) -> float:
    if target_seconds <= 0:
        return 0.0
    return min(1.0, max(0.0, 1.0 - elapsed_seconds / target_seconds))


def overtime_progress(overtime_seconds: float, target_seconds: float) -> float:
    if target_seconds <= 0 or overtime_seconds <= 0:
        return 0.0
    return min(1.0, overtime_seconds / target_seconds)


def format_clock(seconds: int) -> str:
    s = max(0, int(seconds))
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    if h > 0:
        return f"{h}:{m:02d}:{sec:02d}"
    return f"{m:02d}:{sec:02d}"


def format_duration(seconds: int) -> str:
    s = max(0, int(seconds))
    if s < 60:
        return f"{s}s"
    total_m = round(s / 60)
    h, m = divmod(total_m, 60)
    if h == 0:
        return f"{m}m"
    if m == 0:
        return f"{h}h"
    return f"{h}h {m}m"


@dataclass
class TimerEngine:
    """Stateful wall-clock timer engine synced with Unravel's server sessions."""

    settings: TimerSettings = field(default_factory=TimerSettings)
    config: TimerConfig = field(default_factory=TimerConfig)
    task: AttachedTask | None = None
    phase: TimerPhase = "IDLE"
    session_id: str | None = None
    client_key: str = field(default_factory=lambda: str(uuid.uuid4()))
    accumulated_ms: float = 0.0
    running_since_ms: float | None = None
    interval_index: int = 0
    interval_base_ms: float = 0.0
    closed_break_seconds: int = 0
    banked_flow_seconds: int = 0
    interval_extra_seconds: int = 0
    return_note: str | None = None
    reached_target: bool = False
    overrun_since_ms: float | None = None
    focus_flow_since_ms: float | None = None

    def now_ms(self) -> float:
        return time.time() * 1000.0

    def plan(self) -> list[PlannedInterval]:
        return build_interval_plan(self.config)

    def current_interval(self) -> PlannedInterval:
        p = self.plan()
        return p[min(self.interval_index, len(p) - 1)]

    def live_elapsed_ms(self, now_ms: float | None = None) -> float:
        now = self.now_ms() if now_ms is None else now_ms
        live = 0.0 if self.running_since_ms is None else max(0.0, now - self.running_since_ms)
        return max(0.0, self.accumulated_ms + live)

    def wall_elapsed_seconds(self, now_ms: float | None = None) -> int:
        return int(self.live_elapsed_ms(now_ms) // 1000)

    def interval_elapsed_seconds(self, now_ms: float | None = None) -> int:
        elapsed_ms = max(0.0, self.live_elapsed_ms(now_ms) - self.interval_base_ms)
        return int(elapsed_ms // 1000)

    def current_target_seconds(self) -> int:
        cur = self.current_interval()
        if cur.target_seconds <= 0:
            return 0
        return cur.target_seconds + self.interval_extra_seconds

    def on_break(self) -> bool:
        return self.phase in ("RUNNING", "PAUSED") and is_break_kind(self.current_interval().kind)

    def focus_elapsed_seconds(self, now_ms: float | None = None) -> int:
        wall = self.wall_elapsed_seconds(now_ms)
        live_break = self.interval_elapsed_seconds(now_ms) if self.on_break() else 0
        return max(0, wall - self.closed_break_seconds - live_break)

    def is_focus_flowing(self, now_ms: float | None = None) -> bool:
        cur = self.current_interval()
        return (
            self.config.mode == "FLOW"
            and self.phase in ("RUNNING", "PAUSED")
            and cur.kind == "FOCUS"
            and self.current_target_seconds() > 0
            and self.interval_elapsed_seconds(now_ms) >= self.current_target_seconds()
        )

    def focus_flow_seconds(self, now_ms: float | None = None) -> int:
        if not self.is_focus_flowing(now_ms):
            return 0
        return max(0, self.interval_elapsed_seconds(now_ms) - self.current_target_seconds())

    def total_flow_seconds(self, now_ms: float | None = None) -> int:
        return self.banked_flow_seconds + self.focus_flow_seconds(now_ms)

    def overrun_seconds(self, now_ms: float | None = None) -> int:
        if not self.on_break():
            return 0
        target = self.current_target_seconds()
        if target <= 0:
            return 0
        return max(0, self.interval_elapsed_seconds(now_ms) - target)

    def is_overrunning(self, now_ms: float | None = None) -> bool:
        return self.on_break() and self.overrun_seconds(now_ms) > 0

    def next_break_info(self) -> tuple[str, int, bool] | None:
        """Returns (kind, seconds, appends_round) if user can take a break from current focus."""
        if self.phase not in ("RUNNING", "PAUSED") or self.on_break():
            return None
        if not has_intervals(self.config.mode):
            return None
        p = self.plan()
        nxt = p[self.interval_index + 1] if self.interval_index + 1 < len(p) else None
        if nxt and is_break_kind(nxt.kind):
            return (nxt.kind, nxt.target_seconds, False)
        ext = next_round_extension(self.config)
        if ext:
            return (ext.break_kind, ext.break_seconds, True)
        return None

    def readout(self, now_ms: float | None = None) -> str:
        cur = self.current_interval()
        target = self.current_target_seconds()
        i_elapsed = self.interval_elapsed_seconds(now_ms)
        if self.is_overrunning(now_ms):
            return f"+{format_clock(self.overrun_seconds(now_ms))}"
        if self.on_break():
            return format_clock(max(0, target - i_elapsed))
        if self.config.mode == "RECOVERY":
            return format_clock(i_elapsed)
        if self.is_focus_flowing(now_ms):
            return format_clock(i_elapsed)
        if self.phase == "IDLE":
            return format_clock(target if target > 0 else self.config.target_seconds)
        return format_clock(max(0, target - i_elapsed))

    # ---------------------------------------------------------------- mutations

    def configure(self, **kwargs) -> None:
        if self.phase != "IDLE":
            return
        for key, value in kwargs.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)

    def start(self, now_ms: float | None = None) -> None:
        now = self.now_ms() if now_ms is None else now_ms
        if self.phase == "ENDED":
            self.client_key = str(uuid.uuid4())
        self.phase = "RUNNING"
        self.running_since_ms = now
        self.accumulated_ms = 0.0
        self.interval_index = 0
        self.interval_base_ms = 0.0
        self.closed_break_seconds = 0
        self.banked_flow_seconds = 0
        self.interval_extra_seconds = 0
        self.return_note = None
        self.reached_target = False
        self.overrun_since_ms = None
        self.focus_flow_since_ms = None
        self.session_id = None

    def pause(self, now_ms: float | None = None) -> None:
        if self.phase != "RUNNING":
            return
        now = self.now_ms() if now_ms is None else now_ms
        self.accumulated_ms = self.live_elapsed_ms(now)
        self.running_since_ms = None
        self.phase = "PAUSED"

    def resume(self, now_ms: float | None = None) -> None:
        if self.phase != "PAUSED":
            return
        now = self.now_ms() if now_ms is None else now_ms
        self.running_since_ms = now
        self.phase = "RUNNING"

    def extend_interval(self, seconds: int) -> None:
        self.interval_extra_seconds += max(0, int(seconds))
        self.overrun_since_ms = None

    def advance_interval(
        self,
        next_index: int,
        resume: bool = False,
        now_ms: float | None = None,
    ) -> None:
        now = self.now_ms() if now_ms is None else now_ms
        elapsed = self.live_elapsed_ms(now)
        p = self.plan()
        leaving = p[self.interval_index] if self.interval_index < len(p) else None
        leaving_elapsed = max(0, round((elapsed - self.interval_base_ms) / 1000.0))

        if leaving and is_break_kind(leaving.kind):
            self.closed_break_seconds += leaving_elapsed
        elif leaving and leaving.kind == "FOCUS" and leaving.target_seconds > 0:
            self.banked_flow_seconds += max(
                0, leaving_elapsed - (leaving.target_seconds + self.interval_extra_seconds)
            )

        should_run = self.phase == "RUNNING" or resume
        self.phase = "RUNNING" if should_run else self.phase
        self.interval_index = next_index
        self.interval_base_ms = elapsed
        self.accumulated_ms = elapsed
        self.running_since_ms = now if should_run else None
        self.interval_extra_seconds = 0
        self.overrun_since_ms = None
        self.focus_flow_since_ms = None
        self.return_note = None

    def append_flow_round_and_advance(self, now_ms: float | None = None) -> RoundExtension | None:
        ext = next_round_extension(self.config)
        if not ext:
            return None
        now = self.now_ms() if now_ms is None else now_ms
        elapsed = self.live_elapsed_ms(now)
        leaving = self.current_interval()
        leaving_elapsed = max(0, round((elapsed - self.interval_base_ms) / 1000.0))
        if leaving.kind == "FOCUS" and leaving.target_seconds > 0:
            self.banked_flow_seconds += max(
                0, leaving_elapsed - (leaving.target_seconds + self.interval_extra_seconds)
            )
        self.config.intervals = ext.intervals
        self.config.target_seconds = ext.target_seconds
        self.interval_index += 1
        self.interval_base_ms = elapsed
        self.accumulated_ms = elapsed
        self.running_since_ms = now
        self.phase = "RUNNING"
        self.interval_extra_seconds = 0
        self.overrun_since_ms = None
        self.focus_flow_since_ms = None
        self.return_note = None
        return ext

    def end(self, now_ms: float | None = None) -> None:
        now = self.now_ms() if now_ms is None else now_ms
        self.accumulated_ms = self.live_elapsed_ms(now)
        self.running_since_ms = None
        self.phase = "ENDED"

    def reset(self, config: TimerConfig | None = None, task: AttachedTask | None = None) -> None:
        if config is not None:
            self.config = config
        if task is not None:
            self.task = task
        self.phase = "IDLE"
        self.session_id = None
        self.client_key = str(uuid.uuid4())
        self.accumulated_ms = 0.0
        self.running_since_ms = None
        self.interval_index = 0
        self.interval_base_ms = 0.0
        self.closed_break_seconds = 0
        self.banked_flow_seconds = 0
        self.interval_extra_seconds = 0
        self.return_note = None
        self.reached_target = False
        self.overrun_since_ms = None
        self.focus_flow_since_ms = None

    def hydrate_from_server(self, data: dict) -> None:
        """Adopt a live RUNNING/PAUSED session hydrated by `/api/desktop/bootstrap`."""
        cfg = data["config"]
        self.config = TimerConfig(
            mode=cfg["mode"],
            target_seconds=int(cfg["targetSeconds"]),
            intervals=int(cfg["intervals"]),
            focus_seconds=int(cfg["focusSeconds"]),
            short_break_seconds=int(cfg["shortBreakSeconds"]),
            long_break_seconds=int(cfg["longBreakSeconds"]),
            long_break_every=int(cfg["longBreakEvery"]),
        )
        t = data.get("task")
        self.task = (
            AttachedTask(id=t["id"], title=t["title"], type=t["type"]) if t else None
        )
        self.session_id = data["id"]
        self.client_key = data["clientKey"]
        self.phase = "RUNNING" if data["status"] == "RUNNING" else "PAUSED"
        self.accumulated_ms = float(data["accumulatedSeconds"]) * 1000.0
        self.running_since_ms = (
            float(data["runningSince"]) if data.get("runningSince") is not None else None
        )
        self.interval_index = int(data["intervalIndex"])
        self.interval_base_ms = float(data["intervalBaseSeconds"]) * 1000.0
        self.closed_break_seconds = int(data["breakElapsedSeconds"])
        self.banked_flow_seconds = int(data.get("bankedFlowSeconds", 0))
        self.interval_extra_seconds = int(data.get("intervalExtraSeconds", 0))
        self.return_note = data.get("returnNote")
        self.reached_target = bool(data.get("reachedTarget", False))
        self.overrun_since_ms = None
        self.focus_flow_since_ms = (
            self.now_ms() if data.get("intervalAlreadyFlowing") else None
        )

    def evaluate_tick(self, now_ms: float | None = None) -> list[str]:
        """Evaluate threshold transitions on a running clock; returns event names."""
        if self.phase != "RUNNING":
            return []
        now = self.now_ms() if now_ms is None else now_ms
        events: list[str] = []
        cur = self.current_interval()
        target = self.current_target_seconds()
        i_elapsed = self.interval_elapsed_seconds(now)

        if self.config.mode != "RECOVERY" and not self.reached_target:
            if self.focus_elapsed_seconds(now) >= self.config.target_seconds > 0:
                self.reached_target = True

        # Focus block crossing baseline in Pomodoro Flow -> gentle chime once, keep flowing.
        if (
            self.config.mode == "FLOW"
            and cur.kind == "FOCUS"
            and target > 0
            and i_elapsed >= target
            and self.focus_flow_since_ms is None
        ):
            self.focus_flow_since_ms = now
            events.append("flow_baseline")
            return events

        # Break interval reaching zero -> auto-advance or enter break overrun.
        if is_break_kind(cur.kind) and target > 0 and i_elapsed >= target:
            p = self.plan()
            has_next = self.interval_index + 1 < len(p)
            if self.settings.auto_start_next_focus and has_next:
                self.advance_interval(self.interval_index + 1, resume=True, now_ms=now)
                events.append("auto_advanced_to_focus")
                return events
            if self.overrun_since_ms is None:
                self.overrun_since_ms = now
                events.append("break_overrun")
            return events

        # Classic POMODORO / BASIC focus reaching zero -> advance to break or finish.
        if (
            ends_automatically(self.config.mode)
            and cur.kind == "FOCUS"
            and target > 0
            and i_elapsed >= target
        ):
            p = self.plan()
            if self.interval_index + 1 < len(p):
                if self.settings.auto_start_breaks:
                    self.advance_interval(self.interval_index + 1, resume=True, now_ms=now)
                    events.append("auto_advanced_to_break")
                else:
                    self.advance_interval(self.interval_index + 1, resume=False, now_ms=now)
                    self.pause(now)
                    events.append("paused_for_break")
            else:
                self.end(now)
                events.append("target_reached_end")

        return events
