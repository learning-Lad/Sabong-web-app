begin;

create table public.app_flock_tasks (
  farm_id uuid not null default public.app_farm_id() references public.app_farms(id) on delete cascade,
  id text not null,
  "flockId" text not null,
  name text not null check (length(btrim(name)) between 1 and 120),
  version integer not null default 1,
  primary key (farm_id, id),
  foreign key (farm_id, "flockId") references public.app_flocks(farm_id, id)
);
create unique index app_flock_tasks_name_idx
  on public.app_flock_tasks (farm_id, "flockId", lower(btrim(name)));

create table public.app_flock_checks (
  farm_id uuid not null default public.app_farm_id() references public.app_farms(id) on delete cascade,
  id text not null,
  "taskId" text not null,
  date date not null check (date <= (now() at time zone 'Asia/Manila')::date),
  version integer not null default 1,
  primary key (farm_id, id),
  unique (farm_id, "taskId", date),
  foreign key (farm_id, "taskId") references public.app_flock_tasks(farm_id, id)
);

create table public.app_egg_collections (
  farm_id uuid not null default public.app_farm_id() references public.app_farms(id) on delete cascade,
  id text not null,
  "flockId" text not null,
  date date not null check (date <= (now() at time zone 'Asia/Manila')::date),
  count integer not null check (count between 0 and 100000),
  notes text not null default '' check (length(notes) <= 500),
  version integer not null default 1,
  primary key (farm_id, id),
  unique (farm_id, "flockId", date),
  foreign key (farm_id, "flockId") references public.app_flocks(farm_id, id)
);

do $$
declare table_name text;
begin
  foreach table_name in array array['app_flock_tasks', 'app_flock_checks', 'app_egg_collections'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy farm_scope on public.%I for all to authenticated using (farm_id=(select public.app_farm_id())) with check (farm_id=(select public.app_farm_id()))', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select, insert on public.%I to authenticated', table_name);
  end loop;
end $$;

grant delete on public.app_flock_checks to authenticated;
grant update (count, notes) on public.app_egg_collections to authenticated;
create trigger app_version before update on public.app_egg_collections
  for each row execute function public.app_bump_version();

commit;
