# TG-SignPulse

> A Telegram multi-account automation panel for check-ins, action workflows, and keyword monitoring.

[中文说明](README.md) · [Health Checks](#health-checks) · [Changelog](#changelog)

TG-SignPulse is a Telegram automation panel. It helps you manage multiple accounts, run auto check-in tasks, and monitor execution logs from a web UI.

> AI-powered: AI actions (vision/math) are integrated and can be used directly in task workflows.

## What Is This Project For?

- Manage multiple Telegram accounts in one place
- Automate check-ins, message sending, and button clicking
- Use AI actions for image recognition and math challenges
- View execution flow logs and recent bot replies
- Run check-ins inside specific Telegram group topics
- Use clipboard bulk task import/export, global proxy fallback, failure notifications, and keyword monitoring
- Run reliably on a VPS for long-term automation

## Highlights

- Multi-account management
- Action sequences: `Send Text`, `Click Text Button`, `Send Dice`, `AI Vision`, `AI Calculate`, `Keyword Monitor`
- Topic check-ins for specific Thread/Topic IDs in Telegram forum groups
- Task migration via clipboard export/import with duplicate skipping
- Telegram Bot notifications, keyword-match notifications, and pre-task invalid-session detection
- Visual logs with per-run flow details and latest bot replies
- Stability improvements for timeout/429 scenarios and long-running memory behavior
- Docker-first deployment (easy to start and migrate)

## Feature Map

| Area | Capability |
| --- | --- |
| Account management | Multi-account login, proxy settings, status checks, re-login |
| Task workflows | Fixed or random-range schedules, ordered actions, action interval |
| Topic support | Send and filter replies by Telegram group `Thread ID` |
| Keyword monitoring | Push matches via Telegram Bot, Forward, Bark, or custom URL |
| Operations | Docker deployment, persistent data directory, health checks, config import/export |

## Beginner Deployment (3 Steps)

1. Install Docker
2. Run the container command below
3. Open `http://YOUR_SERVER_IP:8080` in a browser and log in

Default credentials:
- Username: `admin`
- Password: `admin123`

### One-command Deploy

```bash
docker run -d \
  --name tg-signpulse \
  --restart unless-stopped \
  -p 8080:8080 \
  -v $(pwd)/data:/data \
  -e TZ=Asia/Shanghai \
  -e APP_SECRET_KEY=your_secret_key \
  ghcr.io/akasls/tg-signpulse:latest
```

If you use a reverse proxy, bind locally only:

```bash
-p 127.0.0.1:8080:8080
```

### Docker Compose (Optional)

```yaml
services:
  app:
    image: ghcr.io/akasls/tg-signpulse:latest
    container_name: tg-signpulse
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./data:/data
    environment:
      - TZ=Asia/Shanghai
      - APP_SECRET_KEY=your_secret_key
```

## Data Directory & Permissions

- Default data directory: `/data`
- If `/data` is not writable, app falls back to `/tmp/tg-signpulse` (non-persistent)
- New images can auto-adapt runtime UID/GID to `/data` owner in most VPS setups (usually no need for `chmod 777`)

Container checks:

```bash
id
ls -ld /data
touch /data/.probe && rm /data/.probe
```

## Common Environment Variables

- `APP_SECRET_KEY`: panel secret key (strongly recommended)
- `ADMIN_PASSWORD`: initial default password for the admin user (strongly recommended, otherwise defaults to insecure `admin123`)
- `APP_HOST`: API listening interface (defaults to `127.0.0.1` for security; use `0.0.0.0` if exposing container globally)
- `APP_DATA_DIR`: custom data directory (higher priority than panel setting)
- `TG_PROXY`: Telegram connection proxy; you can also configure a global proxy in the panel
- `TG_SESSION_MODE`: `file` (default) or `string` (recommended on arm64)
- `TG_SESSION_NO_UPDATES`: set `1` to enable `no_updates` (`string` mode only)
- `TG_GLOBAL_CONCURRENCY`: global concurrency limit (default `1`)
- `APP_TOTP_VALID_WINDOW`: panel 2FA tolerance window

## Custom Data Directory

You can set the data directory in two ways:

1. Panel: `System Settings -> Global Sign-in Settings -> Data Directory`
2. Env var: `APP_DATA_DIR=/your/path`

Notes:
- Restart backend service after changing it
- The path must be writable and mounted as persistent volume

## Local Development

- Python 3.12 is recommended; supported versions are Python `>=3.10,<3.14`
- Python 3.14 or newer is not recommended because the Telegram/Pydantic runtime dependencies are not fully compatible yet
- The frontend uses Node.js 20; run `npm ci` inside `frontend/`

## Common Panel Settings

In `System Settings -> Global Sign-in Settings`, you can configure:

- Global Proxy: used by login, chat refresh, and task execution when an account has no dedicated proxy
- Telegram Bot Notifications: set Bot Token and target Chat ID to receive failed-task, invalid-account-session, or keyword-match alerts
- Data Directory: stores sessions, logs, database, and task files

On the account task page, you can:

- Fill in `Topic / Thread ID` so a task only runs inside a specific Telegram group topic
- Add `Keyword Monitor` to an ordered action sequence, then choose Telegram Bot, Forward, Bark, or custom URL from the `Push Channel` dropdown
- Forward, Bark, and custom URL parameters are only shown after selecting the matching push channel
- Click the top-right export icon to copy all tasks of the current account to the clipboard
- Click the top-right paste/import action to bulk-import tasks from the clipboard while skipping duplicates

## Health Checks

- `GET /healthz`: quick health endpoint
- `GET /readyz`: readiness endpoint

## Project Structure

```text
backend/      FastAPI backend and scheduler
tg_signer/    Telegram automation core
frontend/     Next.js management panel
```

## Changelog

### 2026-05-12

- **Fix task execution 500 error**: A local `logger` assignment inside the `except` block of `run_task_with_logs` caused an `UnboundLocalError` throughout the function; the redundant assignment has been removed.
- **Range-mode catchup on task save**: Creating, editing, or re-enabling a range-mode task now immediately schedules a one-shot run if the current time falls within the window and the task has not run today.

### 2026-05-03

- **Keyword monitor stability fixes**: Background monitor now ensures the client runs with `no_updates=False` and rebuilds stale clients automatically; regex capture groups are now preferred as `{keyword}`, fixing redemption flows where callback confirmation was unavailable.
- **Button-click flow retries**: On button-click failure, the full task flow restarts from step 1 instead of sending button text as plain message; up to 3 retries by default (configurable via `SIGN_TASK_FLOW_RETRY_ATTEMPTS`).

### 2026-04-29

- **Keyword continue actions**: `Push Channel` now includes a `Continue Actions` option; matched messages can trigger an action sequence with variable support (`{keyword}`, `{message}`, `{sender}`, etc.).
- **Telegram Bot notification refactor**: Notifications split into a dedicated component with a master switch, login notification switch, and per-task failure notification control.
- **Scheduling compatibility fix**: Restored support for the older `signs/<task>/config.json` layout; fixed account cards stuck on "checking".

### 2026-04-28

- **Pre-task account status check**: Tasks now verify session validity before execution; invalid sessions are persisted and notified once without spamming repeated alerts.
- **Dashboard re-login flow**: Account cards now show `Session Invalid` directly; clicking opens the re-login dialog immediately.

### 2026-04-27

- **Keyword monitor as action**: Keyword monitoring is now an action in the ordered sequence, configurable per task, account, chat, and topic; push channel parameters are shown on demand.

### 2026-04-26

- **Telegram Topic (Thread) support**: Tasks can now run inside a specific group topic; messages are sent with `message_thread_id` and replies from other topics are filtered out.
- **Global proxy fallback and clipboard bulk import/export**: Accounts without a dedicated proxy fall back to the global proxy; tasks can be exported/imported via clipboard with automatic duplicate skipping.
- **Telegram Bot failure notifications**: Failed tasks push account, task, error, and recent log context to a configured Bot.

### 2026-03-20

- **SQLite deadlock fix**: Hardened the Pyrogram client lifecycle cache to eliminate `database is locked` errors under high concurrency.
- **Duplicate run prevention**: Clicking "Run" on an already-running task shows a warning and switches to the live log stream instead of triggering a second run.

### 2026-03-19

- **Account status display fix**: Fixed a frontend string-matching bug that incorrectly showed healthy accounts as invalid.
- **Old account PeerIdInvalid fix**: Fixed `.session` file accounts being forced into in-memory mode, causing `PeerIdInvalid` failures.

### 2026-03-12

- **Core stability fix**: Fixed async lock starvation and memory leaks caused by Pyrogram timeout and `FloodWait` infinite retry loops.

### 2026-03-06

- Action sequence order optimized; AI Vision/Calculate now support inline sub-modes; task copy opens a dialog with one-click copy; UTF-8 export fix for emoji content.

### 2026-03-01

- AI action upgrade; reduced `TimeoutError` / `429` log noise; long-running stability and memory improvements; added custom data directory support.

## Acknowledgements

This project is forked from [akasls/TG-SignPulse](https://github.com/akasls/TG-SignPulse), which itself is based on [amchii/tg-signer](https://github.com/amchii/tg-signer). Thanks to both authors for their open-source work.

Tech stack: FastAPI, Uvicorn, APScheduler, Pyrogram/Kurigram, Next.js, Tailwind CSS, OpenAI SDK.
