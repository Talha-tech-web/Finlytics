<<<<<<< HEAD
# Finlytics — Personal Finance Dashboard

A single-user, multi-page finance app built in plain HTML, CSS, and JavaScript —
dashboard, transactions, an AI assistant, wallet (accounts/budgets/goals/recurring),
analytics, reports, and settings. Works fully offline on `localStorage`, with an
optional Supabase backend for persistence across devices, and an optional Groq-powered
AI assistant.
<img width="1912" height="911" alt="image" src="https://github.com/user-attachments/assets/d9bf00b8-1f26-41b2-a7aa-d87b52fd1e27" />
<img width="1920" height="917" alt="1" src="https://github.com/user-attachments/assets/0d39990d-6467-46a2-98df-048381fd9101" />

## Project structure

```
finlytics/
├── index.html            Dashboard
├── transactions.html      Transaction list, add/edit, CSV/Excel import
├── assistant.html          AI chat assistant (Ask AI)
├── wallet.html            Accounts, budgets, goals, recurring bills
├── analytics.html          Charts and breakdowns
├── reports.html           Printable / exportable reports
├── settings.html          Preferences + connection status (read-only)
├── css/
│   └── styles.css        All styling, incl. light/dark theme tokens
├── js/
│   ├── config.js         Supabase + AI keys (edit this file directly — see below)
│   ├── store.js          Single data layer: localStorage-first, Supabase-optional
│   ├── sync.js           Pushes/pulls data to Supabase when configured
│   ├── theme.js          Light/dark mode toggle (persisted)
│   ├── nav.js            Sidebar / topbar / active-page wiring
│   ├── charts.js         Chart.js chart builders
│   ├── dashboard.js      Dashboard page logic
│   ├── transactions.js   Transactions page logic
│   ├── import-parser.js  CSV / TSV / JSON / Excel import + column auto-mapping
│   ├── wallet.js         Accounts / budgets / goals / recurring logic
│   ├── analytics.js      Analytics page logic
│   ├── reports.js        Report generation + export
│   ├── assistant.js      Assistant page shell
│   ├── assistant-nlu.js  Rule-based natural-language understanding (fallback AI)
│   ├── assistant-persist.js  Saves assistant chat history
│   ├── assistant-import.js   Lets the assistant trigger imports
│   ├── chat-cleanup.js   Chat message maintenance/formatting helpers
│   ├── voice-engine.js   Speech-to-text (mic) and text-to-speech (replies)
│   ├── voice-popup.js    Voice input UI popup
│   └── settings.js       Settings page logic (read-only key display, toggles)
└── sql/
    └── schema.sql        Canonical Supabase/Postgres schema (accounts, transactions,
                           budgets, goals, recurring_items, saved_reports)
```

## Running it locally

double-click `index.html`. 

## Data storage: localStorage vs Supabase

By default the app stores everything in your browser's `localStorage` — no setup
required, works immediately, but stays on that one device/browser.

To sync to a real database instead:

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL editor in your Supabase project and run `sql/schema.sql` — this
   creates `accounts`, `transactions`, `budgets`, `goals`, `recurring_items`, and
   `saved_reports`, with basic row-level-security policies enabled (open policies,
   suitable for a single-user setup — tighten before sharing the app with others).
3. In your Supabase project settings, copy the **Project URL** and **anon public key**.
4. Open `js/config.js` and paste them into `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
5. Save the file and reload the app.

**Security note:** the Settings page only ever *displays* what's currently in
`js/config.js` (masked) — it never writes keys anywhere. The only way to set or
change a key is to edit `js/config.js` directly, by design.

## Enabling the AI assistant (optional)

The Assistant page works out of the box using a built-in rule-based engine
(`assistant-nlu.js`) — no key needed. To use a hosted LLM instead:

1. Get a free API key at [console.groq.com/keys](https://console.groq.com/keys).
2. In `js/config.js`, set `AI_API_KEY` to your key.

> **Heads-up:** `js/config.js` currently sets `AI_API_URL` to
> `https://api.openai.com/v1/chat/completions`, but `AI_MODEL` is set to a Groq
> model name (`llama-3.1-8b-instant`) and the key already in the file looks like a
> Groq key (`gsk_...`). OpenAI's endpoint won't recognize a Groq key or model, so
> as shipped the assistant will fail over to the rule-based engine. If you're using
> Groq, change `AI_API_URL` to `https://api.groq.com/openai/v1/chat/completions`.
> If you meant to use OpenAI instead, swap in an OpenAI key and model name
> (e.g. `gpt-4o-mini`) instead.

⚠️ The `AI_API_KEY` already present in `js/config.js` is a **live key** — treat this
zip like a secret. Don't commit it to a public repo or share the file as-is; rotate
the key at console.groq.com if it's ever been exposed.

## Importing transactions

Transactions page → **Import** → CSV, TSV, plain delimited TXT, JSON, or Excel
(`.xlsx`/`.xls`). `import-parser.js` auto-detects column headers (date, description,
amount, category, account), normalizes amounts and dates, prunes empty/junk columns,
and suggests categories for unmapped rows based on your existing categories. CSV/TSV/Excel
parsing depends on the Papa Parse and SheetJS libraries loading from CDN, so an
internet connection is needed the first time (browser then caches them).

## Data model

| Table              | Purpose                                              |
|---------------------|-------------------------------------------------------|
| `accounts`          | Cash, bank, credit card, savings — each with a balance |
| `transactions`      | Income/expense/transfer rows, linked to an account      |
| `budgets`            | Monthly limit per category                            |
| `goals`             | Savings goals with a target and current amount          |
| `recurring_items`   | Recurring bills/income (weekly/monthly/yearly)          |
| `saved_reports`     | Bookmarked assistant questions + their generated SQL   |

## Features

- Light/dark theme, persisted across reloads
- Responsive sidebar (desktop) / hamburger drawer (mobile)
- Dashboard: KPIs, charts, recent activity
- Transactions: add/edit/delete, filter/sort, CSV/Excel/JSON import, CSV export
- Wallet: accounts, budgets (with alerts), goals, recurring bills — each with edit/delete
- Analytics: category, account, and time-based breakdowns via Chart.js
- Assistant: chat-based Q&A over your data, with voice input/output, backed by an
  optional hosted LLM or the built-in rule-based engine
- Reports: printable/exportable summaries
- Settings: preferences, theme, voice options, and read-only connection status

## Notes

- Single-user app — no login/auth by design.
- Currency symbol is configurable via `CURRENCY` in `js/config.js` (default: `Rs`).
- All amounts are stored as signed numbers (positive = income, negative = expense).
=======
# Finlytics
Finlytics is a lightweight, single-user personal finance dashboard built with plain HTML, CSS, and JavaScript — track transactions, accounts, budgets, and goals, import bank statements via CSV/Excel, and get answers from an AI assistant, all with optional Supabase sync and full offline support via localStorage.
>>>>>>> 68c04ddff45efa413f61f961d6dd5643a2f29fa8
