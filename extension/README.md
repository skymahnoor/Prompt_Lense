# 🛡️ PromptLens — PII Guard for AI Prompts (100% Local)

PromptLens sits between you and AI chat sites (ChatGPT, Claude, Gemini, Perplexity, DeepSeek, Copilot, Poe...). The moment you try to send a prompt containing **personally identifiable information (PII)**, it:

1. **Detects** — emails, phone numbers, credit cards (Luhn-validated), SSNs, CNIC/Aadhaar, IBANs, passports, API keys & secrets, IP addresses, names, addresses, dates of birth, ZIP codes
2. **Warns** — blocks the send and shows a card listing every item with its severity. *Nothing is sent yet.*
3. **Masks & replaces on acceptance** — click **Mask & send** and each item is replaced before the prompt reaches the AI (e.g. `sarah@gmail.com → [EMAIL_1]`). You can also **Send anyway** (logged as risky) or **Edit prompt**.
4. **Tracks locally** — every interception is logged in the built-in dashboard, stored only in your browser.

## 🔒 Privacy: your data never leaves your device

- **No server. No account. No telemetry. No network calls.** The extension has zero `fetch` calls and requests only the `storage` permission.
- Detection and masking run on-device, at send time, in your browser.
- Interception history is saved in `chrome.storage.local` — your browser profile's local storage. It is never transmitted anywhere, by anyone.
- Everything is deletable: **History → Clear local history**, or uninstall the extension.
- Optional **Export JSON** creates a file on your disk for backup — a file transfer you initiate, never a network transmission.

## Install (Chrome / Edge / Brave)

1. Download / unzip this folder (`promptlens-extension`).
2. Open `chrome://extensions` in your browser.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `extension` folder.
5. Pin **PromptLens** from the puzzle-piece menu.

## The dashboard

Click the PromptLens toolbar icon → **Open Dashboard**. That opens the extension's built-in dashboard (`dashboard.html`), which works fully offline and includes:

- **Overview** — intercepted prompts, PII masked, sent unmasked, warnings cancelled, protection rate, a 14-day activity chart, top PII types, severity mix and per-site breakdown.
- **History** — searchable table of every interception (site, what was detected, severity, action taken, masked preview).
- **Settings** — masking style, a detector playground, privacy details, and export/import of JSON snapshots.

## What's inside

| File | Purpose |
|------|---------|
| `manifest.json` | Manifest V3 config (permissions: `storage` only), content-script site matches |
| `lib/pii-engine.js` | Regex + heuristic PII detection & masking engine |
| `content.js` / `content.css` | Send interception, warning modal, live "N PII detected" pill, masking |
| `background.js` | Toolbar badge counter (no network code at all) |
| `popup.html/css/js` | Toolbar popup: toggle, today's stats, dashboard link, privacy badge |
| `dashboard.html/css/js` | Built-in local dashboard (overview, history, settings) |

## Masking styles (Settings tab)

- **Placeholders** — `sarah@gmail.com → [EMAIL_1]` *(default; best for the AI to understand structure)*
- **Partial** — `sarah@gmail.com → s•••@g•••.com`
- **Redacted** — `sarah@gmail.com → ████`

## Supported sites

chatgpt.com · chat.openai.com · claude.ai · gemini.google.com · aistudio.google.com · perplexity.ai · copilot.microsoft.com · chat.deepseek.com · chat.mistral.ai · poe.com · huggingface.co/chat

Add more by extending the `matches` array in `manifest.json` — the detection logic is site-agnostic.

## Troubleshooting

- **Mask & send didn't fire?** Some sites throttle rapid programmatic sends — click the send button once after masking; the prompt is already clean.
- **False positives?** A few formats (short digit runs) are intentionally flagged to stay safe — cancel the modal and rephrase if flagged wrongly.
- **Where is my data?** In your browser profile's local storage. Clear it anytime from the dashboard's History tab.
