# EnergeX Receptionist v1

Standalone React + Express app for launching and operating EnergeX AI receptionist clients before the product is merged into the main CRM.

## What it includes

- Multi-step onboarding wizard for new client businesses
- Supabase-backed normalized data model for orgs, agent profiles, knowledge, routing, phone config, calls, and tickets
- Bland provisioning/sync flow for inbound number configuration, webhook setup, prompt generation, and knowledge base attachment
- Twilio forwarding workflow tracking for existing business numbers
- Internal operations dashboard for tickets, call logs, metrics, provisioning state, and edit/resync actions

## Run locally

```bash
npm install
copy .env.example .env
# or: cp .env.example .env
npm run dev
```

Client: `http://localhost:5173`  
API: `http://localhost:3000`

## Environment

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `BLAND_API_KEY`
- `BLAND_DEFAULT_VOICE`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `APP_BASE_URL`

If Bland or Twilio credentials are missing, the app still works, but provisioning will surface `action_required` instead of silently failing.

## Database

Run [`db/schema.sql`](./db/schema.sql) in Supabase SQL Editor.
