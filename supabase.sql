create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('admin', 'vendedor', 'user')),
  created_at timestamptz not null default now()
);

create table if not exists public.properties (
  id text primary key,
  payload jsonb not null,
  owner_id uuid references public.profiles(id) on delete set null,
  owner_email text,
  status text not null default 'draft',
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_settings (
  id text primary key,
  scope text not null default 'global',
  owner_id uuid references public.profiles(id) on delete set null,
  profile text not null default 'balanced',
  config jsonb not null,
  health jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists properties_owner_id_idx on public.properties(owner_id);
create index if not exists properties_status_idx on public.properties(status);
create index if not exists ai_settings_scope_idx on public.ai_settings(scope);

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.ai_settings enable row level security;

-- The demo reads and writes through server.js using SUPABASE_SERVICE_ROLE_KEY.
-- Never expose the service role key in the frontend.
--
-- After creating the three Auth users in the Supabase dashboard, insert their
-- profiles using the UUID shown in Authentication > Users:
--
-- insert into public.profiles (id, email, role) values
--   ('PASTE_ADMIN_UUID', 'admin@admin.com', 'admin'),
--   ('PASTE_VENDEDOR_UUID', 'vendedor@vendedor.com', 'vendedor'),
--   ('PASTE_USER_UUID', 'user@user.com', 'user');

-- ============================================================
-- AI settings — server-side OpenRouter key + model routing
-- ============================================================
-- The admin sets the OpenRouter API key in the Admin IA panel; it is stored
-- here inside ai_settings.config (jsonb) and used for ALL visitors. The key and
-- any backup-provider keys live in the JSON, so no extra columns are needed.
-- This block is idempotent and safe to run on an existing database.

-- Backfill columns if an older ai_settings table predates them:
alter table public.ai_settings add column if not exists scope      text not null default 'global';
alter table public.ai_settings add column if not exists owner_id   uuid;
alter table public.ai_settings add column if not exists profile    text not null default 'balanced';
alter table public.ai_settings add column if not exists config     jsonb not null default '{}'::jsonb;
alter table public.ai_settings add column if not exists health     jsonb not null default '{}'::jsonb;
alter table public.ai_settings add column if not exists updated_at timestamptz not null default now();

-- SECURITY: config holds the plaintext OpenRouter key. RLS is enabled (above)
-- and there are intentionally NO anon/authenticated policies, so only the
-- server's service-role key (which bypasses RLS) can read or write it. The
-- public anon key cannot read the key. Do NOT add a SELECT policy here.

-- Seed the single global row (empty key; the admin fills it from the UI):
insert into public.ai_settings (id, scope, profile, config)
values ('global', 'global', 'balanced',
        '{"profile":"balanced","apiKey":"","backupProviders":[],"functions":{}}'::jsonb)
on conflict (id) do nothing;

-- Optional: verify RLS is on (rowsecurity should be true):
--   select relname, relrowsecurity from pg_class where relname = 'ai_settings';
