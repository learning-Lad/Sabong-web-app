begin;

create table public.app_flocks (
  id text not null,
  farm_id uuid not null default public.app_farm_id() references public.app_farms(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  version integer not null default 1,
  primary key (farm_id, id)
);
create unique index app_flocks_unique_name on public.app_flocks(farm_id, lower(btrim(name)));

alter table public.app_flocks enable row level security;
create policy farm_scope on public.app_flocks for all to authenticated
  using (farm_id = (select public.app_farm_id()))
  with check (farm_id = (select public.app_farm_id()));
revoke all on public.app_flocks from anon, authenticated;
grant select, insert, update on public.app_flocks to authenticated;
create trigger app_version before update on public.app_flocks
  for each row execute function public.app_bump_version();

alter table public.app_birds
  drop constraint app_birds_bloodline_check,
  alter column bloodline set default '',
  add column "flockId" text,
  add constraint app_birds_flock_fkey foreign key(farm_id, "flockId")
    references public.app_flocks(farm_id, id);

create index app_birds_flock_idx on public.app_birds(farm_id, "flockId");

commit;
