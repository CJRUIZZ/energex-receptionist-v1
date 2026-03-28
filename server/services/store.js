import { supabase } from '../lib/supabase.js';
import { slugify } from '../lib/http.js';

function singleOrThrow(query, label) {
  return query.single().then(({ data, error }) => {
    if (error) throw new Error(`${label}: ${error.message}`);
    return data;
  });
}

export async function listOrgSummaries() {
  const { data: orgs, error } = await supabase
    .from('orgs')
    .select('id,name,slug,industry,onboarding_completed,updated_at')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`list orgs: ${error.message}`);
  if (!orgs?.length) return [];

  const [{ data: phones }, { data: agents }] = await Promise.all([
    supabase.from('phone_configs').select('org_id,activation_status,existing_number,bland_number,twilio_forward_number'),
    supabase.from('agent_instances').select('org_id,sync_status,last_sync_at,last_error'),
  ]);

  return orgs.map((org) => ({
    ...org,
    phoneConfig: phones?.find((entry) => entry.org_id === org.id) || null,
    agentInstance: agents?.find((entry) => entry.org_id === org.id) || null,
  }));
}

export async function getOrgBundle(orgId) {
  const [org, profile, knowledge, routing, phoneConfig, agentInstance] = await Promise.all([
    singleOrThrow(supabase.from('orgs').select('*').eq('id', orgId), 'get org'),
    supabase.from('agent_profiles').select('*').eq('org_id', orgId).single(),
    supabase.from('knowledge_entries').select('*').eq('org_id', orgId).order('sort_order', { ascending: true }),
    supabase.from('routing_rules').select('*').eq('org_id', orgId).order('sort_order', { ascending: true }),
    supabase.from('phone_configs').select('*').eq('org_id', orgId).maybeSingle(),
    supabase.from('agent_instances').select('*').eq('org_id', orgId).maybeSingle(),
  ]);

  if (profile.error && profile.error.code !== 'PGRST116') {
    throw new Error(`get profile: ${profile.error.message}`);
  }
  if (knowledge.error) throw new Error(`get knowledge: ${knowledge.error.message}`);
  if (routing.error) throw new Error(`get routing: ${routing.error.message}`);
  if (phoneConfig.error && phoneConfig.error.code !== 'PGRST116') {
    throw new Error(`get phone config: ${phoneConfig.error.message}`);
  }
  if (agentInstance.error && agentInstance.error.code !== 'PGRST116') {
    throw new Error(`get agent instance: ${agentInstance.error.message}`);
  }

  return {
    org,
    profile: profile.data || null,
    knowledgeEntries: knowledge.data || [],
    routingRules: routing.data || [],
    phoneConfig: phoneConfig.data || null,
    agentInstance: agentInstance.data || null,
  };
}

export async function upsertOrg(input) {
  const payload = {
    ...(input.id ? { id: input.id } : {}),
    name: input.name,
    slug: input.slug || slugify(input.name),
    industry: input.industry || null,
    website: input.website || null,
    contact_name: input.contactName || null,
    contact_email: input.contactEmail || null,
    contact_phone: input.contactPhone || null,
    business_phone: input.businessPhone || null,
    timezone: input.timezone || 'America/New_York',
    language: input.language || 'en',
    onboarding_completed: Boolean(input.onboardingCompleted),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('orgs').upsert(payload).select().single();
  if (error) throw new Error(`upsert org: ${error.message}`);
  return data;
}

export async function upsertAgentProfile(orgId, input) {
  const { data, error } = await supabase
    .from('agent_profiles')
    .upsert({
      org_id: orgId,
      voice_id: input.voiceId,
      greeting: input.greeting,
      business_summary: input.businessSummary,
      services: input.services,
      common_questions: input.commonQuestions,
      hours: input.hours,
      escalation_policy: input.escalationPolicy,
      notification_email: input.notificationEmail,
      notification_sms: input.notificationSms,
      sync_required: input.syncRequired ?? true,
      onboarding_answers: input.onboardingAnswers,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`upsert agent profile: ${error.message}`);
  return data;
}

export async function replaceKnowledgeEntries(orgId, entries) {
  const { error: deleteError } = await supabase.from('knowledge_entries').delete().eq('org_id', orgId);
  if (deleteError) throw new Error(`clear knowledge entries: ${deleteError.message}`);

  if (!entries.length) return [];

  const { data, error } = await supabase
    .from('knowledge_entries')
    .insert(
      entries.map((entry, index) => ({
        org_id: orgId,
        category: entry.category || 'general',
        question: entry.question,
        answer: entry.answer,
        source: entry.source || 'manual',
        sort_order: index,
        active: entry.active ?? true,
      }))
    )
    .select();

  if (error) throw new Error(`insert knowledge entries: ${error.message}`);
  return data;
}

export async function replaceRoutingRules(orgId, rules) {
  const { error: deleteError } = await supabase.from('routing_rules').delete().eq('org_id', orgId);
  if (deleteError) throw new Error(`clear routing rules: ${deleteError.message}`);

  if (!rules.length) return [];

  const { data, error } = await supabase
    .from('routing_rules')
    .insert(
      rules.map((rule, index) => ({
        org_id: orgId,
        department_name: rule.departmentName,
        transfer_number: rule.transferNumber,
        escalation_label: rule.escalationLabel || null,
        notes: rule.notes || null,
        sort_order: index,
        is_active: rule.isActive ?? true,
      }))
    )
    .select();

  if (error) throw new Error(`insert routing rules: ${error.message}`);
  return data;
}

export async function upsertPhoneConfig(orgId, input) {
  const { data, error } = await supabase
    .from('phone_configs')
    .upsert({
      org_id: orgId,
      existing_number: input.existingNumber || null,
      twilio_phone_sid: input.twilioPhoneSid || null,
      twilio_forward_number: input.twilioForwardNumber || null,
      bland_number: input.blandNumber || null,
      activation_status: input.activationStatus || 'draft',
      forwarding_mode: input.forwardingMode || 'twilio-forward',
      activation_notes: input.activationNotes || null,
      last_action_at: input.lastActionAt || null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`upsert phone config: ${error.message}`);
  return data;
}

export async function upsertAgentInstance(orgId, input) {
  const { data, error } = await supabase
    .from('agent_instances')
    .upsert({
      org_id: orgId,
      bland_phone_number: input.blandPhoneNumber || null,
      bland_knowledge_base_id: input.blandKnowledgeBaseId || null,
      bland_pathway_id: input.blandPathwayId || null,
      bland_webhook_url: input.blandWebhookUrl || null,
      sync_status: input.syncStatus || 'draft',
      last_sync_at: input.lastSyncAt || null,
      last_error: input.lastError || null,
      metadata: input.metadata || {},
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`upsert agent instance: ${error.message}`);
  return data;
}

export async function listTickets(orgId) {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`list tickets: ${error.message}`);
  return data || [];
}

export async function closeTicket(ticketId) {
  const { data, error } = await supabase
    .from('support_tickets')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .select()
    .single();

  if (error) throw new Error(`close ticket: ${error.message}`);
  return data;
}

export async function listCalls(orgId) {
  const { data, error } = await supabase
    .from('call_logs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`list calls: ${error.message}`);
  return data || [];
}

export async function upsertCallLog(payload) {
  const { data, error } = await supabase
    .from('call_logs')
    .upsert(payload, { onConflict: 'call_id' })
    .select()
    .single();

  if (error) throw new Error(`upsert call log: ${error.message}`);
  return data;
}

export async function createTicket(payload) {
  const { data, error } = await supabase
    .from('support_tickets')
    .upsert(
      {
        org_id: payload.orgId,
        call_id: payload.callId || null,
        caller_phone: payload.callerPhone || null,
        summary: payload.summary,
        urgency: payload.urgency || 'Medium',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'call_id' }
    )
    .select()
    .single();

  if (error) throw new Error(`create ticket: ${error.message}`);
  return data;
}

// ─── Customers ───────────────────────────────────────────────────

export async function lookupCustomer(orgId, { callerName, callerPhone }) {
  // Try phone match first (most reliable)
  if (callerPhone) {
    const normalized = String(callerPhone).replace(/\D/g, '').slice(-10);
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('org_id', orgId)
      .ilike('phone', `%${normalized}%`)
      .order('appointment_date', { ascending: true });

    if (data?.length) {
      const upcoming = data.find((c) => c.appointment_date && new Date(c.appointment_date) > new Date());
      return upcoming || data[0];
    }
  }

  // Fall back to name search
  if (callerName) {
    const parts = String(callerName).trim().split(/\s+/);
    let query = supabase.from('customers').select('*').eq('org_id', orgId);

    if (parts.length >= 2) {
      query = query.ilike('first_name', `%${parts[0]}%`).ilike('last_name', `%${parts[parts.length - 1]}%`);
    } else {
      query = query.or(`first_name.ilike.%${parts[0]}%,last_name.ilike.%${parts[0]}%`);
    }

    const { data } = await query.order('appointment_date', { ascending: true });

    if (data?.length) {
      const upcoming = data.find((c) => c.appointment_date && new Date(c.appointment_date) > new Date());
      return upcoming || data[0];
    }
  }

  return null;
}

export async function listCustomers(orgId) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('org_id', orgId)
    .order('appointment_date', { ascending: true });

  if (error) throw new Error(`list customers: ${error.message}`);
  return data || [];
}

export async function addCustomer(payload) {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      org_id: payload.orgId,
      first_name: payload.firstName,
      last_name: payload.lastName,
      phone: payload.phone,
      email: payload.email || null,
      appointment_date: payload.appointmentDate || null,
      appointment_type: payload.appointmentType || null,
      notes: payload.notes || null,
    })
    .select()
    .single();

  if (error) throw new Error(`add customer: ${error.message}`);
  return data;
}
