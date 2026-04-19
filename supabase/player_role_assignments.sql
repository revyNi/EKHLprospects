create table if not exists public.player_role_assignments (
  player_id uuid not null references public.players (id) on delete cascade,
  role_id uuid not null references public.player_roles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player_id, role_id)
);
