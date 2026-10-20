import type { Agent, Family } from "./domain";

export const DEMO_AGENT: Agent = {
  id: "demo",
  nome: "Agente de demonstração",
  papel: "gestor",
  demo: true,
};
export const DEMO_KEY = "goiana:demo:v1";

export function demoFamilies(): Family[] {
  const points = [
    [-7.5601, -35.0041],
    [-7.5622, -35.0028],
    [-7.5588, -35.0007],
    [-7.5642, -35.0054],
    [-7.5568, -35.0083],
    [-7.5576, -34.9983],
    [-7.566, -35.0016],
    [-7.561, -34.996],
  ];
  return points.map(([latitude, longitude], i) => ({
    id: `demo-${i + 1}`,
    responsavel: `Família exemplo ${String(i + 1).padStart(2, "0")}`,
    telefone: "",
    pessoas: [4, 3, 5, 2, 6, 3, 4, 2][i],
    bairro: [
      "Comunidade exemplo A",
      "Comunidade exemplo B",
      "Comunidade exemplo C",
    ][i % 3],
    endereco: `Residência fictícia ${i + 1} — apenas demonstração`,
    referencia: "Localização ilustrativa, sem vínculo com moradores reais.",
    latitude,
    longitude,
    tipo_risco: i === 4 ? "deslizamento" : i === 6 ? "ambos" : "inundacao",
    nivel_risco: i % 3 === 0 ? "alto" : i % 3 === 1 ? "medio" : "baixo",
    situacao:
      i % 3 === 0 ? "pendente" : i % 3 === 1 ? "acompanhamento" : "encaminhada",
    observacoes:
      "Registro fictício para testar o módulo. Não é um cadastro da prefeitura nem uma avaliação real de risco.",
    criado_em: "2026-10-06T12:00:00.000Z",
    atualizado_em: "2026-10-06T12:00:00.000Z",
    criado_por: "demo",
    versao: 1,
  }));
}
