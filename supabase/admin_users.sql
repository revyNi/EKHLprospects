create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create policy "admins can view admin_users"
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id);

create policy "service role manages admin_users"
on public.admin_users
for all
to service_role
using (true)
with check (true);

-- Example: make one user an admin
-- insert into public.admin_users (user_id, email)
-- values ('YOUR_AUTH_USER_UUID_HERE', 'you@example.com');
