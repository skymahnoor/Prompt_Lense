# 🛡️ PromptLens — PII Guard for AI Prompts

PromptLens is a **100% local, privacy-first** Chrome extension (Manifest V3) plus an optional local dashboard viewer. The moment you try to send a prompt containing **personally identifiable information (PII)** to an AI chat (ChatGPT, Claude, Gemini, Perplexity, DeepSeek, Copilot, Poe, HuggingChat…), PromptLens:

1. **Detects** — emails, phone numbers, credit cards (Luhn-validated), SSNs, CNIC/Aadhaar, IBANs, passports, API keys & secrets, IP addresses, names, addresses, dates of birth and ZIP codes.
2. **Warns** — blocks the send and shows a modal listing every detected item with its severity. *Nothing has been sent yet.*
3. **Masks & replaces on acceptance** — click **Mask & send** and each item is replaced before the prompt reaches the AI (e.g. `sarah@gmail.com → [EMAIL_1]`). You can also **Send anyway** (logged as risky) or **Cancel**.
4. **Tracks locally** — every interception is logged in the built-in dashboard, stored only in your browser.

## 🔒 Privacy: your data never leaves your device

- **No server. No account. No telemetry. No network calls.** The extension makes zero `fetch` calls and requests only the `storage` permission.
- Detection and masking run **on-device, at send time**, inside your browser.
- Interception history lives in `chrome.storage.local` (capped at 1000 events) — never transmitted anywhere.
- Everything is deletable: **History → Clear local history**, or uninstall the extension.

## 📦 Repo structure

```
extension/          Chrome MV3 extension (the core product)
  manifest.json     permissions: ["storage"] only
  content.js        send-interception, warning modal, masking
  background.js     service worker — badge counter only
  popup.*           quick toggle + today's stats
  dashboard.*       built-in tracking dashboard (trend, types, severity, history, export/import)
  lib/pii-engine.js standalone 14-detector PII engine (UMD, no deps)
src/                Optional Next.js 15 dashboard viewer (imports the extension's JSON export)
prisma/             SQLite schema for the viewer
scripts/            PII engine test suite
public/pl-demo.html Interactive demo page of the warning flow
```

## 🚀 Install the extension (Chrome / Edge / Brave)

1. Download/clone this repo.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** → select the `extension/` folder.
4. Visit any supported AI site and try sending a prompt with your email or CNIC — PromptLens will intercept it.

## 🖥️ Optional: local dashboard viewer

The extension's built-in dashboard (`extension/dashboard.html`, opened from the popup) is the primary tracking UI. This web app is an **optional** viewer for a bigger screen — you manually import the JSON file you exported from the extension:

```bash
bun install
bun run db:push      # creates local SQLite db
bun run dev          # http://localhost:3000
```

Then on the web dashboard: **Settings → Import JSON** → pick the file exported from the extension. Import is one-way and manual; the app never connects to your browser or any server.

## 🧪 Run the PII engine tests

```bash
node scripts/test-pii-engine.js
```

## 🛠️ Tech stack

- **Extension:** vanilla JS (MV3), Shadow-DOM modal, zero dependencies, zero network
- **Viewer:** Next.js 15 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, Prisma + SQLite, Recharts

## 📄 License

MIT — see [LICENSE](LICENSE).
