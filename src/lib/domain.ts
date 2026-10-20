export type RiskLevel = "baixo" | "medio" | "alto";
export type RiskType = "inundacao" | "deslizamento" | "ambos";
export type Situation = "pendente" | "acompanhamento" | "encaminhada";
export type Role = "agente" | "gestor";

export interface FamilyDraft {
  responsavel: string;
  telefone: string;
  pessoas: number;
  bairro: string;
  endereco: string;
  referencia: string;
  latitude: number;
  longitude: number;
  tipo_risco: RiskType;
  nivel_risco: RiskLevel;
  situacao: Situation;
  observacoes: string;
}

export interface Family extends FamilyDraft {
  id: string;
  criado_em: string;
  atualizado_em: string;
  criado_por: string;
  versao: number;
}

export interface Agent {
  id: string;
  nome: string;
  papel: Role;
  demo: boolean;
}

export const GOIANA_CENTER: [number, number] = [-7.5606, -35.0025];
// Área de navegação do módulo. Não representa o limite municipal nem uma área de risco.
export const GOIANA_VIEW_BOUNDS: [[number, number], [number, number]] = [
  [-7.85, -35.2],
  [-7.45, -34.75],
];

export const LEVEL_LABELS: Record<RiskLevel, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};
export const TYPE_LABELS: Record<RiskType, string> = {
  inundacao: "Inundação",
  deslizamento: "Deslizamento",
  ambos: "Inundação e deslizamento",
};
export const SITUATION_LABELS: Record<Situation, string> = {
  pendente: "Visita pendente",
  acompanhamento: "Em acompanhamento",
  encaminhada: "Encaminhada",
};
export const LEVEL_COLORS: Record<RiskLevel, string> = {
  baixo: "#1b795d",
  medio: "#a86908",
  alto: "#bf383b",
};

export function blankDraft(): FamilyDraft {
  return {
    responsavel: "",
    telefone: "",
    pessoas: 1,
    bairro: "",
    endereco: "",
    referencia: "",
    latitude: NaN,
    longitude: NaN,
    tipo_risco: "inundacao",
    nivel_risco: "medio",
    situacao: "pendente",
    observacoes: "",
  };
}

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function newFamilyId(): string {
  // getRandomValues também funciona nas prévias HTTP em que randomUUID não está disponível.
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (n) => n.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function validPosition(lat: number, lng: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= GOIANA_VIEW_BOUNDS[0][0] &&
    lat <= GOIANA_VIEW_BOUNDS[1][0] &&
    lng >= GOIANA_VIEW_BOUNDS[0][1] &&
    lng <= GOIANA_VIEW_BOUNDS[1][1]
  );
}

export function validateDraft(d: FamilyDraft): string | null {
  if (
    typeof d.responsavel !== "string" ||
    d.responsavel.trim().length < 3 ||
    d.responsavel.length > 120
  )
    return "Informe o nome do responsável (de 3 a 120 caracteres).";
  if (
    typeof d.endereco !== "string" ||
    d.endereco.trim().length < 5 ||
    d.endereco.length > 240
  )
    return "Informe a rua e o número da residência.";
  if (
    typeof d.bairro !== "string" ||
    d.bairro.trim().length < 2 ||
    d.bairro.length > 100
  )
    return "Informe o bairro ou a comunidade.";
  if (!Number.isInteger(d.pessoas) || d.pessoas < 1 || d.pessoas > 50)
    return "O número de moradores deve ser um inteiro entre 1 e 50.";
  if (!validPosition(d.latitude, d.longitude))
    return "Selecione uma residência na região de Goiana (PE).";
  if (
    !["baixo", "medio", "alto"].includes(d.nivel_risco) ||
    !["inundacao", "deslizamento", "ambos"].includes(d.tipo_risco) ||
    !["pendente", "acompanhamento", "encaminhada"].includes(d.situacao)
  )
    return "Revise a classificação e a situação.";
  if (
    typeof d.telefone !== "string" ||
    (d.telefone && !/^\+?[0-9\s()\-]{10,22}$/.test(d.telefone))
  )
    return "Revise o telefone ou deixe o campo em branco.";
  if (
    typeof d.referencia !== "string" ||
    d.referencia.length > 240 ||
    typeof d.observacoes !== "string" ||
    d.observacoes.length > 2000
  )
    return "A referência deve ter até 240 caracteres e as observações, até 2.000.";
  return null;
}

export function cleanDraft(d: FamilyDraft): FamilyDraft {
  // Lista explícita: nunca enviar id, autor, versão ou datas fornecidos pelo formulário.
  return {
    responsavel: d.responsavel.trim(),
    telefone: d.telefone.trim(),
    pessoas: d.pessoas,
    bairro: d.bairro.trim(),
    endereco: d.endereco.trim(),
    referencia: d.referencia.trim(),
    latitude: d.latitude,
    longitude: d.longitude,
    tipo_risco: d.tipo_risco,
    nivel_risco: d.nivel_risco,
    situacao: d.situacao,
    observacoes: d.observacoes.trim(),
  };
}

export interface Filters {
  search: string;
  level: string;
  type: string;
  situation: string;
  district: string;
}
export const EMPTY_FILTERS: Filters = {
  search: "",
  level: "",
  type: "",
  situation: "",
  district: "",
};

export function filterFamilies(families: Family[], f: Filters): Family[] {
  const query = normalize(f.search);
  return families.filter(
    (v) =>
      (!query ||
        normalize(
          `${v.responsavel} ${v.bairro} ${v.endereco} ${v.referencia}`,
        ).includes(query)) &&
      (!f.level || v.nivel_risco === f.level) &&
      (!f.type ||
        v.tipo_risco === f.type ||
        (v.tipo_risco === "ambos" && f.type !== "ambos")) &&
      (!f.situation || v.situacao === f.situation) &&
      (!f.district || v.bairro === f.district),
  );
}

export function canEdit(agent: Agent, family: Family): boolean {
  return agent.papel === "gestor" || family.criado_por === agent.id;
}

export function parseDemoRecords(raw: string): Family[] {
  const envelope: unknown = JSON.parse(raw);
  if (
    !envelope ||
    typeof envelope !== "object" ||
    !("source" in envelope) ||
    envelope.source !== "demo" ||
    !("records" in envelope) ||
    !Array.isArray(envelope.records)
  )
    throw new Error("Dados de demonstração inválidos.");
  return envelope.records.map((v: unknown) => {
    if (!v || typeof v !== "object") throw new Error("Registro inválido.");
    const family = v as Family;
    if (
      validateDraft(family) ||
      typeof family.id !== "string" ||
      !family.id ||
      typeof family.criado_por !== "string" ||
      !Number.isInteger(family.versao) ||
      family.versao < 1 ||
      !Number.isFinite(Date.parse(family.criado_em)) ||
      !Number.isFinite(Date.parse(family.atualizado_em))
    )
      throw new Error("Registro de demonstração inválido.");
    return family;
  });
}
