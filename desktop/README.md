# Unravel Desktop Companion (Ubuntu)

A lightweight, native **Python 3 + GTK4 + Libadwaita** desktop app for Ubuntu 24.04 GNOME featuring Unravel's full Timer (Pomodoro, Pomodoro Flow, Timer, Recovery + synced settings), live GNOME top-bar countdown, compact Mini Mode, native Ubuntu notifications, and read-only 2-week Statistics.

## Security & Multi-User Sign-In

- **Zero database credentials** and **zero Clerk API keys** live inside this app.
- Any Unravel user can install and run it, click **Sign in with Unravel**, log into their own Clerk account in their browser, and receive a revocable personal token (`unr_...`) via a 60-second single-use PKCE code exchange.
- Every device can be revoked anytime from **Unravel → Settings → Desktop companion**.

## Install on Ubuntu 24.04

No `pip install`, no `apt install`, and no Rust/Electron toolchain needed — it runs directly on Ubuntu 24.04's built-in Python 3, GTK 4, Libadwaita, PipeWire, and GNOME AppIndicator D-Bus service.

```bash
chmod +x desktop/install-ubuntu.sh
./desktop/install-ubuntu.sh
```

Pass `--autostart` if you also want it to start quietly in the GNOME top bar on login (or toggle **Launch on login** anytime inside the app's Settings):

```bash
./desktop/install-ubuntu.sh --autostart
```

## Run directly without installing

```bash
PYTHONPATH=desktop python3 -m unravel_desktop
```

## Local Development Server

By default the app connects to `https://unravel-chi.vercel.app`. To test against a local Next.js dev server, expand **Manual token or custom server** on the Sign-In screen and set Server URL to `http://localhost:3000`.
