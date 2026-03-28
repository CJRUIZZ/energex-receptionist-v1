import { env } from '../lib/env.js';

const BLAND_BASE = 'https://api.bland.ai/v1';

function normalizePhonePath(phoneNumber) {
  return encodeURIComponent(String(phoneNumber || '').replace(/^\+/, ''));
}

async function blandRequest(path, options = {}) {
  if (!env.blandApiKey) {
    throw new Error('BLAND_API_KEY is not configured');
  }

  const response = await fetch(`${BLAND_BASE}${path}`, {
    ...options,
    headers: {
      authorization: env.blandApiKey,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 180);
      throw new Error(`Bland returned a non-JSON response (${response.status}). ${snippet}`);
    }
  }

  return { response, data };
}

async function blandFetch(path, options = {}) {
  const { response, data } = await blandRequest(path, options);

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Bland request failed (${response.status})`);
  }

  return data;
}

export async function purchaseBlandNumber(areaCode = '732') {
  const data = await blandFetch('/numbers/purchase', {
    method: 'POST',
    body: JSON.stringify({ area_code: areaCode, country_code: 'US' }),
  });

  return data.phone_number || data.data?.phone_number || null;
}

export async function listInboundNumbers() {
  const data = await blandFetch('/inbound', { method: 'GET' });
  return data.inbound_numbers || data.data?.inbound_numbers || [];
}

export async function listOutboundNumbers() {
  const data = await blandFetch('/outbound', { method: 'GET' });
  return data.outbound_numbers || data.data?.outbound_numbers || [];
}

export async function ensureInboundNumberIsConfigurable(phoneNumber) {
  const normalizedPhone = normalizePhonePath(phoneNumber);
  const { response, data } = await blandRequest(`/inbound/${normalizedPhone}`, { method: 'GET' });

  if (response.ok) {
    return data;
  }

  const inboundNumbers = await listInboundNumbers().catch(() => []);
  const outboundNumbers = await listOutboundNumbers().catch(() => []);
  const rawPhone = String(phoneNumber || '');
  const isInbound = inboundNumbers.some((entry) => entry.phone_number === rawPhone);
  const isOutbound = outboundNumbers.some((entry) => entry.phone_number === rawPhone);

  if (!isInbound && isOutbound) {
    throw new Error(`Configured Bland number ${rawPhone} exists in outbound numbers but not inbound numbers. Use an inbound Bland number for the receptionist.`);
  }

  if (!isInbound && !isOutbound) {
    throw new Error(`Configured Bland number ${rawPhone} was not found in this Bland account's inbound or outbound numbers.`);
  }

  throw new Error(data?.error || data?.message || `Bland inbound number lookup failed (${response.status})`);
}

export async function createKnowledgeBase({ name, description, text }) {
  const data = await blandFetch('/knowledge/learn', {
    method: 'POST',
    body: JSON.stringify({
      type: 'text',
      name,
      description,
      text,
    }),
  });

  return data.data?.id || data.id || null;
}

export async function updateKnowledgeBase(knowledgeBaseId, { name, description }) {
  const data = await blandFetch(`/knowledge/${knowledgeBaseId}`, {
    method: 'PUT',
    body: JSON.stringify({ name, description }),
  });

  return data.data || data;
}

export async function updateInboundNumberConfiguration({
  phoneNumber,
  objective,
  webhook,
  voiceId,
  transferList,
  tools,
}) {
  await ensureInboundNumberIsConfigurable(phoneNumber);
  const normalizedPhone = normalizePhonePath(phoneNumber);

  return blandFetch(`/inbound/${normalizedPhone}`, {
    method: 'POST',
    body: JSON.stringify({
      prompt: objective,
      webhook,
      voice: voiceId,
      first_sentence: objective.match(/Start with: "([^"]+)"/)?.[1] || undefined,
      transfer_list: Object.fromEntries(
        (transferList || []).map((entry) => [entry.name, entry.phone_number]).filter(([name, phone]) => name && phone)
      ),
      tools,
      record: true,
    }),
  });
}

export function createTicketTool() {
  return {
    name: 'createTicket',
    description: 'Create a support ticket when the caller needs a human follow-up.',
    parameters: {
      type: 'object',
      properties: {
        caller_phone: { type: 'string', description: 'Phone number of the caller' },
        summary: { type: 'string', description: 'One sentence summary of the caller issue' },
        urgency: { type: 'string', enum: ['Low', 'Medium', 'High'] },
      },
      required: ['summary', 'urgency'],
    },
  };
}

export function lookupCustomerTool(webhookUrl) {
  return {
    name: 'lookupCustomer',
    description: 'Look up a caller in the customer database to find their appointment information. Ask the caller for their name and use their phone number from caller ID. Use this when someone calls asking about their appointment or booking.',
    speech: 'Let me look that up for you.',
    url: webhookUrl,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    input_schema: {
      type: 'object',
      properties: {
        caller_name: { type: 'string', description: "The caller's full name as they stated it" },
        caller_phone: { type: 'string', description: "The caller's phone number from caller ID" },
      },
      required: ['caller_name', 'caller_phone'],
    },
  };
}
