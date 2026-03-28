# EnergeX AI Receptionist

A white-label AI receptionist platform. Clients sign up, fill out a form about their business, and get a live AI phone agent that answers calls, looks up customer appointments, routes to departments, and creates support tickets — all managed from a dashboard.

Built with React + Express + Supabase + Bland.ai.

## What it does

- **Onboarding wizard** — 8-step form (business info, hours, services, routing, notifications, FAQs, phone setup, review) that auto-generates a Bland AI agent
- **Customer lookup** — Bland calls your server mid-conversation to look up appointments by name + phone
- **Ticket creation** — when the AI can't resolve a caller's issue, it creates a ticket with summary and urgency
- **Notifications** — email (Resend) and SMS (Bland) alerts to the business owner when tickets are created
- **Operations dashboard** — provisioning status, tickets with close action, call logs with transcripts, Bland review scores, and metrics
- **Settings editor** — update hours, routing, FAQs, and escalation rules; changes sync to the live Bland agent
- **Twilio forwarding** — optional path for clients who want to keep their existing business number
- **Multi-org** — each client business is fully isolated by org_id with Supabase RLS

## Setup

### 1. Database
Run [`db/schema.sql`](./db/schema.sql) in your Supabase project's SQL Editor. Creates 9 tables with RLS.

### 2. Environment
Create a `.env` file in the project root:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
BLAND_API_KEY=your_bland_api_key
APP_BASE_URL=http://localhost:3000
PORT=3000

# Optional
BLAND_DEFAULT_VOICE=maya
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
RESEND_API_KEY=
RESEND_DOMAIN=resend.dev
```

### 3. Install and run
```bash
npm install
npm run dev
```

This starts both the Express API (port 3000) and the Vite React dev server (port 5173). The React app proxies API calls to the backend automatically.

### 4. Webhook setup (for testing)
```bash
ngrok http 3000
```
Set the Bland webhook to `https://YOUR-NGROK-URL/api/webhooks/bland`

Update `APP_BASE_URL` in `.env` to the ngrok URL so the customer lookup tool points to the right place.

## Project structure

```
energex-receptionist-v1/
│
├── src/                              ← React frontend (Vite)
│   ├── App.jsx                       App shell, routing, state management
│   ├── components/
│   │   ├── OnboardingWizard.jsx      8-step client onboarding form
│   │   └── OperationsDashboard.jsx   Tickets, calls, metrics, provisioning
│   ├── lib/
│   │   ├── api.js                    API client
│   │   ├── defaultState.js           Wizard state shape + step definitions
│   │   └── format.js                 Date, duration, review score helpers
│   ├── main.jsx                      Entry point
│   └── styles.css                    Full design system
│
├── server/                           ← Express backend
│   ├── index.js                      All routes (API, webhooks, tools, Twilio)
│   ├── lib/
│   │   ├── env.js                    Environment variable config
│   │   ├── http.js                   Response helpers, phone normalization
│   │   └── supabase.js               Supabase client
│   └── services/
│       ├── bland.js                  Bland API (numbers, KB, agent config, tools)
│       ├── notify.js                 Email + SMS notifications on new tickets
│       ├── provisioning.js           Onboarding → sync → Bland agent creation
│       ├── store.js                  All Supabase CRUD operations
│       └── twilio.js                 Twilio forwarding + TwiML
│
├── db/
│   └── schema.sql                    Full Supabase schema (9 tables + RLS)
│
├── index.html                        Vite entry
├── vite.config.js                    Vite + React + API proxy
└── package.json                      Scripts: dev, build, start
```

## API endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/orgs` | List all organizations |
| GET | `/api/orgs/:orgId` | Get full org bundle |
| POST | `/api/onboarding/submit` | Submit onboarding → create org + sync Bland |
| PUT | `/api/orgs/:orgId/config` | Update config → resync agent |
| POST | `/api/agents/:orgId/sync` | Force resync Bland agent |
| GET | `/api/dashboard/:orgId/tickets` | List tickets |
| POST | `/api/dashboard/tickets/:id/close` | Close a ticket |
| GET | `/api/dashboard/:orgId/calls` | List call logs |
| GET | `/api/dashboard/:orgId/metrics` | Dashboard metrics |
| GET | `/api/dashboard/:orgId/customers` | List customers |
| POST | `/api/dashboard/:orgId/customers` | Add a customer |
| POST | `/api/webhooks/bland` | Bland webhook — ingests calls + creates tickets |
| POST | `/tools/lookup-customer` | Bland calls mid-call to look up appointments |
| POST | `/api/twilio/voice/:orgId` | TwiML for Twilio forwarding |
| GET | `/health` | Health check |

## How it works

1. Client fills out the onboarding wizard
2. Backend saves to Supabase, then syncs to Bland — purchases a phone number, creates a knowledge base from the answers, configures the inbound agent with prompt + tools + webhook
3. Calls come in → Bland answers using the generated prompt and KB
4. Caller asks about their appointment → Bland hits `/tools/lookup-customer` → server queries Supabase → returns appointment info to the agent mid-call
5. Caller needs follow-up → agent triggers `createTicket` → webhook fires → ticket saved + business owner notified via email/SMS
6. Business owner views tickets, call logs, and metrics in the dashboard

## Deploy

Connect the repo to Railway or Render. Add all `.env` variables. Set `APP_BASE_URL` to your production URL. Update the Bland webhook from ngrok to the production URL.
