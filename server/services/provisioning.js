import { notifyTicketCreated } from './notify.js';
import { env } from '../lib/env.js';
import { normalizePhone, slugify, uniqueStrings } from '../lib/http.js';
import {
  createTicket,
  getOrgBundle,
  listCalls,
  listTickets,
  replaceKnowledgeEntries,
  replaceRoutingRules,
  upsertAgentInstance,
  upsertAgentProfile,
  upsertCallLog,
  upsertOrg,
  upsertPhoneConfig,
} from './store.js';
import {
  createKnowledgeBase,
  createTicketTool,
  lookupCustomerTool,
  purchaseBlandNumber,
  updateInboundNumberConfiguration,
} from './bland.js';
import { buildForwardingInstructions, configureTwilioForwarding } from './twilio.js';

function defaultGreeting(name) {
  return `Thanks for calling ${name}. How can I help you today?`;
}

export function normalizeSubmission(input) {
  const business = input.business || {};
  const notifications = input.notifications || {};
  const phoneSetup = input.phoneSetup || {};
  const faqs = (input.faqs || [])
    .map((entry) => ({
      category: entry.category || 'faq',
      question: String(entry.question || '').trim(),
      answer: String(entry.answer || '').trim(),
      source: entry.source || 'manual',
    }))
    .filter((entry) => entry.question && entry.answer);

  const commonQuestions = uniqueStrings(input.commonQuestions);
  const services = uniqueStrings(input.services);
  const routingRules = (input.routingRules || [])
    .map((rule) => ({
      departmentName: String(rule.departmentName || '').trim(),
      transferNumber: normalizePhone(rule.transferNumber),
      escalationLabel: rule.escalationLabel || '',
      notes: rule.notes || '',
      isActive: rule.isActive ?? true,
    }))
    .filter((rule) => rule.departmentName && rule.transferNumber);

  const hours = (input.hours || []).map((row) => ({
    day: row.day,
    opensAt: row.opensAt || '',
    closesAt: row.closesAt || '',
    closed: Boolean(row.closed),
  }));

  const businessName = String(business.name || '').trim();
  if (!businessName) throw new Error('Business name is required');

  return {
    orgId: input.orgId || null,
    business: {
      name: businessName,
      slug: slugify(businessName),
      industry: business.industry || '',
      website: business.website || '',
      contactName: business.contactName || '',
      contactEmail: business.contactEmail || '',
      contactPhone: normalizePhone(business.contactPhone),
      businessPhone: normalizePhone(phoneSetup.existingNumber || business.businessPhone),
      timezone: business.timezone || 'America/New_York',
      language: business.language || 'en',
      onboardingCompleted: true,
    },
    profile: {
      voiceId: business.voiceId || env.blandDefaultVoice,
      greeting: business.greeting || defaultGreeting(businessName),
      businessSummary: business.summary || '',
      services,
      commonQuestions,
      hours,
      escalationPolicy: input.escalationPolicy || 'Create a support ticket when a live transfer cannot solve the caller issue.',
      notificationEmail: notifications.email || '',
      notificationSms: normalizePhone(notifications.sms),
      syncRequired: true,
      onboardingAnswers: input,
    },
    knowledgeEntries: faqs,
    routingRules,
    phoneConfig: {
      existingNumber: normalizePhone(phoneSetup.existingNumber),
      twilioPhoneSid: phoneSetup.twilioPhoneSid || '',
      twilioForwardNumber: phoneSetup.twilioForwardNumber ? normalizePhone(phoneSetup.twilioForwardNumber) : '',
      blandAreaCode: phoneSetup.blandAreaCode || '732',
      forwardingMode: 'twilio-forward',
      activationStatus: 'draft',
    },
  };
}

export function buildKnowledgeText(bundle) {
  const { org, profile, knowledgeEntries, routingRules } = bundle;
  const onboardingAnswers = profile?.onboarding_answers || {};
  const hoursLines = (profile?.hours || [])
    .map((row) => (row.closed ? `${row.day}: Closed` : `${row.day}: ${row.opensAt} to ${row.closesAt}`))
    .join('\n');

  const serviceLines = (profile?.services || []).map((service) => `- ${service}`).join('\n');
  const callerIntentLines = (profile?.common_questions || []).map((question) => `- ${question}`).join('\n');
  const departmentLines = routingRules
    .map(
      (rule) =>
        `- ${rule.department_name}: ${rule.notes || 'Live transfer available.'}${rule.escalation_label ? ` Escalation label: ${rule.escalation_label}.` : ''}${rule.transfer_number ? ` Transfer number: ${rule.transfer_number}.` : ''}`
    )
    .join('\n');
  const faqLines = knowledgeEntries
    .map((entry) => `Q: ${entry.question}\nA: ${entry.answer}`)
    .join('\n\n');
  const contactLines = [
    org.website ? `Website: ${org.website}` : '',
    org.contact_name ? `Primary contact: ${org.contact_name}` : '',
    org.contact_email ? `Contact email: ${org.contact_email}` : '',
    org.contact_phone ? `Contact phone: ${org.contact_phone}` : '',
    org.business_phone ? `Business phone: ${org.business_phone}` : '',
    org.timezone ? `Timezone: ${org.timezone}` : '',
    org.language ? `Language: ${org.language}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return [
    `Business: ${org.name}`,
    org.industry ? `Industry: ${org.industry}` : '',
    profile?.business_summary ? `Summary: ${profile.business_summary}` : '',
    profile?.greeting ? `Greeting: ${profile.greeting}` : '',
    contactLines ? `Business details:\n${contactLines}` : '',
    hoursLines ? `Hours:\n${hoursLines}` : '',
    serviceLines ? `Services:\n${serviceLines}` : '',
    callerIntentLines ? `Common caller intents:\n${callerIntentLines}` : '',
    departmentLines ? `Departments:\n${departmentLines}` : '',
    profile?.escalation_policy ? `Escalation policy:\n${profile.escalation_policy}` : '',
    onboardingAnswers?.notifications?.email || onboardingAnswers?.notifications?.sms
      ? `Notification preferences:\n${[
          onboardingAnswers.notifications?.email ? `- Email: ${onboardingAnswers.notifications.email}` : '',
          onboardingAnswers.notifications?.sms ? `- SMS: ${onboardingAnswers.notifications.sms}` : '',
        ]
          .filter(Boolean)
          .join('\n')}`
      : '',
    faqLines ? `FAQs:\n${faqLines}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildObjective(bundle) {
  const { org, profile, routingRules } = bundle;
  const transferLines = routingRules.map((rule) => `${rule.department_name} at ${rule.transfer_number}`).join('; ');
  const serviceLines = (profile?.services || []).join(', ');
  const hoursSummary = (profile?.hours || [])
    .map((row) => (row.closed ? `${row.day} closed` : `${row.day} ${row.opensAt}-${row.closesAt}`))
    .join('; ');

  return [
    `You are the AI receptionist for ${org.name}.`,
    profile?.greeting ? `Start with: "${profile.greeting}"` : '',
    profile?.business_summary ? `Business summary: ${profile.business_summary}` : '',
    serviceLines ? `Services: ${serviceLines}.` : '',
    hoursSummary ? `Hours: ${hoursSummary}.` : '',
    `If a caller asks about their appointment or booking, use the lookupCustomer tool. Ask for their name and use their caller ID phone number.`,
    transferLines ? `Available live transfers: ${transferLines}.` : 'If no transfer is available, create a support ticket.',
    `If the caller needs a human follow-up, use the createTicket tool and include urgency.`,
    `Never invent policies that are not in the knowledge base.`,
  ]
    .filter(Boolean)
    .join(' ');
}

export async function persistSubmission(input) {
  const normalized = normalizeSubmission(input);
  const org = await upsertOrg({ ...normalized.business, id: normalized.orgId });

  await Promise.all([
    upsertAgentProfile(org.id, normalized.profile),
    replaceKnowledgeEntries(org.id, normalized.knowledgeEntries),
    replaceRoutingRules(org.id, normalized.routingRules),
    upsertPhoneConfig(org.id, normalized.phoneConfig),
    upsertAgentInstance(org.id, {
      syncStatus: 'draft',
      blandWebhookUrl: `${env.appBaseUrl}/api/webhooks/bland`,
      metadata: { crmReady: true },
    }),
  ]);

  return org;
}

export async function syncOrg(orgId) {
  const bundle = await getOrgBundle(orgId);
  let activationStatus = 'provisioning';
  let syncStatus = 'provisioning';
  let lastError = null;
  let blandNumber = bundle.phoneConfig?.bland_number || bundle.agentInstance?.bland_phone_number || '';
  let knowledgeBaseId = bundle.agentInstance?.bland_knowledge_base_id || '';

  try {
    if (!blandNumber) {
      blandNumber = await purchaseBlandNumber(bundle.phoneConfig?.bland_area_code || '732');
    }

    const knowledgeText = buildKnowledgeText(bundle);
    knowledgeBaseId = await createKnowledgeBase({
      name: `${bundle.org.name} knowledge`,
      description: 'EnergeX receptionist knowledge base',
      text: knowledgeText,
    });

    await updateInboundNumberConfiguration({
      phoneNumber: blandNumber,
      objective: buildObjective(bundle),
      webhook: `${env.appBaseUrl}/api/webhooks/bland`,
      voiceId: bundle.profile?.voice_id || env.blandDefaultVoice,
      transferList: bundle.routingRules.map((rule) => ({
        phone_number: rule.transfer_number,
        name: rule.department_name,
      })),
      tools: [knowledgeBaseId, createTicketTool(), lookupCustomerTool(`${env.appBaseUrl}/tools/lookup-customer`)],
    });

    const voiceUrl = `${env.appBaseUrl}/api/twilio/voice/${orgId}`;
    let activationNotes = '';
    let twilioForwardNumber = bundle.phoneConfig?.twilio_forward_number || '';

    if (bundle.phoneConfig?.twilio_phone_sid) {
      const twilioResult = await configureTwilioForwarding({
        phoneSid: bundle.phoneConfig.twilio_phone_sid,
        voiceUrl,
      });
      twilioForwardNumber = twilioResult.phoneNumber;
      activationStatus = 'live';
      activationNotes = `Twilio forwarding is active and dials ${blandNumber}.`;
    } else {
      activationStatus = 'action_required';
      activationNotes = buildForwardingInstructions({
        existingNumber: bundle.phoneConfig?.existing_number,
        blandNumber,
        voiceUrl,
        twilioPhoneSid: bundle.phoneConfig?.twilio_phone_sid,
      });
    }

    syncStatus = activationStatus === 'live' ? 'live' : 'action_required';

    await Promise.all([
      upsertPhoneConfig(orgId, {
        ...bundle.phoneConfig,
        blandNumber,
        twilioForwardNumber,
        activationStatus,
        activationNotes,
        lastActionAt: new Date().toISOString(),
      }),
      upsertAgentInstance(orgId, {
        ...bundle.agentInstance,
        blandPhoneNumber: blandNumber,
        blandKnowledgeBaseId: knowledgeBaseId,
        blandWebhookUrl: `${env.appBaseUrl}/api/webhooks/bland`,
        syncStatus,
        lastSyncAt: new Date().toISOString(),
        lastError: null,
        metadata: {
          ...(bundle.agentInstance?.metadata || {}),
          knowledgeLength: knowledgeText.length,
        },
      }),
      upsertAgentProfile(orgId, {
        ...bundle.profile,
        voiceId: bundle.profile?.voice_id || env.blandDefaultVoice,
        greeting: bundle.profile?.greeting || defaultGreeting(bundle.org.name),
        businessSummary: bundle.profile?.business_summary || '',
        services: bundle.profile?.services || [],
        commonQuestions: bundle.profile?.common_questions || [],
        hours: bundle.profile?.hours || [],
        escalationPolicy: bundle.profile?.escalation_policy || '',
        notificationEmail: bundle.profile?.notification_email || '',
        notificationSms: bundle.profile?.notification_sms || '',
        syncRequired: activationStatus !== 'live',
        onboardingAnswers: bundle.profile?.onboarding_answers || {},
      }),
    ]);
  } catch (error) {
    lastError = error.message;
    activationStatus = 'action_required';
    syncStatus = 'action_required';

    await Promise.all([
      upsertPhoneConfig(orgId, {
        ...bundle.phoneConfig,
        blandNumber,
        activationStatus,
        activationNotes: error.message,
        lastActionAt: new Date().toISOString(),
      }),
      upsertAgentInstance(orgId, {
        ...bundle.agentInstance,
        blandPhoneNumber: blandNumber,
        blandKnowledgeBaseId: knowledgeBaseId,
        blandWebhookUrl: `${env.appBaseUrl}/api/webhooks/bland`,
        syncStatus,
        lastSyncAt: new Date().toISOString(),
        lastError,
        metadata: bundle.agentInstance?.metadata || {},
      }),
    ]);
  }

  return getOrgBundle(orgId);
}

export async function getDashboardMetrics(orgId) {
  const [calls, tickets] = await Promise.all([listCalls(orgId), listTickets(orgId)]);
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const callsThisMonth = calls.filter((call) => new Date(call.created_at).getTime() >= monthAgo);
  const callsThisWeek = calls.filter((call) => new Date(call.created_at).getTime() >= weekAgo);
  const ticketsThisMonth = tickets.filter((ticket) => new Date(ticket.created_at).getTime() >= monthAgo);

  const durationAverage = callsThisMonth.length
    ? Math.round(callsThisMonth.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) / callsThisMonth.length)
    : 0;

  const scores = callsThisMonth
    .map((call) => call.bland_review?.score ?? call.bland_review?.overall_score ?? call.bland_review?.rating)
    .filter((value) => typeof value === 'number');

  return {
    counts: {
      callsThisWeek: callsThisWeek.length,
      callsThisMonth: callsThisMonth.length,
      openTickets: tickets.filter((ticket) => ticket.status === 'open').length,
      closedTickets: tickets.filter((ticket) => ticket.status === 'closed').length,
    },
    averages: {
      durationSeconds: durationAverage,
      reviewScore: scores.length ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(1)) : null,
      escalationRate: callsThisMonth.length ? Math.round((ticketsThisMonth.length / callsThisMonth.length) * 100) : 0,
    },
    recentReviews: calls
      .filter((call) => call.bland_review)
      .slice(0, 10)
      .map((call) => ({
        id: call.id,
        createdAt: call.created_at,
        durationSeconds: call.duration_seconds,
        review: call.bland_review,
      })),
  };
}

export function extractTicketFromWebhook(payload) {
  const toolCalls = payload.tool_calls || payload.tools || [];
  const ticketCall = toolCalls.find((call) => call.name === 'createTicket');
  if (!ticketCall) return null;
  const args = ticketCall.arguments || ticketCall.params || {};
  return {
    summary: args.summary || 'Follow-up required',
    urgency: ['Low', 'Medium', 'High'].includes(args.urgency) ? args.urgency : 'Medium',
    callerPhone: args.caller_phone || payload.from || payload.caller?.phone || '',
  };
}

export async function ingestBlandWebhook(payload, orgLookup) {
  const phoneNumber = payload.to || payload.inbound_phone_number || payload.phone_number;
  const org = await orgLookup(phoneNumber);
  if (!org) {
    return { received: true, skipped: true, reason: 'unknown_org' };
  }

  await createCallArtifacts(org.id, payload);
  return { received: true, orgId: org.id };
}

async function createCallArtifacts(orgId, payload) {
  await upsertCallLog({
    org_id: orgId,
    call_id: payload.call_id,
    caller_phone: payload.from || payload.caller?.phone || null,
    caller_name: payload.caller?.name || null,
    transcript: payload.concatenated_transcript || payload.transcript || '',
    duration_seconds: Math.round(payload.call_length || payload.duration || 0),
    outcome: payload.status || payload.disposition || 'completed',
    bland_review: payload.analysis || payload.review || null,
    raw_payload: payload,
  });

  const ticket = extractTicketFromWebhook(payload);
  if (ticket) {
    await createTicket({
      orgId,
      callId: payload.call_id,
      callerPhone: ticket.callerPhone,
      summary: ticket.summary,
      urgency: ticket.urgency,
    });

    // Send notifications to the business owner
    try {
      const bundle = await getOrgBundle(orgId);
      const email = bundle.profile?.notification_email;
      const sms = bundle.profile?.notification_sms;
      if (email || sms) {
        await notifyTicketCreated({
          email,
          sms,
          orgName: bundle.org.name,
          summary: ticket.summary,
          urgency: ticket.urgency,
          callerPhone: ticket.callerPhone,
        });
      }
    } catch (notifyErr) {
      console.error('Notification failed (ticket still created):', notifyErr.message);
    }
  }
}
