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
