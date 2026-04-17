alter table public.league_standings
add column if not exists division text,
add column if not exists standing_tag text;
