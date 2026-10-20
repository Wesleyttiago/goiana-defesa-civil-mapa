"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import dynamic from "next/dynamic";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Droplets,
  Expand,
  Flame,
  HelpCircle,
  House,
  ListFilter,
  LockKeyhole,
  LogOut,
  Map,
  MapPin,
  Mountain,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  canEdit,
  cleanDraft,
  EMPTY_FILTERS,
  filterFamilies,
  LEVEL_LABELS,
  SITUATION_LABELS,
  TYPE_LABELS,
  validateDraft,
  parseDemoRecords,
  newFamilyId,
  type Agent,
  type Family,
  type FamilyDraft,
  type Filters,
} from "@/lib/domain";
import { DEMO_AGENT, DEMO_KEY, demoFamilies } from "@/lib/demo";
import { supabase } from "@/lib/supabase";
import { listFamilies, saveFamily } from "@/lib/repository";
import FamilyForm from "./family-form";

const GeoMap = dynamic(() => import("./geo-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading" role="status">
      Carregando mapa de Goiana…
    </div>
  ),
});

function RiskBadge({ family }: { family: Family }) {
  return (
    <span className={`risk-badge risk-${family.nivel_risco}`}>
      <span aria-hidden="true" />
      Risco {LEVEL_LABELS[family.nivel_risco].toLowerCase()}
    </span>
  );
}

function Brand() {
  return (
    <div className="brand">
      <img
        src="/logo-goiana.png"
        alt="Prefeitura de Goiana — Crescendo juntos, cuidando da gente"
        width="148"
        height="78"
      />
      <div className="brand-divider" />
      <div className="service-brand">
        <ShieldCheck size={29} strokeWidth={1.6} />
        <div>
          <strong>DEFESA CIVIL</strong>
          <span>Cadastro e acompanhamento de famílias</span>
        </div>
      </div>
    </div>
  );
}

export default function Portal() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });
  const [tab, setTab] = useState<"map" | "list">("map");
  const [heat, setHeat] = useState(false);
  const [fitToken, setFitToken] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<false | "new" | Family>(false);
  const [advancedFilters, setAdvancedFilters] = useState(false);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState("");
  const demoCorrupt = useRef(false);

  useEffect(() => {
    let live = true;
    let generation = 0;
    const applySession = async (session: Session | null) => {
      const current = ++generation;
      if (!session) {
        if (live) {
          setAgent(null);
          setFamilies([]);
          setSessionLoading(false);
        }
        return;
      }
      const { data, error } = await supabase!
        .from("agentes")
        .select("nome,papel,ativo")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!live || current !== generation) return;
      if (error || !data?.ativo || !["agente", "gestor"].includes(data.papel)) {
        setAgent(null);
        setFamilies([]);
        setLoginError(
          "Seu acesso ainda não foi habilitado pela gestão. Solicite a ativação do seu usuário.",
        );
      } else {
        setAgent({
          id: session.user.id,
          nome: data.nome,
          papel: data.papel,
          demo: false,
        });
        setLoginError("");
      }
      setSessionLoading(false);
      setLoginBusy(false);
    };
    try {
      if (sessionStorage.getItem("goiana:demo:active") === "1") {
        const stored = sessionStorage.getItem(DEMO_KEY);
        setAgent(DEMO_AGENT);
        if (stored) {
          try {
            setFamilies(parseDemoRecords(stored));
          } catch {
            demoCorrupt.current = true;
            setDataError(
              "Os dados da demonstração não puderam ser lidos. Eles foram preservados. Use “Restaurar demonstração” para começar de novo.",
            );
          }
        } else setFamilies(demoFamilies());
        setSessionLoading(false);
        return;
      }
    } catch {
      setLoginError(
        "O armazenamento desta aba está indisponível. A demonstração funcionará apenas até recarregar a página.",
      );
    }
    if (!supabase) {
      setSessionLoading(false);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          if (live) {
            setSessionLoading(false);
            setLoginError(
              "Não foi possível verificar sua sessão. Tente entrar novamente.",
            );
          }
        } else void applySession(data.session);
      })
      .catch(() => {
        if (live) {
          setSessionLoading(false);
          setLoginError("Não foi possível verificar a sessão.");
        }
      });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event !== "INITIAL_SESSION")
          queueMicrotask(() => {
            if (live) void applySession(session);
          });
      },
    );
    return () => {
      live = false;
      generation++;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!agent || agent.demo) return;
    let current = true;
    setLoading(true);
    setDataError("");
    listFamilies()
      .then((data) => {
        if (current) setFamilies(data);
      })
      .catch((e) => {
        if (current) setDataError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [agent, refresh]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  function enterDemo() {
    setLoginError("");
    setDataError("");
    demoCorrupt.current = false;
    const data = demoFamilies();
    try {
      sessionStorage.setItem("goiana:demo:active", "1");
      sessionStorage.setItem(
        DEMO_KEY,
        JSON.stringify({ source: "demo", records: data }),
      );
    } catch {
      setToast(
        "Demonstração iniciada. O navegador não permite manter os dados ao recarregar.",
      );
    }
    setFamilies(data);
    setAgent(DEMO_AGENT);
    setFilters({ ...EMPTY_FILTERS });
  }

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const inputs = new FormData(e.currentTarget);
    setLoginBusy(true);
    setLoginError("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: String(inputs.get("email")).trim(),
        password: String(inputs.get("password")),
      });
      if (error || !data.session) {
        setLoginError(
          "Não foi possível entrar. Confira seu e-mail e senha e tente novamente.",
        );
        setLoginBusy(false);
      }
    } catch {
      setLoginError(
        "Não foi possível conectar ao serviço de acesso. Confira a internet e tente novamente.",
      );
      setLoginBusy(false);
    }
  }

  async function logout() {
    if (agent?.demo) {
      try {
        sessionStorage.removeItem("goiana:demo:active");
        sessionStorage.removeItem(DEMO_KEY);
      } catch {
        /* Sessão volátil. */
      }
    } else if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) {
        setToast(
          "Não foi possível encerrar a sessão. Confira a conexão e tente novamente.",
        );
        return;
      }
    }
    setAgent(null);
    setFamilies([]);
    setSelectedId("");
    setForm(false);
    setFilters({ ...EMPTY_FILTERS });
    setDataError("");
  }

  async function persist(draft: FamilyDraft, previous?: Family) {
    if (!agent) throw new Error("Entre novamente para continuar.");
    const validation = validateDraft(draft);
    if (validation) throw new Error(validation);
    if (previous && !canEdit(agent, previous))
      throw new Error("Você não pode editar este cadastro.");
    let saved: Family;
    if (agent.demo) {
      if (demoCorrupt.current)
        throw new Error(
          "Restaure a demonstração antes de salvar novos exemplos.",
        );
      const now = new Date().toISOString();
      saved = {
        ...cleanDraft(draft),
        id: previous?.id ?? newFamilyId(),
        criado_por: previous?.criado_por ?? agent.id,
        criado_em: previous?.criado_em ?? now,
        atualizado_em: now,
        versao: (previous?.versao ?? 0) + 1,
      };
      const next = previous
        ? families.map((f) => (f.id === previous.id ? saved : f))
        : [saved, ...families];
      try {
        sessionStorage.setItem(
          DEMO_KEY,
          JSON.stringify({ source: "demo", records: next }),
        );
      } catch {
        throw new Error(
          "O navegador não permitiu salvar os exemplos nesta aba. Nada foi alterado.",
        );
      }
      setFamilies(next);
    } else {
      saved = await saveFamily(draft, previous);
      setFamilies((data) =>
        previous
          ? data.map((f) => (f.id === saved.id ? saved : f))
          : [saved, ...data],
      );
    }
    setSelectedId(saved.id);
    setFilters({ ...EMPTY_FILTERS });
    setTab("map");
    setHeat(false);
    setToast(
      previous
        ? "Cadastro atualizado."
        : "Família cadastrada e localizada no mapa.",
    );
  }

  const visible = useMemo(
    () => filterFamilies(families, filters),
    [families, filters],
  );
  const districts = useMemo(
    () =>
      [...new Set(families.map((f) => f.bairro))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [families],
  );
  const selected = visible.find((f) => f.id === selectedId);
  const selectFamily = useCallback((family: Family) => {
    setSelectedId(family.id);
    setHeat(false);
  }, []);
  function changeFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setSelectedId("");
  }
  const hasFilters = Object.values(filters).some(Boolean);

  if (sessionLoading)
    return (
      <main className="session-loading">
        <ShieldCheck size={34} />
        <p>Preparando o acesso…</p>
      </main>
    );

  if (!agent)
    return (
      <div className="login-page">
        <div className="institution-strip">
          <span>PREFEITURA MUNICIPAL DE GOIANA · PERNAMBUCO</span>
          <span>DEFESA CIVIL</span>
        </div>
        <header className="login-header">
          <Brand />
        </header>
        <main className="login-layout">
          <section className="login-intro">
            <span className="eyebrow">CUIDADO QUE COMEÇA NO TERRITÓRIO</span>
            <h1>
              Conhecer cada família.
              <br />
              <span>Estar mais perto.</span>
            </h1>
            <p>
              Um espaço para localizar famílias, registrar vulnerabilidades e
              organizar o acompanhamento da Defesa Civil.
            </p>
            <div className="intro-feature">
              <MapPin size={23} />
              <div>
                <strong>Uma família, uma localização</strong>
                <span>Residências marcadas no mapa real de Goiana.</span>
              </div>
            </div>
            <div className="intro-feature">
              <ClipboardList size={23} />
              <div>
                <strong>Informação para acompanhar</strong>
                <span>Cadastros e situações de atendimento reunidos.</span>
              </div>
            </div>
            <span className="development-note">
              Módulo acadêmico em desenvolvimento
            </span>
          </section>
          <section className="login-card" aria-labelledby="login-title">
            <div className="login-symbol">
              <LockKeyhole size={25} />
            </div>
            <h2 id="login-title">Acesso do agente</h2>
            <p>Entre com a conta habilitada pela gestão.</p>
            <form onSubmit={login}>
              <label>
                E-mail institucional
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="seu.email@exemplo.com"
                  required
                  disabled={!supabase || loginBusy}
                />
              </label>
              <label>
                Senha
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  required
                  disabled={!supabase || loginBusy}
                />
              </label>
              {loginError && (
                <p className="form-error" role="alert">
                  {loginError}
                </p>
              )}
              <button
                type="submit"
                className="primary-button login-submit"
                disabled={!supabase || loginBusy}
              >
                {loginBusy ? "Verificando acesso…" : "Acessar sistema"}
                <ArrowRight size={17} />
              </button>
            </form>
            {!supabase && (
              <p className="connection-note">
                O banco de dados ainda não foi conectado. Explore abaixo a
                versão de demonstração com dados fictícios.
              </p>
            )}
            <div className="login-or">
              <span>CONHEÇA O MÓDULO</span>
            </div>
            <button className="demo-button" onClick={enterDemo}>
              Explorar demonstração
              <ArrowRight size={17} />
            </button>
            <small>A demonstração não acessa cadastros reais.</small>
          </section>
        </main>
        <footer className="login-footer">
          Goiana, Pernambuco <span>•</span> Cadastro territorial de famílias
        </footer>
      </div>
    );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>
      <div className="institution-strip">
        <span>PREFEITURA MUNICIPAL DE GOIANA · PERNAMBUCO</span>
        <span>
          <LockKeyhole size={11} /> ÁREA DO AGENTE
        </span>
      </div>
      <header className="app-header">
        <Brand />
        <div className="agent-actions">
          <div className="agent-avatar" aria-hidden="true">
            {agent.demo ? "DE" : agent.nome.slice(0, 2).toUpperCase()}
          </div>
          <div className="agent-name">
            <strong>{agent.nome}</strong>
            <span>
              {agent.demo
                ? "Ambiente de demonstração"
                : agent.papel === "gestor"
                  ? "Gestão da Defesa Civil"
                  : "Agente social"}
            </span>
          </div>
          <button
            className="icon-button logout-button"
            aria-label="Sair do sistema"
            onClick={logout}
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>
      <nav className="main-nav" aria-label="Módulos">
        <div className="nav-tabs">
          <button
            aria-current={tab === "map" ? "page" : undefined}
            onClick={() => setTab("map")}
          >
            <Map size={17} />
            Mapa das famílias
          </button>
          <button
            aria-current={tab === "list" ? "page" : undefined}
            onClick={() => setTab("list")}
          >
            <ClipboardList size={17} />
            Famílias cadastradas
          </button>
        </div>
        <button
          className="help-button"
          onClick={() => setHelp((v) => !v)}
          aria-expanded={help}
        >
          <HelpCircle size={17} />
          Como usar
        </button>
      </nav>
      <main id="main-content" className="workspace">
        <div className="breadcrumb">
          Defesa Civil
          <ChevronRight size={12} />
          <span>Cadastro territorial</span>
        </div>
        <div className="page-heading">
          <div>
            <h1>
              {tab === "map" ? "Mapa das famílias" : "Famílias cadastradas"}
            </h1>
            <p>O território em vista. Cada família no seu lugar.</p>
          </div>
          <button className="primary-button" onClick={() => setForm("new")}>
            <Plus size={18} />
            Cadastrar família
          </button>
        </div>
        {agent.demo && (
          <div className="demo-notice">
            <span className="demo-pill">DEMONSTRAÇÃO</span>
            <p>
              Todos os nomes, pontos e avaliações são fictícios. Nenhum cadastro
              real é acessado.
            </p>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Restaurar os exemplos e descartar os cadastros fictícios desta aba?",
                  )
                )
                  enterDemo();
              }}
            >
              Restaurar demonstração
            </button>
          </div>
        )}
        {help && (
          <section className="help-panel" aria-label="Como usar o módulo">
            <div>
              <strong>1. Cadastre</strong>
              <p>Informe os dados da família e marque a residência no mapa.</p>
            </div>
            <div>
              <strong>2. Localize</strong>
              <p>
                Busque pelo nome, endereço ou comunidade. Clique no ponto para
                ver a ficha.
              </p>
            </div>
            <div>
              <strong>3. Acompanhe</strong>
              <p>
                Atualize a situação e a avaliação de risco. O calor mostra
                concentração de cadastros.
              </p>
            </div>
          </section>
        )}
        <div className="summary-line">
          <span>
            <Users size={16} />
            <strong>{families.length}</strong> famílias cadastradas
          </span>
          <i />
          <span>
            <House size={16} />
            <strong>{families.reduce((n, f) => n + f.pessoas, 0)}</strong>{" "}
            moradores
          </span>
          <i />
          <span className="high-summary">
            <span className="status-dot" />
            <strong>
              {families.filter((f) => f.nivel_risco === "alto").length}
            </strong>{" "}
            em risco alto
          </span>
          <button
            className="refresh-button"
            disabled={loading}
            onClick={() =>
              agent.demo
                ? setToast(
                    "Demonstração atualizada. Os exemplos estão salvos nesta aba.",
                  )
                : setRefresh((v) => v + 1)
            }
          >
            <RefreshCw size={14} className={loading ? "spinning" : ""} />
            {loading ? "Carregando…" : "Atualizar"}
          </button>
        </div>
        {dataError && (
          <div className="form-error" role="alert">
            {dataError}
            {!agent.demo && (
              <button
                className="text-button"
                onClick={() => setRefresh((v) => v + 1)}
              >
                Tentar novamente
              </button>
            )}
          </div>
        )}
        <section
          className={`territory-panel ${tab === "list" ? "list-mode" : ""}`}
          aria-label="Consulta de famílias"
        >
          <aside className="family-sidebar">
            {selected && tab === "map" ? (
              <>
                <button
                  className="back-button"
                  onClick={() => setSelectedId("")}
                >
                  <ArrowLeft size={16} />
                  Voltar para as famílias
                </button>
                <FamilyDetails
                  family={selected}
                  agent={agent}
                  onEdit={() => setForm(selected)}
                />
              </>
            ) : (
              <>
                <div className="sidebar-heading">
                  <h2>Localizar famílias</h2>
                  <span>
                    {visible.length} de {families.length}
                  </span>
                </div>
                <label className="search-field">
                  <Search size={18} />
                  <span className="sr-only">Buscar famílias</span>
                  <input
                    value={filters.search}
                    onChange={(e) => changeFilter("search", e.target.value)}
                    placeholder="Nome, rua ou comunidade"
                  />
                  {filters.search && (
                    <button
                      aria-label="Limpar busca"
                      onClick={() => changeFilter("search", "")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
                <div className="filter-row">
                  <label>
                    Nível de risco
                    <select
                      aria-label="Filtrar por nível de risco"
                      value={filters.level}
                      onChange={(e) => changeFilter("level", e.target.value)}
                    >
                      <option value="">Todos os níveis</option>
                      {Object.entries(LEVEL_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Comunidade
                    <select
                      aria-label="Filtrar por comunidade"
                      value={filters.district}
                      onChange={(e) => changeFilter("district", e.target.value)}
                    >
                      <option value="">Todas</option>
                      {districts.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  className="advanced-button"
                  aria-expanded={advancedFilters}
                  onClick={() => setAdvancedFilters((v) => !v)}
                >
                  <ListFilter size={15} />
                  Mais filtros
                  <ChevronDown
                    size={14}
                    className={advancedFilters ? "rotated" : ""}
                  />
                </button>
                {advancedFilters && (
                  <div className="extra-filters">
                    <label>
                      Tipo de risco
                      <select
                        aria-label="Filtrar por tipo de risco"
                        value={filters.type}
                        onChange={(e) => changeFilter("type", e.target.value)}
                      >
                        <option value="">Todos os tipos</option>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Situação
                      <select
                        aria-label="Filtrar por situação"
                        value={filters.situation}
                        onChange={(e) =>
                          changeFilter("situation", e.target.value)
                        }
                      >
                        <option value="">Todas as situações</option>
                        {Object.entries(SITUATION_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                {hasFilters && (
                  <button
                    className="clear-filters"
                    onClick={() => {
                      setFilters({ ...EMPTY_FILTERS });
                      setSelectedId("");
                    }}
                  >
                    Limpar filtros
                  </button>
                )}
                <div className="list-caption">
                  <span>
                    {loading
                      ? "CARREGANDO CADASTROS"
                      : `${visible.length} ${visible.length === 1 ? "FAMÍLIA ENCONTRADA" : "FAMÍLIAS ENCONTRADAS"}`}
                  </span>
                  <span className="list-live" aria-live="polite">
                    {hasFilters ? "Filtros ativos" : "Todas as famílias"}
                  </span>
                </div>
                {tab === "map" && (
                  <div className="family-cards">
                    {visible.map((f) => (
                      <button
                        key={f.id}
                        className="family-card"
                        onClick={() => selectFamily(f)}
                      >
                        <div className="card-top">
                          <strong>{f.responsavel}</strong>
                          <ChevronRight size={16} />
                        </div>
                        <span className="card-address">
                          <MapPin size={13} />
                          {f.bairro}
                        </span>
                        <div className="card-bottom">
                          <RiskBadge family={f} />
                          <span>{f.pessoas} moradores</span>
                        </div>
                      </button>
                    ))}
                    {!visible.length && !loading && (
                      <EmptyState
                        filtered={hasFilters}
                        onCreate={() => setForm("new")}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </aside>
          {tab === "map" ? (
            <div className="map-column">
              <div className="map-toolbar">
                <div className="map-title">
                  <span className="live-dot" />
                  Goiana <span>/ Pernambuco</span>
                </div>
                <div className="map-actions">
                  <div className="map-switch" aria-label="Visualização do mapa">
                    <button aria-pressed={!heat} onClick={() => setHeat(false)}>
                      <MapPin size={15} />
                      Pontos
                    </button>
                    <button aria-pressed={heat} onClick={() => setHeat(true)}>
                      <Flame size={15} />
                      Mapa de calor
                    </button>
                  </div>
                  <button
                    className="icon-button fit-button"
                    aria-label="Ajustar mapa aos cadastros filtrados"
                    title="Ajustar aos cadastros"
                    onClick={() => {
                      setSelectedId("");
                      setFitToken((n) => n + 1);
                    }}
                  >
                    <Expand size={17} />
                  </button>
                </div>
              </div>
              <div className="main-map">
                <GeoMap
                  families={visible}
                  selectedId={selectedId}
                  onSelect={selectFamily}
                  heat={heat}
                  fitToken={fitToken}
                />
                {!visible.length && !loading && (
                  <div className="empty-map-hint">
                    <MapPin size={18} />
                    {hasFilters
                      ? "Nenhuma família corresponde aos filtros."
                      : "Cadastre a primeira família para vê-la no mapa."}
                  </div>
                )}
              </div>
              <div className="map-legend">
                {heat ? (
                  <>
                    <span>Concentração de famílias</span>
                    <div className="heat-key">
                      <span>Menor</span>
                      <i />
                      <span>Maior</span>
                    </div>
                    <small>Não representa intensidade do risco.</small>
                  </>
                ) : (
                  <>
                    <strong>Nível informado de risco</strong>
                    {Object.entries(LEVEL_LABELS).map(([k, v]) => (
                      <span key={k} className={`legend-item legend-${k}`}>
                        <i />
                        {v}
                      </span>
                    ))}
                    <small>Clique em um ponto para ver a ficha.</small>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="registry-table">
              <div className="table-heading">
                <h2>Cadastros do território</h2>
                <span>
                  {visible.length}{" "}
                  {visible.length === 1 ? "registro" : "registros"}
                </span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Família / responsável</th>
                      <th scope="col">Comunidade</th>
                      <th scope="col">Moradores</th>
                      <th scope="col">Risco</th>
                      <th scope="col">Atendimento</th>
                      <th scope="col">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <strong>{f.responsavel}</strong>
                          <span>{f.endereco}</span>
                        </td>
                        <td>{f.bairro}</td>
                        <td>{f.pessoas}</td>
                        <td>
                          <RiskBadge family={f} />
                        </td>
                        <td>{SITUATION_LABELS[f.situacao]}</td>
                        <td>
                          <button
                            className="table-map-button"
                            aria-label={`Ver ${f.responsavel} no mapa`}
                            onClick={() => {
                              setTab("map");
                              selectFamily(f);
                            }}
                          >
                            <MapPin size={17} />
                            <span>Ver no mapa</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!visible.length && !loading && (
                <EmptyState
                  filtered={hasFilters}
                  onCreate={() => setForm("new")}
                />
              )}
            </div>
          )}
        </section>
        <footer className="workspace-footer">
          <span>
            <ShieldCheck size={13} />
            Defesa Civil de Goiana
          </span>
          <span>
            {agent.demo
              ? "Dados fictícios · versão para avaliação acadêmica"
              : "Acesso restrito a agentes habilitados"}
          </span>
        </footer>
      </main>
      {form && (
        <FamilyForm
          family={form === "new" ? undefined : form}
          demo={agent.demo}
          onClose={() => setForm(false)}
          onSave={persist}
        />
      )}
      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={18} />
          {toast}
          <button aria-label="Fechar aviso" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  filtered,
  onCreate,
}: {
  filtered: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="empty-state">
      <Search size={27} />
      <strong>
        {filtered
          ? "Nenhuma família encontrada"
          : "Comece pelo primeiro cadastro"}
      </strong>
      <p>
        {filtered
          ? "Tente outro termo ou remova os filtros."
          : "Registre a família e selecione sua residência no mapa."}
      </p>
      {!filtered && (
        <button className="text-button" onClick={onCreate}>
          <Plus size={15} />
          Cadastrar família
        </button>
      )}
    </div>
  );
}

function FamilyDetails({
  family: f,
  agent,
  onEdit,
}: {
  family: Family;
  agent: Agent;
  onEdit: () => void;
}) {
  return (
    <article className="family-details">
      <div className="detail-house">
        <House size={27} />
      </div>
      <RiskBadge family={f} />
      <h2>{f.responsavel}</h2>
      <p className="detail-address">{f.endereco}</p>
      <p className="detail-district">
        <MapPin size={14} />
        {f.bairro} · Goiana/PE
      </p>
      <div className="detail-residents">
        <Users size={18} />
        <strong>{f.pessoas}</strong> moradores na residência
      </div>
      <dl>
        <div>
          <dt>Tipo de risco</dt>
          <dd>
            {f.tipo_risco === "deslizamento" ? (
              <Mountain size={16} />
            ) : (
              <Droplets size={16} />
            )}{" "}
            {TYPE_LABELS[f.tipo_risco]}
          </dd>
        </div>
        <div>
          <dt>Situação do atendimento</dt>
          <dd>
            <span className={`situation-dot situation-${f.situacao}`} />
            {SITUATION_LABELS[f.situacao]}
          </dd>
        </div>
        {f.telefone && (
          <div>
            <dt>Telefone</dt>
            <dd>{f.telefone}</dd>
          </div>
        )}
        {f.referencia && (
          <div>
            <dt>Ponto de referência</dt>
            <dd>{f.referencia}</dd>
          </div>
        )}
        <div>
          <dt>Coordenadas da residência</dt>
          <dd className="coordinate-value">
            {f.latitude.toFixed(6)}, {f.longitude.toFixed(6)}
          </dd>
        </div>
        {f.observacoes && (
          <div>
            <dt>Observações</dt>
            <dd>{f.observacoes}</dd>
          </div>
        )}
        <div>
          <dt>Última atualização</dt>
          <dd>
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeZone: "America/Recife",
            }).format(new Date(f.atualizado_em))}
          </dd>
        </div>
      </dl>
      {canEdit(agent, f) ? (
        <button className="secondary-button edit-family" onClick={onEdit}>
          <Pencil size={16} />
          Editar cadastro
        </button>
      ) : (
        <p className="helper">
          A edição está disponível ao agente que cadastrou a família e à gestão.
        </p>
      )}
    </article>
  );
}
