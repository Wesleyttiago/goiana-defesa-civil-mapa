import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canEdit,
  cleanDraft,
  EMPTY_FILTERS,
  filterFamilies,
  parseDemoRecords,
  validPosition,
  validateDraft,
} from "../src/lib/domain";
import { demoFamilies, DEMO_AGENT } from "../src/lib/demo";

test("localização: aceita Goiana e recusa números ausentes, infinitos e coordenadas invertidas", () => {
  assert.equal(validPosition(-7.5606, -35.0025), true);
  for (const pair of [
    [NaN, -35],
    [-7.56, Infinity],
    [0, 0],
    [-35, -7.56],
    [-23.55, -46.63],
  ])
    assert.equal(validPosition(...(pair as [number, number])), false);
  assert.equal(validPosition(null as unknown as number, -35), false);
});

test("cadastro não aceita casa sem localização nem moradores fracionados", () => {
  const family = demoFamilies()[0];
  assert.equal(validateDraft(family), null);
  assert.match(validateDraft({ ...family, latitude: NaN })!, /residência/);
  for (const pessoas of [0, -1, 1.5, 51, NaN])
    assert.match(validateDraft({ ...family, pessoas })!, /moradores/);
});

test("classificação desconhecida e texto excessivo são recusados", () => {
  const f = demoFamilies()[0];
  assert.ok(
    validateDraft({ ...f, nivel_risco: "extremo" as typeof f.nivel_risco }),
  );
  assert.ok(validateDraft({ ...f, observacoes: "a".repeat(2001) }));
  assert.ok(validateDraft({ ...f, telefone: "isto não é telefone" }));
});

test("busca normaliza acentos e contempla rua e referência", () => {
  const f = {
    ...demoFamilies()[0],
    responsavel: "Conceição",
    endereco: "Rua da República, 10",
    referencia: "Próximo à associação",
  };
  for (const search of ["conceicao", "REPUBLICA", "associacao"])
    assert.equal(filterFamilies([f], { ...EMPTY_FILTERS, search }).length, 1);
});

test("filtro de inundação e deslizamento inclui cadastros de ambos os tipos", () => {
  const f = { ...demoFamilies()[0], tipo_risco: "ambos" as const };
  for (const type of ["ambos", "inundacao", "deslizamento"])
    assert.equal(filterFamilies([f], { ...EMPTY_FILTERS, type }).length, 1);
  assert.equal(
    filterFamilies(demoFamilies(), { ...EMPTY_FILTERS, type: "ambos" }).every(
      (v) => v.tipo_risco === "ambos",
    ),
    true,
  );
});

test("filtros combinam critérios, sem mudar a lista original", () => {
  const families = demoFamilies();
  const expected = families.filter(
    (v) => v.nivel_risco === "alto" && v.situacao === "pendente",
  );
  assert.deepEqual(
    filterFamilies(families, {
      ...EMPTY_FILTERS,
      level: "alto",
      situation: "pendente",
    }),
    expected,
  );
  assert.equal(families.length, 8);
});

test("agente pode editar somente o próprio cadastro; gestor pode editar todos", () => {
  const f = demoFamilies()[0];
  assert.equal(canEdit({ ...DEMO_AGENT, papel: "agente" }, f), true);
  assert.equal(
    canEdit({ ...DEMO_AGENT, id: "outro", papel: "agente" }, f),
    false,
  );
  assert.equal(
    canEdit({ ...DEMO_AGENT, id: "outro", papel: "gestor" }, f),
    true,
  );
});

test("payload de gravação remove campos de identidade, autoria e versão", () => {
  const payload = cleanDraft({
    ...demoFamilies()[0],
    responsavel: "  Nome exemplo  ",
  });
  assert.equal(payload.responsavel, "Nome exemplo");
  for (const field of [
    "id",
    "criado_por",
    "versao",
    "criado_em",
    "atualizado_em",
  ])
    assert.equal(field in payload, false);
});

test("restauração da demonstração valida a estrutura e não aceita outra origem", () => {
  const raw = JSON.stringify({ source: "demo", records: demoFamilies() });
  assert.equal(parseDemoRecords(raw).length, 8);
  for (const bad of [
    "{",
    "null",
    '{"source":"real","records":[]}',
    JSON.stringify({
      source: "demo",
      records: [{ ...demoFamilies()[0], latitude: null }],
    }),
  ])
    assert.throws(() => parseDemoRecords(bad));
});
