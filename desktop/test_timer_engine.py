"""Unit tests for Unravel Desktop timer engine, PKCE auth, stats math, and offline queue."""

from __future__ import annotations

import base64
import hashlib
import tempfile
import unittest
from pathlib import Path

from unravel_desktop.api import UnravelApi
from unravel_desktop.auth_flow import generate_pkce_pair
from unravel_desktop.timer_engine import (
    TimerConfig,
    TimerEngine,
    TimerSettings,
    arc_progress,
    build_interval_plan,
    format_clock,
    format_duration,
    next_round_extension,
)
from unravel_desktop.ui_stats import compute_day_summary


class TimerEngineParityTests(unittest.TestCase):
    def test_interval_plans_match_unravel_web(self) -> None:
        # Pomodoro 4 rounds -> F, SB, F, SB, F, SB, F (no trailing break)
        pomo = build_interval_plan(TimerConfig(mode="POMODORO", target_seconds=4 * 1500, intervals=4))
        self.assertEqual(
            [(i.kind, i.target_seconds) for i in pomo],
            [
                ("FOCUS", 1500),
                ("SHORT_BREAK", 300),
                ("FOCUS", 1500),
                ("SHORT_BREAK", 300),
                ("FOCUS", 1500),
                ("SHORT_BREAK", 300),
                ("FOCUS", 1500),
            ],
        )

        # 5 rounds -> long break after 4th focus
        pomo5 = build_interval_plan(TimerConfig(mode="POMODORO", target_seconds=5 * 1500, intervals=5))
        self.assertEqual(pomo5[7].kind, "LONG_BREAK")
        self.assertEqual(pomo5[7].target_seconds, 900)

        # Recovery -> single target=0 interval
        rec = build_interval_plan(TimerConfig(mode="RECOVERY", target_seconds=0, intervals=1))
        self.assertEqual([(i.kind, i.target_seconds) for i in rec], [("RECOVERY", 0)])
        self.assertEqual(arc_progress(600, 0), 0.0)

    def test_pomodoro_flow_continues_past_baseline_and_appends_round(self) -> None:
        eng = TimerEngine(
            settings=TimerSettings(focus_seconds=1500, short_break_seconds=300),
            config=TimerConfig(mode="FLOW", target_seconds=1500, intervals=1),
        )
        t0 = 1_700_000_000_000.0
        eng.start(t0)

        # Cross 25:00 baseline -> emits flow_baseline once and keeps running
        ev1 = eng.evaluate_tick(t0 + 1505 * 1000)
        self.assertEqual(ev1, ["flow_baseline"])
        self.assertEqual(eng.phase, "RUNNING")
        self.assertTrue(eng.is_focus_flowing(t0 + 1505 * 1000))
        self.assertEqual(eng.focus_flow_seconds(t0 + 1505 * 1000), 5)
        self.assertEqual(eng.readout(t0 + 1505 * 1000), "25:05")

        # Subsequent tick does not re-emit chime
        self.assertEqual(eng.evaluate_tick(t0 + 1510 * 1000), [])

        # Taking break appends break + 2nd focus round and banks flow seconds
        ext = eng.append_flow_round_and_advance(t0 + 1800 * 1000)
        self.assertIsNotNone(ext)
        self.assertEqual(eng.config.intervals, 2)
        self.assertEqual(eng.banked_flow_seconds, 300)
        self.assertTrue(eng.on_break())

        # During break, focus_elapsed_seconds excludes break time
        self.assertEqual(eng.focus_elapsed_seconds(t0 + 1920 * 1000), 1800)

    def test_break_overrun_vs_deliberate_extension(self) -> None:
        eng = TimerEngine(
            settings=TimerSettings(auto_start_next_focus=False),
            config=TimerConfig(mode="POMODORO", target_seconds=3000, intervals=2, short_break_seconds=300),
        )
        t0 = 1_700_000_000_000.0
        eng.start(t0)
        eng.advance_interval(1, resume=True, now_ms=t0 + 1500 * 1000)
        self.assertTrue(eng.on_break())

        # 30s past 5m break -> overrun
        t_over = t0 + (1500 + 330) * 1000
        self.assertEqual(eng.evaluate_tick(t_over), ["break_overrun"])
        self.assertTrue(eng.is_overrunning(t_over))
        self.assertEqual(eng.overrun_seconds(t_over), 30)
        self.assertEqual(eng.readout(t_over), "+00:30")

        # +5 more clears overrun cleanly
        eng.extend_interval(300)
        self.assertFalse(eng.is_overrunning(t_over))
        self.assertEqual(eng.readout(t_over), "04:30")

    def test_next_round_extension_long_break_on_fourth_block(self) -> None:
        ext = next_round_extension(
            TimerConfig(mode="FLOW", target_seconds=4 * 1500, intervals=4, long_break_every=4, long_break_seconds=900)
        )
        self.assertIsNotNone(ext)
        assert ext is not None
        self.assertEqual(ext.break_kind, "LONG_BREAK")
        self.assertEqual(ext.break_seconds, 900)
        self.assertEqual(ext.intervals, 5)

    def test_formatting(self) -> None:
        self.assertEqual(format_clock(0), "00:00")
        self.assertEqual(format_clock(1505), "25:05")
        self.assertEqual(format_clock(3661), "1:01:01")
        self.assertEqual(format_duration(90), "2m")
        self.assertEqual(format_duration(5400), "1h 30m")


class AuthStatsQueueTests(unittest.TestCase):
    def test_pkce_s256_pair_valid(self) -> None:
        verifier, challenge = generate_pkce_pair()
        self.assertGreaterEqual(len(verifier), 43)
        expected = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).decode("ascii").rstrip("=")
        self.assertEqual(challenge, expected)

    def test_stats_day_summary_excludes_inactive_and_finds_first_time(self) -> None:
        day = {
            "productiveSeconds": 1800,
            "items": {
                "h1": {"status": "done", "completedAtMs": 2000, "completedTime": "08:30"},
                "h2": {"status": "inactive"},
                "mind:woop": {"status": "done", "completedAtMs": 1000, "completedTime": "07:15", "practiceSeconds": 600},
                "h3": {"status": "open"},
            },
        }
        s = compute_day_summary(day, {"h1", "h2", "mind:woop", "h3"})
        self.assertEqual(s["done"], 2)
        self.assertEqual(s["total"], 3)  # h2 inactive NOT deducted
        self.assertEqual(s["pct"], 67)
        self.assertEqual(s["total_productive_seconds"], 2400)
        self.assertEqual(s["first_habit_time"], "07:15")

    def test_offline_queue_deduplicates_heartbeats(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            pending = Path(tmp) / "pending.json"
            api = UnravelApi("https://unravel-chi.vercel.app", "unr_testtoken123456789012345", pending_path=pending)
            api.enqueue_pending("POST", "/api/desktop/timer/s1", {"action": "heartbeat"})
            api.enqueue_pending("POST", "/api/desktop/timer/s1", {"action": "heartbeat"})
            api.enqueue_pending("POST", "/api/desktop/timer/s1", {"action": "pause"})
            items = api._read_pending()
            self.assertEqual(len(items), 2)
            self.assertEqual(items[0]["body"]["action"], "heartbeat")
            self.assertEqual(items[1]["body"]["action"], "pause")


if __name__ == "__main__":
    unittest.main()
