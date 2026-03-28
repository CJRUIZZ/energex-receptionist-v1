import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './lib/env.js';
import { fail, ok } from './lib/http.js';
import {
  getOrgBundle,
  listCalls,
  listOrgSummaries,
  listTickets,
  closeTicket,
  lookupCustomer,
  listCustomers,
  addCustomer,
} from './services/store.js';
import { buildVoiceResponseXml } from './services/twilio.js';
import { getDashboardMetrics, ingestBlandWebhook, persistSubmission, syncOrg } from './services/provisioning.js';
import { supabase } from './lib/supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'dist');
const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => ok(res, { status: 'ok', time: new Date().toISOString() }));

app.get('/api/orgs', async (_req, res) => {
  try {
    ok(res, await listOrgSummaries());
  } catch (error) {
    fail(res, error.message);
  }
});

app.get('/api/orgs/:orgId', async (req, res) => {
  try {
    ok(res, await getOrgBundle(req.params.orgId));
  } catch (error) {
    fail(res, error.message, 404);
  }
});

app.post('/api/onboarding/submit', async (req, res) => {
  try {
    const org = await persistSubmission(req.body);
    const synced = await syncOrg(org.id);
    ok(res, synced, 201);
  } catch (error) {
    fail(res, error.message, 400);
  }
});

app.put('/api/orgs/:orgId/config', async (req, res) => {
  try {
    const org = await persistSubmission({ ...req.body, orgId: req.params.orgId });
    ok(res, await syncOrg(org.id));
  } catch (error) {
    fail(res, error.message, 400);
  }
});

app.post('/api/agents/:orgId/sync', async (req, res) => {
  try {
    ok(res, await syncOrg(req.params.orgId));
  } catch (error) {
    fail(res, error.message, 400);
  }
});

app.get('/api/dashboard/:orgId/tickets', async (req, res) => {
  try {
    ok(res, await listTickets(req.params.orgId));
  } catch (error) {
    fail(res, error.message, 400);
  }
});

app.post('/api/dashboard/tickets/:ticketId/close', async (req, res) => {
  try {
    ok(res, await closeTicket(req.params.ticketId));
  } catch (error) {
    fail(res, error.message, 400);
  }
});

app.get('/api/dashboard/:orgId/calls', async (req, res) => {
  try {
    ok(res, await listCalls(req.params.orgId));
  } catch (error) {
    fail(res, error.message, 400);
  }
});

app.get('/api/dashboard/:orgId/metrics', async (req, res) => {
  try {
    ok(res, await getDashboardMetrics(req.params.orgId));
  } catch (error) {
    fail(res, error.message, 400);
  }
});

app.post('/api/webhooks/bland', async (req, res) => {
  try {
    const result = await ingestBlandWebhook(req.body, async (phoneNumber) => {
      const { data } = await supabase.from('phone_configs').select('org_id').eq('bland_number', phoneNumber).maybeSingle();
      if (data?.org_id) {
        const bundle = await getOrgBundle(data.org_id);
        return bundle.org;
      }
      return null;
    });
    ok(res, result);
  } catch (error) {
    fail(res, error.message);
  }
});

app.post('/api/twilio/voice/:orgId', async (req, res) => {
  try {
    const bundle = await getOrgBundle(req.params.orgId);
    const blandNumber = bundle.phoneConfig?.bland_number || bundle.agentInstance?.bland_phone_number;

    if (!blandNumber) {
      res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>The EnergeX receptionist is not active yet.</Say></Response>');
      return;
    }

    res.type('text/xml').send(buildVoiceResponseXml(blandNumber));
  } catch (error) {
    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>${error.message}</Say></Response>`);
  }
});

// ─── Customer lookup (Bland calls this mid-call) ─────────────────
app.post('/tools/lookup-customer', async (req, res) => {
  try {
    const { caller_name, caller_phone } = req.body;
    const orgPhone = req.body.to || req.body.inbound_phone_number || req.body.org_phone;

    let org = null;
    if (orgPhone) {
      const { data } = await supabase.from('phone_configs').select('org_id').eq('bland_number', orgPhone).maybeSingle();
      if (data?.org_id) {
        const bundle = await getOrgBundle(data.org_id);
        org = bundle.org;
      }
    }

    // Fallback for single-org: grab the first org
    if (!org) {
      const { data } = await supabase.from('orgs').select('*').limit(1).maybeSingle();
      org = data;
    }

    if (!org) {
      return ok(res, { found: false, message: "I wasn't able to look that up right now. Let me create a ticket so someone can call you back." });
    }

    const customer = await lookupCustomer(org.id, { callerName: caller_name, callerPhone: caller_phone });

    if (!customer) {
      return ok(res, { found: false, message: "I don't see a record under that name and number. Would you like me to take a message so someone can follow up?" });
    }

    let appointmentInfo = 'No upcoming appointment on file.';
    if (customer.appointment_date) {
      const date = new Date(customer.appointment_date);
      const tz = org.timezone || 'America/New_York';
      const dateOpts = { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz };
      const timeOpts = { hour: 'numeric', minute: '2-digit', timeZone: tz };
      if (date > new Date()) {
        appointmentInfo = `${customer.appointment_type || 'Appointment'} on ${date.toLocaleDateString('en-US', dateOpts)} at ${date.toLocaleTimeString('en-US', timeOpts)}`;
      } else {
        appointmentInfo = 'No upcoming appointment — the last one was on ' + date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: tz });
      }
    }

    ok(res, {
      found: true,
      customer_name: `${customer.first_name} ${customer.last_name}`,
      appointment: appointmentInfo,
      notes: customer.notes || null,
    });
  } catch (error) {
    ok(res, { found: false, message: "I'm having trouble looking that up right now. Let me create a ticket so someone can help you." });
  }
});

// ─── Customer management API ─────────────────────────────────────
app.get('/api/dashboard/:orgId/customers', async (req, res) => {
  try {
    ok(res, await listCustomers(req.params.orgId));
  } catch (error) {
    fail(res, error.message, 400);
  }
});

app.post('/api/dashboard/:orgId/customers', async (req, res) => {
  try {
    ok(res, await addCustomer({ ...req.body, orgId: req.params.orgId }), 201);
  } catch (error) {
    fail(res, error.message, 400);
  }
});

app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'), (error) => {
      if (error) next();
    });
    return;
  }
  next();
});

app.listen(env.port, () => {
  console.log(`EnergeX Receptionist API running on http://localhost:${env.port}`);
});
