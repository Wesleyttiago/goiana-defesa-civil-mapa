"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { Check, Crosshair, MapPin, Save, X } from "lucide-react";
import {
  blankDraft,
  LEVEL_LABELS,
  SITUATION_LABELS,
  TYPE_LABELS,
  validPosition,
  validateDraft,
  type Family,
  type FamilyDraft,
} from "@/lib/domain";

const GeoMap = dynamic(() => import("./geo-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Carregando mapa…</div>,
});

interface Props {
  family?: Family;
  onClose: () => void;
  onSave: (draft: FamilyDraft, previous?: Family) => Promise<void>;
  demo: boolean;
}

export default function FamilyForm({ family, onClose, onSave, demo }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<FamilyDraft>(() =>
    family ? { ...family } : blankDraft(),
  );
  const [confirmed, setConfirmed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [geoNotice, setGeoNotice] = useState("");
  const firstError = useRef<HTMLParagraphElement>(null);
  const position = validPosition(draft.latitude, draft.longitude)
    ? ([draft.latitude, draft.longitude] as [number, number])
    : undefined;

  useEffect(() => {
    dialog.current?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  useEffect(() => {
    if (error) firstError.current?.focus();
  }, [error]);

  function change<K extends keyof FamilyDraft>(key: K, value: FamilyDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
    if (key === "latitude" || key === "longitude" || key === "endereco")
      setConfirmed(false);
  }

  function choosePosition([latitude, longitude]: [number, number]) {
    setDraft((d) => ({ ...d, latitude, longitude }));
    setConfirmed(false);
    setDirty(true);
  }

  function close() {
    if (saving) return;
    if (!dirty || window.confirm("Descartar as alterações deste formulário?"))
      onClose();
  }

  function locate() {
    if (!navigator.geolocation) {
      setGeoNotice(
        "Este dispositivo não oferece localização. Marque a casa no mapa.",
      );
      return;
    }
    setLocating(true);
    setGeoNotice("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        if (!validPosition(p.coords.latitude, p.coords.longitude)) {
          setGeoNotice(
            "O GPS está fora da região de Goiana. Marque a residência no mapa.",
          );
          return;
        }
        choosePosition([p.coords.latitude, p.coords.longitude]);
        setGeoNotice(
          `Localização com precisão aproximada de ${Math.round(p.coords.accuracy)} m. Confira e ajuste o ponto até a residência.`,
        );
      },
      () => {
        setLocating(false);
        setGeoNotice(
          "Não foi possível usar o GPS. Confira a permissão do navegador ou marque a casa no mapa.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const validation = validateDraft(draft);
    if (validation) {
      setError(validation);
      return;
    }
    if (!confirmed) {
      setError("Confirme que o ponto está sobre a residência antes de salvar.");
      return;
    }
    setSaving(true);
    try {
      await onSave(draft, family);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="family-dialog"
      aria-labelledby="form-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <form onSubmit={submit} noValidate>
        <header className="drawer-heading">
          <div>
            <span className="eyebrow">CADASTRO TERRITORIAL</span>
            <h2 id="form-title">
              {family ? "Editar família" : "Cadastrar família"}
            </h2>
            <p>Identifique a família e confirme onde ela mora.</p>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={close}
            disabled={saving}
            aria-label="Fechar cadastro"
          >
            <X size={22} />
          </button>
        </header>
        <div className="drawer-body">
          {demo && (
            <div className="notice compact">
              Demonstração: utilize somente informações fictícias. Os dados
              ficam nesta aba do navegador.
            </div>
          )}
          {error && (
            <p
              className="form-error"
              role="alert"
              ref={firstError}
              tabIndex={-1}
            >
              {error}
            </p>
          )}
          <fieldset disabled={saving}>
            <legend>
              <span className="step-number">1</span> Família e residência
            </legend>
            <label>
              Responsável pela família <span aria-hidden="true">*</span>
              <input
                name="responsavel"
                autoFocus
                value={draft.responsavel}
                onChange={(e) => change("responsavel", e.target.value)}
                maxLength={120}
                required
                autoComplete="off"
                placeholder={
                  demo
                    ? "Nome fictício para demonstração"
                    : "Nome completo do responsável"
                }
              />
            </label>
            <div className="form-grid">
              <label>
                Número de moradores *
                <input
                  name="pessoas"
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  value={Number.isNaN(draft.pessoas) ? "" : draft.pessoas}
                  onChange={(e) =>
                    change(
                      "pessoas",
                      e.target.value === "" ? NaN : Number(e.target.value),
                    )
                  }
                  required
                />
              </label>
              <label>
                Telefone <span className="optional">opcional</span>
                <input
                  name="telefone"
                  type="tel"
                  value={draft.telefone}
                  onChange={(e) => change("telefone", e.target.value)}
                  maxLength={22}
                  placeholder="(81) 90000-0000"
                  autoComplete="off"
                />
              </label>
            </div>
            <label>
              Rua e número *
              <input
                name="endereco"
                value={draft.endereco}
                onChange={(e) => change("endereco", e.target.value)}
                maxLength={240}
                required
                placeholder="Rua, número ou s/n"
                autoComplete="off"
              />
            </label>
            <label>
              Bairro ou comunidade *
              <input
                name="bairro"
                value={draft.bairro}
                onChange={(e) => change("bairro", e.target.value)}
                maxLength={100}
                required
                autoComplete="off"
              />
            </label>
            <label>
              Ponto de referência <span className="optional">opcional</span>
              <input
                name="referencia"
                value={draft.referencia}
                onChange={(e) => change("referencia", e.target.value)}
                maxLength={240}
                autoComplete="off"
              />
            </label>
          </fieldset>
          <fieldset disabled={saving}>
            <legend>
              <span className="step-number">2</span> Localização da residência
            </legend>
            <div className="location-instruction">
              <p>
                <MapPin size={17} /> Clique na residência ou arraste o ponto
                para ajustar.
              </p>
              <button
                type="button"
                className="text-button"
                onClick={locate}
                disabled={locating}
              >
                <Crosshair size={16} />
                {locating ? "Localizando…" : "Usar GPS"}
              </button>
            </div>
            {geoNotice && (
              <p className="helper" role="status">
                {geoNotice}
              </p>
            )}
            <div className="picker-container">
              <GeoMap picker position={position} onPick={choosePosition} />
            </div>
            <p className="helper">
              Também é possível informar coordenadas. Use o mapa para conferir a
              casa; o GPS pode apontar para a rua ou para um imóvel vizinho.
            </p>
            <div className="form-grid coordinates">
              <label>
                Latitude *
                <input
                  name="latitude"
                  type="number"
                  step="any"
                  value={Number.isNaN(draft.latitude) ? "" : draft.latitude}
                  onChange={(e) =>
                    change(
                      "latitude",
                      e.target.value === "" ? NaN : Number(e.target.value),
                    )
                  }
                  placeholder="-7.560600"
                  required
                />
              </label>
              <label>
                Longitude *
                <input
                  name="longitude"
                  type="number"
                  step="any"
                  value={Number.isNaN(draft.longitude) ? "" : draft.longitude}
                  onChange={(e) =>
                    change(
                      "longitude",
                      e.target.value === "" ? NaN : Number(e.target.value),
                    )
                  }
                  placeholder="-35.002500"
                  required
                />
              </label>
            </div>
            <label className={`confirm-location ${confirmed ? "checked" : ""}`}>
              <input
                type="checkbox"
                name="localizacao-confirmada"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={!position}
              />
              <span>
                {confirmed && <Check size={15} />} Conferi que o ponto está
                sobre a residência.
              </span>
            </label>
          </fieldset>
          <fieldset disabled={saving}>
            <legend>
              <span className="step-number">3</span> Avaliação e acompanhamento
            </legend>
            <div className="form-grid">
              <label>
                Tipo de risco *
                <select
                  name="tipo_risco"
                  value={draft.tipo_risco}
                  onChange={(e) =>
                    change(
                      "tipo_risco",
                      e.target.value as FamilyDraft["tipo_risco"],
                    )
                  }
                >
                  {Object.entries(TYPE_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nível de risco *
                <select
                  name="nivel_risco"
                  value={draft.nivel_risco}
                  onChange={(e) =>
                    change(
                      "nivel_risco",
                      e.target.value as FamilyDraft["nivel_risco"],
                    )
                  }
                >
                  {Object.entries(LEVEL_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="helper">
              Classificação informada pelo agente responsável, conforme
              avaliação da equipe. O mapa não calcula risco automaticamente.
            </p>
            <label>
              Situação do atendimento *
              <select
                name="situacao"
                value={draft.situacao}
                onChange={(e) =>
                  change("situacao", e.target.value as FamilyDraft["situacao"])
                }
              >
                {Object.entries(SITUATION_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Observações <span className="optional">opcional</span>
              <textarea
                name="observacoes"
                rows={3}
                value={draft.observacoes}
                onChange={(e) => change("observacoes", e.target.value)}
                maxLength={2000}
                placeholder="Registre apenas informações necessárias para o acompanhamento."
              />
            </label>
          </fieldset>
        </div>
        <footer className="drawer-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={close}
            disabled={saving}
          >
            Cancelar
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            <Save size={17} />
            {saving
              ? "Salvando…"
              : family
                ? "Salvar alterações"
                : "Salvar família"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
