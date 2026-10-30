-- NostalgiaVue: anonymous shared channel stats. Tables are locked (RLS on, no policies);
-- the TV reaches them only through the nv_* functions below (via api/stats.js).
create table if not exists public.nv_live (
  id text primary key,
  ch int not null,
  seen timestamptz not null default now(),
  counted timestamptz not null default 'epoch'
);
create table if not exists public.nv_minutes (
  day date not null,
  ch int not null,
  cat text not null,
  mins int not null default 0,
  primary key (day, ch)
);
create table if not exists public.nv_seen (
  day date not null,
  id text not null,
  primary key (day, id)
);
create table if not exists public.nv_ratings (
  ch int not null,
  id text not null,
  stars int not null check (stars between 1 and 5),
  primary key (ch, id)
);
alter table public.nv_live enable row level security;
alter table public.nv_minutes enable row level security;
alter table public.nv_seen enable row level security;
alter table public.nv_ratings enable row level security;
create index if not exists nv_live_seen on public.nv_live (seen);

create or replace function public.nv_ok(p_id text, p_ch int) returns boolean
language sql immutable set search_path = public as $$
  select p_id ~ '^[a-z0-9]{8,40}$' and p_ch between 1 and 9999
$$;

-- a TV checking in: who's on what, plus one counted minute at most every 55 s
create or replace function public.nv_beat(p_id text, p_ch int, p_cat text) returns json
language plpgsql security definer set search_path = public as $$
declare
  last_counted timestamptz;
  n_here int; n_all int;
begin
  if not nv_ok(p_id, p_ch) or p_cat !~ '^[A-Z0-9 &''·+-]{1,24}$' then raise exception 'bad input'; end if;
  delete from nv_live where seen < now() - interval '150 seconds';
  select counted into last_counted from nv_live where id = p_id;
  insert into nv_live (id, ch, seen) values (p_id, p_ch, now())
    on conflict (id) do update set ch = excluded.ch, seen = now();
  if last_counted is null or last_counted < now() - interval '55 seconds' then
    update nv_live set counted = now() where id = p_id;
    insert into nv_minutes (day, ch, cat, mins) values (current_date, p_ch, p_cat, 1)
      on conflict (day, ch) do update set mins = nv_minutes.mins + 1, cat = excluded.cat;
    insert into nv_seen (day, id) values (current_date, p_id) on conflict do nothing;
  end if;
  select count(*) into n_here from nv_live where ch = p_ch;
  select count(*) into n_all from nv_live;
  return json_build_object('watching', n_here, 'total', n_all);
end $$;

create or replace function public.nv_leave(p_id text) returns void
language sql security definer set search_path = public as $$
  delete from nv_live where id = p_id
$$;

create or replace function public.nv_rate(p_id text, p_ch int, p_stars int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not nv_ok(p_id, p_ch) or p_stars not between 0 and 5 then raise exception 'bad input'; end if;
  if p_stars = 0 then delete from nv_ratings where ch = p_ch and id = p_id;
  else insert into nv_ratings (ch, id, stars) values (p_ch, p_id, p_stars)
         on conflict (ch, id) do update set stars = excluded.stars;
  end if;
end $$;

-- everything the Stats tab shows
create or replace function public.nv_summary() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'live', json_build_object(
      'total', (select count(*) from nv_live where seen >= now() - interval '150 seconds'),
      'by', coalesce((select json_object_agg(ch, n) from (select ch, count(*) n from nv_live where seen >= now() - interval '150 seconds' group by ch) x), '{}'::json)),
    'today', coalesce((select json_object_agg(ch, mins) from (select ch, mins from nv_minutes where day = current_date order by mins desc limit 50) x), '{}'::json),
    'all', coalesce((select json_object_agg(ch, m) from (select ch, sum(mins) m from nv_minutes group by ch order by m desc limit 50) x), '{}'::json),
    'cats', coalesce((select json_object_agg(cat, m) from (select cat, sum(mins) m from nv_minutes group by cat) x), '{}'::json),
    'ratings', coalesce((select json_object_agg(ch, json_build_object('avg', round(a, 1), 'n', n)) from (select ch, avg(stars) a, count(*) n from nv_ratings group by ch) x), '{}'::json),
    'tvsToday', (select count(*) from nv_seen where day = current_date)
  )
$$;

revoke all on function public.nv_beat(text, int, text), public.nv_leave(text), public.nv_rate(text, int, int), public.nv_summary() from public;
grant execute on function public.nv_beat(text, int, text), public.nv_leave(text), public.nv_rate(text, int, int), public.nv_summary() to anon, authenticated;
