import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("políticas do banco: autorização, autoria, concorrência e auditoria", async (t) => {
  const db = new PGlite();
  const alice = "10000000-0000-4000-8000-000000000001";
  const bob = "10000000-0000-4000-8000-000000000002";
  const gestor = "10000000-0000-4000-8000-000000000003";
  const blocked = "10000000-0000-4000-8000-000000000004";
  let familyId = "";
  const insert = `insert into public.familias(responsavel,pessoas,bairro,endereco,latitude,longitude,tipo_risco,nivel_risco)
    values ('Família fictícia de teste',4,'Centro','Rua de teste, 10',-7.56,-35.002,'inundacao','alto') returning id,versao,criado_por`;
  async function asUser(id: string) {
    await db.exec(
      `reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`,
    );
  }
  try {
    // Somente o adaptador de Auth é simulado. Tabelas, triggers e RLS são os do arquivo entregue.
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public,auth to anon,authenticated;
      grant execute on function auth.uid() to anon,authenticated;`);
    await db.exec(readFileSync("supabase/001_initial.sql", "utf8"));
    await db.exec(`insert into auth.users(id) values ('${alice}'),('${bob}'),('${gestor}'),('${blocked}');
      insert into public.agentes(id,nome,papel,ativo) values
        ('${alice}','Agente A','agente',true),('${bob}','Agente B','agente',true),
        ('${gestor}','Gestor','gestor',true),('${blocked}','Conta inativa','agente',false);`);

    await t.test("anônimo não consegue consultar o cadastro", async () => {
      await db.exec("set role anon");
      await assert.rejects(
        db.query("select * from public.familias"),
        /permission denied/,
      );
    });
    await t.test(
      "agente ativo cadastra com sua autoria e versão inicial",
      async () => {
        await asUser(alice);
        const result = await db.query<{
          id: string;
          versao: number;
          criado_por: string;
        }>(insert);
        familyId = result.rows[0].id;
        assert.equal(result.rows[0].criado_por, alice);
        assert.equal(result.rows[0].versao, 1);
      },
    );
    await t.test(
      "outro agente vê a família, mas não consegue alterá-la",
      async () => {
        await asUser(bob);
        assert.equal(
          (await db.query("select id from public.familias")).rows.length,
          1,
        );
        assert.equal(
          (
            await db.query(
              `update public.familias set pessoas=8 where id=$1 returning id`,
              [familyId],
            )
          ).rows.length,
          0,
        );
      },
    );
    await t.test(
      "não é possível forjar autoria ou conceder a si mesmo papel de gestor",
      async () => {
        await assert.rejects(
          db.query(
            `insert into public.familias(responsavel,pessoas,bairro,endereco,latitude,longitude,tipo_risco,nivel_risco,criado_por)
        values ('Fictício',2,'Centro','Rua teste',-7.56,-35.002,'inundacao','alto',$1)`,
            [alice],
          ),
          /row-level security/,
        );
        await assert.rejects(
          db.query(`update public.agentes set papel='gestor' where id=$1`, [
            bob,
          ]),
          /permission denied/,
        );
      },
    );
    await t.test(
      "o autor atualiza; uma versão antiga não sobrescreve o registro",
      async () => {
        await asUser(alice);
        assert.equal(
          (
            await db.query<{ versao: number }>(
              `update public.familias set pessoas=5 where id=$1 and versao=1 returning versao`,
              [familyId],
            )
          ).rows[0].versao,
          2,
        );
        assert.equal(
          (
            await db.query(
              `update public.familias set pessoas=6 where id=$1 and versao=1 returning id`,
              [familyId],
            )
          ).rows.length,
          0,
        );
      },
    );
    await t.test(
      "conta desativada não consulta nem cadastra famílias",
      async () => {
        await asUser(blocked);
        assert.equal(
          (await db.query("select * from public.familias")).rows.length,
          0,
        );
        await assert.rejects(db.query(insert), /row-level security/);
      },
    );
    await t.test(
      "gestor edita os cadastros e consulta a auditoria",
      async () => {
        await asUser(gestor);
        assert.equal(
          (
            await db.query<{ versao: number }>(
              `update public.familias set pessoas=7 where id=$1 returning versao`,
              [familyId],
            )
          ).rows[0].versao,
          3,
        );
        assert.equal(
          (await db.query("select * from public.auditoria")).rows.length,
          3,
        );
      },
    );
    await t.test(
      "coordenadas inválidas e remoções são recusadas pelo banco",
      async () => {
        await assert.rejects(
          db.query("update public.familias set latitude=0 where id=$1", [
            familyId,
          ]),
          /check constraint/,
        );
        await assert.rejects(
          db.query("delete from public.familias where id=$1", [familyId]),
          /permission denied/,
        );
      },
    );
  } finally {
    await db.close();
  }
});
