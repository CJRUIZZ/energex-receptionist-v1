create extension if not exists "uuid-ossp";

create table if not exists orgs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  industry text,
  website text,
  contact_name text,
  contact_email text,
  contact_phone text,
  business_phone text,
  timezone text default 'America/New_York',
  language text default 'en',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_profiles (
  org_id uuid primary key references orgs(id) on delete cascade,
  voice_id text default 'maya',
  greeting text not null,
  business_summary text,
  services jsonb not null default '[]'::jsonb,
  common_questions jsonb not null default '[]'::jsonb,
  hours jsonb not null default '[]'::jsonb,
  escalation_policy text,
  notification_email text,
  notification_sms text,
  sync_required boolean not null default true,
  onboarding_answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_entries (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  category text default 'general',
  question text not null,
  answer text not null,
  source text not null default 'manual',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_org on knowledge_entries(org_id, sort_order);

create table if not exists routing_rules (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  department_name text not null,
  transfer_number text not null,
  escalation_label text,
  notes text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_routing_org on routing_rules(org_id, sort_order);

create table if not exists phone_configs (
  org_id uuid primary key references orgs(id) on delete cascade,
  existing_number text,
  twilio_phone_sid text,
  twilio_forward_number text,
  bland_number text,
  activation_status text not null default 'draft'
    check (activation_status in ('draft', 'provisioning', 'live', 'action_required')),
  forwarding_mode text not null default 'twilio-forward'
    check (forwarding_mode in ('twilio-forward', 'manual-forward', 'unknown')),
  activation_notes text,
  last_action_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_instances (
  org_id uuid primary key references orgs(id) on delete cascade,
  bland_phone_number text,
  bland_knowledge_base_id text,
  bland_pathway_id text,
  bland_webhook_url text,
  sync_status text not null default 'draft'
    check (sync_status in ('draft', 'provisioning', 'live', 'action_required')),
  last_sync_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text,
  appointment_date timestamptz,
  appointment_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customers_org on customers(org_id);
create index if not exists idx_customers_phone on customers(org_id, phone);

create table if not exists call_logs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  call_id text not null unique,
  caller_phone text,
  caller_name text,
  transcript text,
  duration_seconds integer not null default 0,
  outcome text,
  bland_review jsonb,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_calls_org_created on call_logs(org_id, created_at desc);

create table if not exists support_tickets (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  call_id text unique,
  caller_phone text,
  summary text not null,
  urgency text not null default 'Medium'
    check (urgency in ('Low', 'Medium', 'High')),
  status text not null default 'open'
    check (status in ('open', 'closed')),
  resolution_notes text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tickets_org_created on support_tickets(org_id, created_at desc);

alter table orgs enable row level security;
alter table agent_profiles enable row level security;
alter table knowledge_entries enable row level security;
alter table routing_rules enable row level security;
alter table phone_configs enable row level security;
alter table agent_instances enable row level security;
alter table customers enable row level security;
alter table call_logs enable row level security;
alter table support_tickets enable row level security;

create policy "service role full access orgs" on orgs for all using (true) with check (true);
create policy "service role full access profiles" on agent_profiles for all using (true) with check (true);
create policy "service role full access knowledge" on knowledge_entries for all using (true) with check (true);
create policy "service role full access routing" on routing_rules for all using (true) with check (true);
create policy "service role full access phones" on phone_configs for all using (true) with check (true);
create policy "service role full access instances" on agent_instances for all using (true) with check (true);
create policy "service role full access customers" on customers for all using (true) with check (true);
create policy "service role full access calls" on call_logs for all using (true) with check (true);
create policy "service role full access tickets" on support_tickets for all using (true) with check (true);
