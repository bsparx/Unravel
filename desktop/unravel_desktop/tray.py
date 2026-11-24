"""Pure D-Bus GNOME top-bar tray indicator (StatusNotifierItem + dbusmenu).

Registers directly on the session D-Bus via `Gio.DBusConnection`, avoiding
`AyatanaAppIndicator3`'s GTK3 dependency clash inside a GTK4 process. Works
natively with Ubuntu's built-in GNOME AppIndicator extension.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Callable

import gi

gi.require_version("Gio", "2.0")
gi.require_version("GLib", "2.0")
from gi.repository import Gio, GLib

SNI_XML = """
<node>
  <interface name="org.kde.StatusNotifierItem">
    <method name="ContextMenu">
      <arg name="x" type="i" direction="in"/>
      <arg name="y" type="i" direction="in"/>
    </method>
    <method name="Activate">
      <arg name="x" type="i" direction="in"/>
      <arg name="y" type="i" direction="in"/>
    </method>
    <method name="SecondaryActivate">
      <arg name="x" type="i" direction="in"/>
      <arg name="y" type="i" direction="in"/>
    </method>
    <method name="Scroll">
      <arg name="delta" type="i" direction="in"/>
      <arg name="orientation" type="s" direction="in"/>
    </method>
    <signal name="NewTitle"/>
    <signal name="NewIcon"/>
    <signal name="NewStatus">
      <arg name="status" type="s"/>
    </signal>
    <signal name="XAyatanaNewLabel">
      <arg name="label" type="s"/>
      <arg name="guide" type="s"/>
    </signal>
    <property name="Category" type="s" access="read"/>
    <property name="Id" type="s" access="read"/>
    <property name="Title" type="s" access="read"/>
    <property name="Status" type="s" access="read"/>
    <property name="IconName" type="s" access="read"/>
    <property name="IconThemePath" type="s" access="read"/>
    <property name="Menu" type="o" access="read"/>
    <property name="ItemIsMenu" type="b" access="read"/>
    <property name="XAyatanaLabel" type="s" access="read"/>
    <property name="XAyatanaLabelGuide" type="s" access="read"/>
  </interface>
</node>
"""

DBUSMENU_XML = """
<node>
  <interface name="com.canonical.dbusmenu">
    <method name="GetLayout">
      <arg name="parentId" type="i" direction="in"/>
      <arg name="recursionDepth" type="i" direction="in"/>
      <arg name="propertyNames" type="as" direction="in"/>
      <arg name="revision" type="u" direction="out"/>
      <arg name="layout" type="(ia{sv}av)" direction="out"/>
    </method>
    <method name="GetGroupProperties">
      <arg name="ids" type="ai" direction="in"/>
      <arg name="propertyNames" type="as" direction="in"/>
      <arg name="properties" type="a(ia{sv})" direction="out"/>
    </method>
    <method name="GetProperty">
      <arg name="id" type="i" direction="in"/>
      <arg name="name" type="s" direction="in"/>
      <arg name="value" type="v" direction="out"/>
    </method>
    <method name="Event">
      <arg name="id" type="i" direction="in"/>
      <arg name="eventId" type="s" direction="in"/>
      <arg name="data" type="v" direction="in"/>
      <arg name="timestamp" type="u" direction="in"/>
    </method>
    <method name="EventGroup">
      <arg name="events" type="a(isvu)" direction="in"/>
      <arg name="idErrors" type="ai" direction="out"/>
    </method>
    <method name="AboutToShow">
      <arg name="id" type="i" direction="in"/>
      <arg name="needUpdate" type="b" direction="out"/>
    </method>
    <signal name="LayoutUpdated">
      <arg name="revision" type="u"/>
      <arg name="parent" type="i"/>
    </signal>
    <property name="Version" type="u" access="read"/>
    <property name="TextDirection" type="s" access="read"/>
    <property name="Status" type="s" access="read"/>
  </interface>
</node>
"""

ITEM_TOGGLE_SHOW = 1
ITEM_TOGGLE_MINI = 2
ITEM_SEP_1 = 3
ITEM_PLAY_PAUSE = 4
ITEM_TAKE_BREAK = 5
ITEM_STOP = 6
ITEM_SEP_2 = 7
ITEM_QUIT = 8


class GnomeTopBarTray:
    """Shows live timer text in Ubuntu's GNOME top bar + quick action menu."""

    def __init__(
        self,
        *,
        on_toggle_window: Callable[[], None],
        on_toggle_mini: Callable[[], None],
        on_toggle_timer: Callable[[], None],
        on_take_break: Callable[[], None],
        on_stop_timer: Callable[[], None],
        on_quit: Callable[[], None],
        icon_dir: Path | None = None,
    ) -> None:
        self._callbacks = {
            ITEM_TOGGLE_SHOW: on_toggle_window,
            ITEM_TOGGLE_MINI: on_toggle_mini,
            ITEM_PLAY_PAUSE: on_toggle_timer,
            ITEM_TAKE_BREAK: on_take_break,
            ITEM_STOP: on_stop_timer,
            ITEM_QUIT: on_quit,
        }
        self._label = ""
        self._title = "Unravel"
        self._revision = 1
        self._state = {
            "visible": True,
            "mini": False,
            "phase": "IDLE",
            "can_break": False,
        }
        self._icon_dir = str(icon_dir) if icon_dir and icon_dir.exists() else ""
        self._icon_name = "unravel" if (icon_dir and (icon_dir / "unravel.svg").exists()) else "unravel-desktop"
        self._bus: Gio.DBusConnection | None = None
        self._sni_reg_id: int | None = None
        self._menu_reg_id: int | None = None
        self._bus_name_id: int | None = None
        self._service_name = f"org.kde.StatusNotifierItem-{os.getpid()}-1"

    def start(self) -> None:
        try:
            self._bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
            sni_info = Gio.DBusNodeInfo.new_for_xml(SNI_XML).interfaces[0]
            menu_info = Gio.DBusNodeInfo.new_for_xml(DBUSMENU_XML).interfaces[0]

            self._sni_reg_id = self._bus.register_object(
                "/StatusNotifierItem",
                sni_info,
                self._on_sni_method,
                self._on_sni_get_prop,
                None,
            )
            self._menu_reg_id = self._bus.register_object(
                "/MenuBar",
                menu_info,
                self._on_menu_method,
                self._on_menu_get_prop,
                None,
            )

            self._bus_name_id = Gio.bus_own_name_on_connection(
                self._bus,
                self._service_name,
                Gio.BusNameOwnerFlags.NONE,
                self._on_name_acquired,
                None,
            )
        except Exception:
            # Non-GNOME / headless environments degrade gracefully.
            self._bus = None

    def _on_name_acquired(self, conn: Gio.DBusConnection, name: str) -> None:
        try:
            conn.call(
                "org.kde.StatusNotifierWatcher",
                "/StatusNotifierWatcher",
                "org.kde.StatusNotifierWatcher",
                "RegisterStatusNotifierItem",
                GLib.Variant("(s)", (name,)),
                None,
                Gio.DBusCallFlags.NONE,
                2000,
                None,
                None,
                None,
            )
        except Exception:
            pass

    def update(
        self,
        *,
        label: str,
        title: str = "Unravel",
        visible: bool | None = None,
        mini: bool | None = None,
        phase: str | None = None,
        can_break: bool | None = None,
    ) -> None:
        if self._bus is None:
            return
        label_changed = label != self._label
        self._label = label
        self._title = title

        menu_changed = False
        for k, v in (("visible", visible), ("mini", mini), ("phase", phase), ("can_break", can_break)):
            if v is not None and self._state[k] != v:
                self._state[k] = v
                menu_changed = True

        if label_changed:
            try:
                self._bus.emit_signal(
                    None,
                    "/StatusNotifierItem",
                    "org.kde.StatusNotifierItem",
                    "XAyatanaNewLabel",
                    GLib.Variant("(ss)", (self._label, "")),
                )
            except Exception:
                pass

        if menu_changed:
            self._revision += 1
            try:
                self._bus.emit_signal(
                    None,
                    "/MenuBar",
                    "com.canonical.dbusmenu",
                    "LayoutUpdated",
                    GLib.Variant("(ui)", (self._revision, 0)),
                )
            except Exception:
                pass

    def close(self) -> None:
        if self._bus is not None:
            if self._sni_reg_id is not None:
                self._bus.unregister_object(self._sni_reg_id)
            if self._menu_reg_id is not None:
                self._bus.unregister_object(self._menu_reg_id)
        if self._bus_name_id is not None:
            Gio.bus_unown_name(self._bus_name_id)
        self._bus = None

    # ---------------------------------------------------------------- SNI D-Bus

    def _on_sni_method(
        self,
        _conn: Gio.DBusConnection,
        _sender: str,
        _path: str,
        _iface: str,
        method: str,
        _params: GLib.Variant,
        invocation: Gio.DBusMethodInvocation,
    ) -> None:
        if method in ("Activate", "SecondaryActivate"):
            GLib.idle_add(self._callbacks[ITEM_TOGGLE_SHOW])
        invocation.return_value(None)

    def _on_sni_get_prop(
        self,
        _conn: Gio.DBusConnection,
        _sender: str,
        _path: str,
        _iface: str,
        prop: str,
    ) -> GLib.Variant | None:
        mapping: dict[str, GLib.Variant] = {
            "Category": GLib.Variant("s", "ApplicationStatus"),
            "Id": GLib.Variant("s", "unravel-desktop"),
            "Title": GLib.Variant("s", self._title),
            "Status": GLib.Variant("s", "Active"),
            "IconName": GLib.Variant("s", self._icon_name),
            "IconThemePath": GLib.Variant("s", self._icon_dir),
            "Menu": GLib.Variant("o", "/MenuBar"),
            "ItemIsMenu": GLib.Variant("b", False),
            "XAyatanaLabel": GLib.Variant("s", self._label),
            "XAyatanaLabelGuide": GLib.Variant("s", ""),
        }
        return mapping.get(prop)

    # ---------------------------------------------------------------- dbusmenu

    def _menu_items(self) -> list[tuple[int, dict[str, GLib.Variant]]]:
        phase = self._state["phase"]
        is_live = phase in ("RUNNING", "PAUSED")
        play_label = (
            "Pause"
            if phase == "RUNNING"
            else "Resume"
            if phase == "PAUSED"
            else "Start timer"
        )
        return [
            (
                ITEM_TOGGLE_SHOW,
                {"label": GLib.Variant("s", "Hide Unravel" if self._state["visible"] else "Show Unravel")},
            ),
            (
                ITEM_TOGGLE_MINI,
                {"label": GLib.Variant("s", "Exit Mini Mode" if self._state["mini"] else "Compact Mini Mode")},
            ),
            (ITEM_SEP_1, {"type": GLib.Variant("s", "separator")}),
            (ITEM_PLAY_PAUSE, {"label": GLib.Variant("s", play_label)}),
            (
                ITEM_TAKE_BREAK,
                {
                    "label": GLib.Variant("s", "Take break"),
                    "enabled": GLib.Variant("b", bool(self._state["can_break"])),
                    "visible": GLib.Variant("b", bool(self._state["can_break"])),
                },
            ),
            (
                ITEM_STOP,
                {
                    "label": GLib.Variant("s", "Stop & log session"),
                    "enabled": GLib.Variant("b", is_live),
                },
            ),
            (ITEM_SEP_2, {"type": GLib.Variant("s", "separator")}),
            (ITEM_QUIT, {"label": GLib.Variant("s", "Quit Unravel")}),
        ]

    def _build_layout_variant(self) -> GLib.Variant:
        children = [
            GLib.Variant("(ia{sv}av)", (item_id, props, []))
            for item_id, props in self._menu_items()
        ]
        root = (0, {"children-display": GLib.Variant("s", "submenu")}, children)
        return GLib.Variant("(u(ia{sv}av))", (self._revision, root))

    def _on_menu_method(
        self,
        _conn: Gio.DBusConnection,
        _sender: str,
        _path: str,
        _iface: str,
        method: str,
        params: GLib.Variant,
        invocation: Gio.DBusMethodInvocation,
    ) -> None:
        if method == "GetLayout":
            invocation.return_value(self._build_layout_variant())
        elif method == "GetGroupProperties":
            ids = set(params.unpack()[0])
            out = [(i, p) for i, p in self._menu_items() if i in ids]
            invocation.return_value(GLib.Variant("(a(ia{sv}))", (out,)))
        elif method == "GetProperty":
            item_id, prop_name = params.unpack()
            found = GLib.Variant("s", "")
            for i, p in self._menu_items():
                if i == item_id and prop_name in p:
                    found = p[prop_name]
                    break
            invocation.return_value(GLib.Variant("(v)", (found,)))
        elif method == "AboutToShow":
            invocation.return_value(GLib.Variant("(b)", (False,)))
        elif method == "Event":
            item_id, event_id, _data, _ts = params.unpack()
            if event_id == "clicked" and item_id in self._callbacks:
                GLib.idle_add(self._callbacks[item_id])
            invocation.return_value(None)
        elif method == "EventGroup":
            for item_id, event_id, _data, _ts in params.unpack()[0]:
                if event_id == "clicked" and item_id in self._callbacks:
                    GLib.idle_add(self._callbacks[item_id])
            invocation.return_value(GLib.Variant("(ai)", ([],)))
        else:
            invocation.return_value(None)

    def _on_menu_get_prop(
        self,
        _conn: Gio.DBusConnection,
        _sender: str,
        _path: str,
        _iface: str,
        prop: str,
    ) -> GLib.Variant | None:
        if prop == "Version":
            return GLib.Variant("u", 3)
        if prop == "TextDirection":
            return GLib.Variant("s", "ltr")
        if prop == "Status":
            return GLib.Variant("s", "normal")
        return None
