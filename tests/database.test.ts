import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const userA = "10000000-0000-4000-8000-000000000001",
  userB = "20000000-0000-4000-8000-000000000002";
const sessionA = "a0000000-0000-4000-8000-000000000001",
  sessionB = "b0000000-0000-4000-8000-000000000002";
const db = new PGlite();
async function identity(uid: string, sid: string) {
  await db.exec(
    `reset role; select set_config('test.uid','${uid}',false); select set_config('test.sid','${sid}',false); set role authenticated;`,
  );
}
async function one(sql: string) {
  return (await db.query<Record<string, any>>(sql)).rows[0]!;
}
const migration = await readFile(
  new URL(
    "../supabase/migrations/202611170001_farm_records.sql",
    import.meta.url,
  ),
  "utf8",
);
test("PostgreSQL migration, tenant isolation, validation, concurrency and inactivity", async (t) => {
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('session_id',current_setting('test.sid',true)) $$;
    grant usage on schema auth,storage,public to authenticated,anon;grant execute on all functions in schema auth to authenticated,anon;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
    alter table storage.objects enable row level security;grant all on storage.objects to authenticated;`);
  await db.exec(migration);
  await db.exec(
    `insert into auth.users values('${userA}','{"farm_name":"Farm A"}'),('${userB}','{"farm_name":"Farm B"}');`,
  );
  await identity(userA, sessionA);
  await db.exec("select public.app_start_session();");
  const farmA = (await one("select id from public.app_farms")).id;
  await db.exec(
    `insert into storage.objects(bucket_id,name) values('farm-bird-photos','${farmA}/A/photo.jpg')`,
  );
  await db.exec(`insert into public.app_pens(id,name) values('P1','North');
    insert into public.app_birds(id,name,breed,bloodline,sex,color,"hatchDate",status,"penId") values
    ('A','Atlas','Chicken','A','Male','Red','2020-01-01','Active','P1'),
    ('B','Bella','Chicken','B','Female','White','2020-01-02','Brood','P1');
    insert into public.app_breeding(id,"sireId","damId","matingDate","eggsCount","hatchedCount") values('PAIR','A','B','2021-01-01',6,4);
    insert into public.app_birds(id,name,breed,bloodline,sex,color,"hatchDate",status,"sireId","damId","breedingId") values('C','Chick','Chicken','A/B','Male','Grey','2021-02-01','Active','A','B','PAIR');
    insert into public.app_supplies(id,name,category,quantity,unit,"reorderLevel") values('FEED','Feed','Feed',10,'kg',3);`);
  await db.exec("reset role");
  await db.exec(await readFile(
    new URL("../supabase/migrations/202611180002_poultry_flocks.sql", import.meta.url), "utf8",
  ));
  await identity(userA, sessionA);
  await t.test("flock migration preserves existing bird values and isolates farm membership", async () => {
    const before = await one(`select breed,bloodline,"flockId" from public.app_birds where id='A'`);
    assert.deepEqual(before, { breed: "Chicken", bloodline: "A", flockId: null });
    await db.exec(`insert into public.app_flocks(id,name) values('F1','Backyard')`);
    await assert.rejects(
      db.exec(`insert into public.app_flocks(id,name) values('DUP','backyard')`),
      /app_flocks_unique_name/,
    );
    await db.exec(`update public.app_birds set "flockId"='F1',bloodline='' where id='A'`);
    assert.deepEqual(
      await one(`select bloodline,"flockId" from public.app_birds where id='A'`),
      { bloodline: "", flockId: "F1" },
    );
    await identity(userB, sessionB);
    await db.exec("select public.app_start_session();");
    assert.equal((await one("select count(*)::int as n from public.app_flocks")).n, 0);
    await assert.rejects(
      db.exec(`insert into public.app_birds(id,name,breed,sex,color,"hatchDate",status,"flockId")
        values('FOREIGN','Test','Unknown','Male','White','2022-01-01','Active','F1')`),
      /app_birds_flock_fkey/,
    );
    await identity(userA, sessionA);
  });
  await db.exec("reset role");
  await db.exec(await readFile(
    new URL("../supabase/migrations/202611200003_flock_care_and_eggs.sql", import.meta.url), "utf8",
  ));
  await identity(userA, sessionA);
  await t.test("daily flock checks and egg totals are private and unique", async () => {
    await db.exec(`insert into public.app_flock_tasks(id,"flockId",name) values ('TASK','F1','Check water');
      insert into public.app_flock_checks(id,"taskId",date) values ('CHECK','TASK','2024-05-01');
      insert into public.app_egg_collections(id,"flockId",date,count) values ('EGG','F1','2024-05-01',0);`);
    await assert.rejects(
      db.exec(`insert into public.app_flock_checks(id,"taskId",date) values ('CHECK2','TASK','2024-05-01')`),
      /duplicate key/,
    );
    await assert.rejects(
      db.exec(`insert into public.app_egg_collections(id,"flockId",date,count) values ('EGG2','F1','2024-05-01',4)`),
      /duplicate key/,
    );
    await assert.rejects(
      db.exec(`update public.app_egg_collections set count=-1 where id='EGG'`),
      /check constraint/,
    );
    await db.exec(`update public.app_egg_collections set count=10,notes='Morning count' where id='EGG' and version=1`);
    assert.deepEqual(
      await one(`select count,version from public.app_egg_collections where id='EGG'`),
      { count: 10, version: 2 },
    );
    await identity(userB, sessionB);
    for (const table of ["app_flock_tasks", "app_flock_checks", "app_egg_collections"])
      assert.equal((await one(`select count(*)::int as n from public.${table}`)).n, 0);
    await assert.rejects(
      db.exec(`insert into public.app_flock_checks(id,"taskId",date) values ('OTHER','TASK','2024-05-01')`),
      /foreign key/,
    );
    await assert.rejects(
      db.exec(`insert into public.app_egg_collections(id,"flockId",date,count) values ('OTHER','F1','2024-05-01',9)`),
      /foreign key/,
    );
    await identity(userA, sessionA);
    await db.exec(`delete from public.app_flock_checks where id='CHECK' and version=1`);
    assert.equal((await one(`select count(*)::int as n from public.app_flock_checks`)).n, 0);
  });
  await t.test(
    "farm B cannot read/write farm A records or photos",
    async () => {
      await identity(userB, sessionB);
      await db.exec("select public.app_start_session();");
      assert.equal(
        (await one("select count(*)::int as n from public.app_birds")).n,
        0,
      );
      assert.equal(
        (await one("select count(*)::int as n from public.app_farms")).n,
        1,
      );
      assert.equal(
        (await one("select count(*)::int as n from storage.objects")).n,
        0,
      );
      await assert.rejects(
        db.exec(
          `insert into public.app_pens(id,farm_id,name) values('BAD','${farmA}','Intruder')`,
        ),
        /row-level security/,
      );
      await assert.rejects(
        db.exec(
          `insert into storage.objects(bucket_id,name) values('farm-bird-photos','${farmA}/A/pic.jpg')`,
        ),
        /row-level security/,
      );
      await assert.rejects(
        db.exec(
          `insert into public.app_birds(id,name,breed,bloodline,sex,color,"hatchDate",status,"sireId") values('BAD','X','Chicken','X','Male','White','2022-01-01','Active','A')`,
        ),
        /sire from your farm/,
      );
      await identity(userA, sessionA);
    },
  );
  await t.test("pedigree and hatch links enforce integrity", async () => {
    await assert.rejects(
      db.exec(`update public.app_birds set "sireId"='C' where id='A'`),
      /hatch before|cycle/,
    );
    await assert.rejects(
      db.exec(`update public.app_birds set sex='Female' where id='A'`),
      /conflicts with linked offspring/,
    );
    await assert.rejects(
      db.exec(
        `update public.app_breeding set "hatchedCount"=7 where id='PAIR'`,
      ),
      /check constraint/,
    );
    await assert.rejects(
      db.exec(`update public.app_birds set "damId"=null where id='C'`),
      /match the selected pairing/,
    );
    await db.exec(`update public.app_birds set "penId"=null where id='C'`);
  });
  await t.test(
    "stock deductions and care logging are atomic and reject overdrafts",
    async () => {
      const care = JSON.stringify({
        id: "H1",
        targetType: "pen",
        targetId: "P1",
        category: "Routine care",
        date: "2026-01-01",
        notes: "Routine pen care",
      });
      await db.query("select public.app_log_care($1::jsonb,$2,$3)", [
        care,
        "FEED",
        2.5,
      ]);
      // A retried form after a lost response must not deduct stock a second time.
      await db.query("select public.app_log_care($1::jsonb,$2,$3)", [
        care,
        "FEED",
        2.5,
      ]);
      assert.equal(
        Number(
          (
            await one(
              "select quantity from public.app_supplies where id='FEED'",
            )
          ).quantity,
        ),
        7.5,
      );
      await assert.rejects(
        db.query("select public.app_log_care($1::jsonb,$2,$3)", [
          JSON.stringify({ ...JSON.parse(care), id: "H2" }),
          "FEED",
          20,
        ]),
        /check constraint/,
      );
      assert.equal(
        (
          await one(
            "select count(*)::int as n from public.app_health where id='H2'",
          )
        ).n,
        0,
      );
      assert.equal(
        Number(
          (
            await one(
              "select quantity from public.app_supplies where id='FEED'",
            )
          ).quantity,
        ),
        7.5,
      );
      await assert.rejects(
        db.exec("delete from public.app_pens where id='P1'"),
        /care history/,
      );
      await Promise.all([
        db.exec("select public.app_adjust_supply('FEED',-1,'used')"),
        db.exec("select public.app_adjust_supply('FEED',-1,'used')"),
      ]);
      assert.equal(
        Number(
          (
            await one(
              "select quantity from public.app_supplies where id='FEED'",
            )
          ).quantity,
        ),
        5.5,
      );
      assert.equal(
        (
          await one(
            "select count(*)::int as n from public.app_supply_movements",
          )
        ).n,
        3,
      );
    },
  );
  await t.test("stale edits do not overwrite another device", async () => {
    const version = (
      await one("select version from public.app_birds where id='C'")
    ).version;
    await db.exec(
      `update public.app_birds set weight=1.2 where id='C' and version=${version}`,
    );
    const stale = await db.query(
      `update public.app_birds set weight=1.8 where id='C' and version=${version} returning id`,
    );
    assert.equal(stale.rows.length, 0);
    assert.equal(
      Number(
        (await one("select weight from public.app_birds where id='C'")).weight,
      ),
      1.2,
    );
  });
  await t.test(
    "AI request limits cannot be reset by deleting request records",
    async () => {
      for (let i = 0; i < 10; i++)
        await db.exec("select public.app_reserve_ai_request()");
      await assert.rejects(
        db.exec("select public.app_reserve_ai_request()"),
        /AI limit reached/,
      );
      await assert.rejects(
        db.exec("delete from public.app_ai_requests"),
        /permission denied/,
      );
    },
  );
  await t.test(
    "expired/revoked sessions cannot access rows or restart themselves",
    async () => {
      await db.exec(
        `reset role;update public.app_sessions set last_active=now()-interval '61 minutes' where id='${sessionA}';set role authenticated;`,
      );
      assert.equal(
        (await one("select count(*)::int as n from public.app_birds")).n,
        0,
      );
      await assert.rejects(
        db.exec("select public.app_start_session()"),
        /session expired/,
      );
      await assert.rejects(
        db.exec("select public.app_touch_session()"),
        /session expired/,
      );
      await identity(userB, sessionB);
      await db.exec("select public.app_end_session()");
      assert.equal((await one("select public.app_farm_id() as id")).id, null);
      await assert.rejects(
        db.exec("select public.app_start_session()"),
        /session expired/,
      );
    },
  );
  await db.close();
});
