alter table public.league_matches
add column if not exists status text not null default 'scheduled',
add column if not exists venue text,
add column if not exists attendance integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'league_matches_status_check'
  ) then
    alter table public.league_matches
    add constraint league_matches_status_check
    check (status in ('scheduled', 'live', 'final', 'postponed', 'cancelled'));
  end if;
end $$;

update public.league_matches
set status = case
  when home_score is not null and visiting_score is not null then 'final'
  else 'scheduled'
end
where status is null
   or status not in ('scheduled', 'live', 'final', 'postponed', 'cancelled');
