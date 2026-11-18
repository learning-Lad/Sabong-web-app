-- A separate web schema: does not replace the mobile app's existing tables.
begin;
create table public.app_farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120)
);
create table public.app_sessions (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  last_active timestamptz not null default now(), revoked boolean not null default false
);
create function public.app_register_farm() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.app_farms(owner_id, name) values(new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'farm_name'), ''), 'My Farm'),120));
  return new;
end $$;
create trigger app_register_farm after insert on auth.users for each row execute function public.app_register_farm();
-- Existing mobile users receive their own web workspace, never another user's records.
insert into public.app_farms(owner_id, name)
select id, left(coalesce(nullif(btrim(raw_user_meta_data->>'farm_name'), ''), 'My Farm'),120) from auth.users
on conflict(owner_id) do nothing;

create function public.app_start_session() returns void language plpgsql security definer set search_path = '' as $$
declare sid uuid := nullif(auth.jwt()->>'session_id','')::uuid; u uuid := auth.uid();
begin
  if u is null or sid is null then raise exception 'Sign in again.'; end if;
  insert into public.app_sessions(id,user_id) values(sid,u) on conflict(id) do nothing;
  if not exists(select 1 from public.app_sessions where id=sid and user_id=u and not revoked and last_active > now()-interval '60 minutes')
    then raise exception 'Your session expired. Sign in again.'; end if;
end $$;
create function public.app_touch_session() returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.app_sessions set last_active=now() where id=nullif(auth.jwt()->>'session_id','')::uuid
    and user_id=auth.uid() and not revoked and last_active > now()-interval '60 minutes';
  if not found then raise exception 'Your session expired. Sign in again.'; end if;
end $$;
create function public.app_end_session() returns void language sql security definer set search_path = '' as $$
  update public.app_sessions set revoked=true where id=nullif(auth.jwt()->>'session_id','')::uuid and user_id=auth.uid();
$$;
create function public.app_farm_id() returns uuid language sql stable security definer set search_path = '' as $$
  select f.id from public.app_farms f where f.owner_id=auth.uid() and exists(
    select 1 from public.app_sessions s where s.user_id=auth.uid() and s.id=nullif(auth.jwt()->>'session_id','')::uuid
      and not s.revoked and s.last_active > now()-interval '60 minutes');
$$;

create table public.app_pens (
  id text not null, farm_id uuid not null default public.app_farm_id() references public.app_farms(id) on delete cascade,
  name text not null check(length(btrim(name)) between 1 and 120), version integer not null default 1,
  primary key(farm_id,id), unique(farm_id,name)
);
create table public.app_birds (
  id text not null, farm_id uuid not null default public.app_farm_id() references public.app_farms(id) on delete cascade,
  name text not null check(length(btrim(name)) between 1 and 120), breed text not null,
  bloodline text not null check(length(btrim(bloodline)) > 0), sex text not null check(sex in ('Male','Female')),
  color text not null check(length(btrim(color)) > 0), "hatchDate" date not null check("hatchDate" <= (now() at time zone 'Asia/Manila')::date),
  weight numeric not null default 0 check(weight >= 0 and weight < 100),
  status text not null check(status in ('Active','Sold','Deceased','Brood')),
  "penId" text, "sireId" text, "damId" text, "breedingId" text,
  breeder text not null default '', "pedigreeNotes" text not null default '', "photoPath" text,
  version integer not null default 1, created_at timestamptz not null default now(),
  primary key(farm_id,id),
  foreign key(farm_id,"penId") references public.app_pens(farm_id,id),
  foreign key(farm_id,"sireId") references public.app_birds(farm_id,id),
  foreign key(farm_id,"damId") references public.app_birds(farm_id,id),
  check(id is distinct from "sireId" and id is distinct from "damId"),
  check("sireId" is null or "damId" is null or "sireId" <> "damId"),
  check("photoPath" is null or "photoPath" like farm_id::text || '/%')
);
create table public.app_breeding (
  id text not null, farm_id uuid not null default public.app_farm_id() references public.app_farms(id) on delete cascade,
  "sireId" text not null, "damId" text not null, "matingDate" date not null check("matingDate" <= (now() at time zone 'Asia/Manila')::date),
  "eggsCount" integer not null check("eggsCount" >= 0), "hatchedCount" integer not null check("hatchedCount" between 0 and "eggsCount"),
  notes text not null default '', version integer not null default 1, primary key(farm_id,id),
  foreign key(farm_id,"sireId") references public.app_birds(farm_id,id),
  foreign key(farm_id,"damId") references public.app_birds(farm_id,id), check("sireId" <> "damId")
);
alter table public.app_birds add foreign key(farm_id,"breedingId") references public.app_breeding(farm_id,id);
create table public.app_health (
  id text not null, farm_id uuid not null default public.app_farm_id() references public.app_farms(id) on delete cascade,
  "targetType" text not null check("targetType" in ('bird','pen')), "targetId" text not null,
  category text not null check(category in ('Vaccination','Vitamin','Medication','Routine care')),
  date date not null check(date <= (now() at time zone 'Asia/Manila')::date), notes text not null check(length(btrim(notes)) > 0),
  version integer not null default 1, primary key(farm_id,id)
);
create table public.app_reminders (
  id text not null, farm_id uuid not null default public.app_farm_id() references public.app_farms(id) on delete cascade,
  "birdId" text not null, description text not null check(length(btrim(description)) > 0), "dueDate" date not null,
  done boolean not null default false, version integer not null default 1, primary key(farm_id,id),
  foreign key(farm_id,"birdId") references public.app_birds(farm_id,id)
);
create table public.app_supplies (
  id text not null, farm_id uuid not null default public.app_farm_id() references public.app_farms(id) on delete cascade,
  name text not null check(length(btrim(name)) between 1 and 120),
  category text not null check(category in ('Feed','Vitamin','Medicine','Equipment')),
  quantity numeric not null check(quantity >= 0 and quantity < 1000000000),
  unit text not null check(length(btrim(unit)) between 1 and 30), "reorderLevel" numeric not null check("reorderLevel" >= 0 and "reorderLevel" < 1000000000),
  version integer not null default 1, primary key(farm_id,id)
);
create table public.app_supply_movements (
  id uuid primary key default gen_random_uuid(), farm_id uuid not null default public.app_farm_id() references public.app_farms(id) on delete cascade,
  supply_id text not null, delta numeric not null, note text not null, created_at timestamptz not null default now(),
  foreign key(farm_id,supply_id) references public.app_supplies(farm_id,id)
);
create table public.app_ai_requests (
  id uuid primary key default gen_random_uuid(), farm_id uuid not null default public.app_farm_id() references public.app_farms(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.app_ai_requests(farm_id,created_at);
create index on public.app_reminders(farm_id,done,"dueDate");
create index on public.app_health(farm_id,date);
create index on public.app_birds(farm_id,"sireId");
create index on public.app_birds(farm_id,"damId");

create function public.app_validate_relations() returns trigger language plpgsql set search_path = '' as $$
declare parent public.app_birds; pair public.app_breeding; linked text[]; f uuid := new.farm_id;
begin
  -- Serialize lineage writes per farm so simultaneous edits cannot create a cycle.
  perform pg_advisory_xact_lock(hashtextextended(f::text,0));
  if tg_table_name='app_health' then
    if new."targetType"='bird' and not exists(select 1 from public.app_birds where farm_id=f and id=new."targetId") then raise exception 'Choose a bird from your farm.'; end if;
    if new."targetType"='pen' and not exists(select 1 from public.app_pens where farm_id=f and id=new."targetId") then raise exception 'Choose a pen from your farm.'; end if;
  elsif tg_table_name in ('app_birds','app_breeding') then
    if new."sireId" is not null then
      select * into parent from public.app_birds where farm_id=f and id=new."sireId";
      if not found or parent.sex <> 'Male' then raise exception 'Choose a male sire from your farm.'; end if;
      if tg_table_name='app_birds' then
        if parent."hatchDate" >= new."hatchDate" then raise exception 'Parents must hatch before their offspring.'; end if;
      else
        if parent."hatchDate" > new."matingDate" then raise exception 'Parents must hatch before the mating date.'; end if;
        if tg_op='INSERT' then
          if parent.status not in ('Active','Brood') then raise exception 'Sire must be available on the mating date.'; end if;
        elsif new."sireId" is distinct from old."sireId" or new."matingDate" is distinct from old."matingDate" then
          if parent.status not in ('Active','Brood') then raise exception 'Sire must be available on the mating date.'; end if;
        end if;
      end if;
    end if;
    if new."damId" is not null then
      select * into parent from public.app_birds where farm_id=f and id=new."damId";
      if not found or parent.sex <> 'Female' then raise exception 'Choose a female dam from your farm.'; end if;
      if tg_table_name='app_birds' then
        if parent."hatchDate" >= new."hatchDate" then raise exception 'Parents must hatch before their offspring.'; end if;
      else
        if parent."hatchDate" > new."matingDate" then raise exception 'Parents must hatch before the mating date.'; end if;
        if tg_op='INSERT' then
          if parent.status not in ('Active','Brood') then raise exception 'Dam must be available on the mating date.'; end if;
        elsif new."damId" is distinct from old."damId" or new."matingDate" is distinct from old."matingDate" then
          if parent.status not in ('Active','Brood') then raise exception 'Dam must be available on the mating date.'; end if;
        end if;
      end if;
    end if;
    if tg_table_name='app_birds' then
      with recursive ancestors(id) as (
        select unnest(array[new."sireId",new."damId"])
        union select unnest(array[b."sireId",b."damId"]) from public.app_birds b join ancestors a on b.id=a.id where b.farm_id=f
      ) select array_agg(id) into linked from ancestors;
      if new.id=any(linked) then raise exception 'This parent link would create a pedigree cycle.'; end if;
      if exists(select 1 from public.app_birds b where b.farm_id=f and (b."sireId"=new.id or b."damId"=new.id)
          and (b."hatchDate" <= new."hatchDate" or (b."sireId"=new.id and new.sex <> 'Male') or (b."damId"=new.id and new.sex <> 'Female')))
        then raise exception 'This change conflicts with linked offspring.'; end if;
      if exists(select 1 from public.app_breeding b where b.farm_id=f and
          ((b."sireId"=new.id and new.sex <> 'Male') or (b."damId"=new.id and new.sex <> 'Female') or
           ((b."sireId"=new.id or b."damId"=new.id) and new."hatchDate">b."matingDate")))
        then raise exception 'This change conflicts with historical pairing records.'; end if;
      if new."breedingId" is not null then
        select * into pair from public.app_breeding where farm_id=f and id=new."breedingId";
        if not found or pair."sireId" is distinct from new."sireId" or pair."damId" is distinct from new."damId" or pair."matingDate">new."hatchDate"
          then raise exception 'Offspring must match the selected pairing and hatch after its mating date.'; end if;
      end if;
    elsif exists(select 1 from public.app_birds b where b.farm_id=f and b."breedingId"=new.id and
       (b."sireId" <> new."sireId" or b."damId" <> new."damId" or b."hatchDate" < new."matingDate")) then
      raise exception 'This pairing change conflicts with linked offspring.';
    end if;
  end if;
  return new;
end $$;
create trigger app_bird_relations before insert or update on public.app_birds for each row execute function public.app_validate_relations();
create trigger app_breeding_relations before insert or update on public.app_breeding for each row execute function public.app_validate_relations();
create trigger app_health_relations before insert or update on public.app_health for each row execute function public.app_validate_relations();
create function public.app_bump_version() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.farm_id <> old.farm_id then raise exception 'Record identity cannot change.'; end if;
  new.version := old.version+1; return new;
end $$;

create function public.app_guard_delete() returns trigger language plpgsql set search_path = '' as $$
begin
  if exists(select 1 from public.app_health where farm_id=old.farm_id and "targetId"=old.id
      and "targetType"=case when tg_table_name='app_birds' then 'bird' else 'pen' end)
    then raise exception 'This record has care history. Keep it for historical records.'; end if;
  return old;
end $$;
create trigger app_bird_delete before delete on public.app_birds for each row execute function public.app_guard_delete();
create trigger app_pen_delete before delete on public.app_pens for each row execute function public.app_guard_delete();

-- Atomic stock changes, with the same RLS as normal queries (security invoker).
create function public.app_adjust_supply(p_id text, p_delta numeric, p_note text default 'Stock adjustment')
returns public.app_supplies language plpgsql set search_path = '' as $$
declare result public.app_supplies;
begin
  if p_delta=0 or p_delta is null or abs(p_delta)>=1000000000 then raise exception 'Enter a valid non-zero stock change.'; end if;
  update public.app_supplies set quantity=quantity+p_delta where farm_id=public.app_farm_id() and id=p_id returning * into result;
  if not found then raise exception 'Supply not found or session expired.'; end if;
  insert into public.app_supply_movements(supply_id,delta,note) values(p_id,p_delta,left(p_note,500));
  return result;
end $$;
create function public.app_log_care(p_record jsonb, p_supply_id text default null, p_quantity numeric default 0)
returns public.app_health language plpgsql set search_path = '' as $$
declare result public.app_health; f uuid := public.app_farm_id();
begin
  -- A stable form ID makes retries safe when a successful response is lost.
  perform pg_advisory_xact_lock(hashtextextended(f::text || (p_record->>'id'),2));
  select * into result from public.app_health where farm_id=f and id=p_record->>'id';
  if found then
    if jsonb_build_object('id',result.id,'targetType',result."targetType",'targetId',result."targetId",'category',result.category,'date',result.date,'notes',result.notes) <> p_record
      then raise exception 'This care log already exists with different content. Refresh records.'; end if;
    return result;
  end if;
  if p_supply_id is not null then
    if p_quantity <= 0 or p_quantity is null then raise exception 'Enter the quantity used.'; end if;
    perform public.app_adjust_supply(p_supply_id,-p_quantity,'Care log ' || (p_record->>'id'));
  end if;
  insert into public.app_health(id,"targetType","targetId",category,date,notes)
  values(p_record->>'id',p_record->>'targetType',p_record->>'targetId',p_record->>'category',(p_record->>'date')::date,p_record->>'notes')
  returning * into result; return result;
end $$;
create function public.app_reserve_ai_request() returns void language plpgsql set search_path = '' as $$
declare f uuid := public.app_farm_id();
begin
  if f is null then raise exception 'Sign in again.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(f::text,1));
  if (select count(*) from public.app_ai_requests where farm_id=f and created_at>now()-interval '1 hour') >= 10
    then raise exception 'AI limit reached. Try again in an hour. Manual records are still available.'; end if;
  insert into public.app_ai_requests(farm_id) values(f);
end $$;

do $$ declare t text; begin
  foreach t in array array['app_pens','app_birds','app_breeding','app_health','app_reminders','app_supplies'] loop
    execute format('create trigger app_version before update on public.%I for each row execute function public.app_bump_version()',t);
  end loop;
  foreach t in array array['app_pens','app_birds','app_breeding','app_health','app_reminders','app_supplies','app_supply_movements','app_ai_requests'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy farm_scope on public.%I for all to authenticated using(farm_id=(select public.app_farm_id())) with check(farm_id=(select public.app_farm_id()))',t);
    execute format('grant select, insert, update, delete on public.%I to authenticated',t);
  end loop;
end $$;
alter table public.app_farms enable row level security;
alter table public.app_sessions enable row level security;
create policy farm_read on public.app_farms for select to authenticated using(id=(select public.app_farm_id()));
revoke all on public.app_farms from anon, authenticated;
grant select on public.app_farms to authenticated;
revoke all on public.app_sessions from anon,authenticated;
-- Enforce the AI rate limit even if the browser tries deleting its request records.
revoke all on public.app_ai_requests from authenticated;
grant select,insert on public.app_ai_requests to authenticated;
revoke update,delete on public.app_supply_movements from authenticated;
-- Limit function execution: no anonymous access and no implicit PUBLIC grants.
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on p.pronamespace=n.oid
    where n.nspname='public' and p.proname like 'app_%' loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
  end loop;
end $$;
grant execute on function public.app_start_session(),public.app_touch_session(),public.app_end_session(),public.app_farm_id(),public.app_adjust_supply(text,numeric,text),public.app_log_care(jsonb,text,numeric),public.app_reserve_ai_request() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('farm-bird-photos','farm-bird-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy app_photo_read on storage.objects for select to authenticated using(bucket_id='farm-bird-photos' and (storage.foldername(name))[1]=(select public.app_farm_id())::text);
create policy app_photo_insert on storage.objects for insert to authenticated with check(bucket_id='farm-bird-photos' and (storage.foldername(name))[1]=(select public.app_farm_id())::text);
create policy app_photo_delete on storage.objects for delete to authenticated using(bucket_id='farm-bird-photos' and (storage.foldername(name))[1]=(select public.app_farm_id())::text);
commit;
