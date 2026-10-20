"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import {
  GOIANA_CENTER,
  GOIANA_VIEW_BOUNDS,
  LEVEL_COLORS,
  LEVEL_LABELS,
  validPosition,
  type Family,
} from "@/lib/domain";

interface Props {
  families?: Family[];
  selectedId?: string;
  onSelect?: (family: Family) => void;
  heat?: boolean;
  fitToken?: number;
  picker?: boolean;
  position?: [number, number];
  onPick?: (position: [number, number]) => void;
}

export default function GeoMap({
  families = [],
  selectedId,
  onSelect,
  heat = false,
  fitToken = 0,
  picker = false,
  position,
  onPick,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const library = useRef<typeof Leaflet | null>(null);
  const pickCallback = useRef(onPick);
  pickCallback.current = onPick;
  const [ready, setReady] = useState(false);
  const [tileFailed, setTileFailed] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let disposed = false;
    let map: Leaflet.Map | undefined;
    let resize: ResizeObserver | undefined;
    let errors = 0;
    setError("");
    setTileFailed(false);
    setReady(false);
    async function start() {
      const L = (await import("leaflet")).default;
      (window as unknown as { L: typeof Leaflet }).L = L;
      await import("leaflet.heat");
      if (disposed || !container.current) return;
      library.current = L;
      map = L.map(container.current, {
        center: GOIANA_CENTER,
        zoom: picker ? 16 : 14,
        minZoom: 10,
        maxZoom: 19,
        maxBounds: L.latLngBounds(GOIANA_VIEW_BOUNDS).pad(0.25),
        maxBoundsViscosity: 0.75,
        zoomControl: false,
        attributionControl: true,
      });
      mapRef.current = map;
      map.attributionControl.setPrefix(
        '<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>',
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      })
        .on("tileerror", () => {
          errors++;
          if (errors >= 2 && !disposed) setTileFailed(true);
        })
        .on("tileload", () => {
          errors = 0;
          if (!disposed) setTileFailed(false);
        })
        .addTo(map);
      L.control
        .zoom({
          position: "topright",
          zoomInTitle: "Aproximar",
          zoomOutTitle: "Afastar",
        })
        .addTo(map);
      L.control.scale({ position: "bottomright", imperial: false }).addTo(map);
      if (picker)
        map.on("click", (e) =>
          pickCallback.current?.([e.latlng.lat, e.latlng.lng]),
        );
      resize = new ResizeObserver(() => map?.invalidateSize());
      resize.observe(container.current);
      setReady(true);
    }
    start().catch(() => {
      if (!disposed)
        setError("Não foi possível iniciar o mapa. Tente novamente.");
    });
    return () => {
      disposed = true;
      resize?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, [picker, retry]);

  useEffect(() => {
    const map = mapRef.current;
    const L = library.current;
    if (!ready || !map || !L || picker) return;
    const layer = L.layerGroup().addTo(map);
    function render() {
      layer.clearLayers();
      if (heat) {
        L!
          .heatLayer(
            families.map((f) => [f.latitude, f.longitude, 1]),
            {
              radius: 34,
              blur: 25,
              maxZoom: 17,
              minOpacity: 0.35,
              gradient: {
                0.2: "#3d8ed7",
                0.45: "#36af9b",
                0.65: "#efce50",
                0.85: "#e88e35",
                1: "#c63e3e",
              },
            },
          )
          .addTo(layer);
        return;
      }
      const groups = new Map<string, Family[]>();
      const zoom = map!.getZoom();
      families.forEach((f) => {
        const pixel = map!.project([f.latitude, f.longitude], zoom);
        const key =
          zoom < 17
            ? `${Math.floor(pixel.x / 55)}:${Math.floor(pixel.y / 55)}`
            : f.id;
        const group = groups.get(key) || [];
        group.push(f);
        groups.set(key, group);
      });
      groups.forEach((group) => {
        if (group.length > 1) {
          const lat =
            group.reduce((sum, f) => sum + f.latitude, 0) / group.length;
          const lng =
            group.reduce((sum, f) => sum + f.longitude, 0) / group.length;
          L!
            .marker([lat, lng], {
              icon: L!.divIcon({
                className: "cluster-marker",
                html: `<span>${group.length}</span>`,
                iconSize: [42, 42],
                iconAnchor: [21, 21],
              }),
              title: `${group.length} famílias. Ative para aproximar.`,
            })
            .on("click", () =>
              map!.fitBounds(
                L!.latLngBounds(group.map((f) => [f.latitude, f.longitude])),
                { maxZoom: Math.min(zoom + 3, 18), padding: [65, 65] },
              ),
            )
            .addTo(layer);
          return;
        }
        const f = group[0];
        const selected = f.id === selectedId;
        const marker = L!.marker([f.latitude, f.longitude], {
          icon: L!.divIcon({
            className: `family-marker ${selected ? "selected" : ""}`,
            html: `<span style="--pin-color:${LEVEL_COLORS[f.nivel_risco]}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 11 7-6 7 6v8H5z"/><path d="M10 19v-6h4v6"/></svg></span>`,
            iconSize: [34, 42],
            iconAnchor: [17, 40],
            tooltipAnchor: [0, -38],
          }),
          title: `${f.responsavel} · Risco ${LEVEL_LABELS[f.nivel_risco]}`,
          alt: `Localização de ${f.responsavel}`,
          zIndexOffset: selected ? 500 : 0,
        });
        const label = document.createElement("span");
        label.textContent = `${f.responsavel} · Risco ${LEVEL_LABELS[f.nivel_risco].toLowerCase()}`;
        marker
          .bindTooltip(label)
          .on("click", () => onSelect?.(f))
          .addTo(layer);
      });
    }
    render();
    map.on("zoomend", render);
    return () => {
      map.off("zoomend", render);
      layer.remove();
    };
  }, [ready, families, selectedId, onSelect, heat, picker]);

  const selectedLatitude = families.find((f) => f.id === selectedId)?.latitude;
  const selectedLongitude = families.find(
    (f) => f.id === selectedId,
  )?.longitude;
  useEffect(() => {
    if (!ready || !selectedId || picker) return;
    if (selectedLatitude !== undefined && selectedLongitude !== undefined)
      mapRef.current?.setView([selectedLatitude, selectedLongitude], 18, {
        animate: false,
      });
  }, [selectedId, selectedLatitude, selectedLongitude, ready, picker]);

  useEffect(() => {
    if (!ready || picker) return;
    if (families.length && library.current)
      mapRef.current?.fitBounds(
        library.current.latLngBounds(
          families.map((f) => [f.latitude, f.longitude]),
        ),
        { padding: [55, 55], maxZoom: 16 },
      );
    else mapRef.current?.setView(GOIANA_CENTER, 14);
    // A visualização só é reajustada quando o agente pede.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToken, ready, picker]);

  useEffect(() => {
    const map = mapRef.current;
    const L = library.current;
    if (
      !picker ||
      !ready ||
      !map ||
      !L ||
      !position ||
      !validPosition(...position)
    )
      return;
    const marker = L.marker(position, {
      draggable: true,
      title: "Residência selecionada. Arraste para ajustar.",
      icon: L.divIcon({
        className: "picker-marker",
        html: "<span></span>",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    })
      .on("dragend", () => {
        const p = marker.getLatLng();
        pickCallback.current?.([p.lat, p.lng]);
      })
      .addTo(map);
    map.panTo(position, { animate: false });
    return () => {
      marker.remove();
    };
  }, [picker, ready, position]);

  return (
    <div className={`geo-wrap ${picker ? "picking" : ""}`}>
      <div
        ref={container}
        className="geo-map"
        role="region"
        aria-label={
          picker
            ? "Selecione a residência no mapa de Goiana"
            : "Mapa das famílias cadastradas em Goiana"
        }
      />
      {!ready && !error && (
        <div className="map-loading" role="status">
          Carregando mapa de Goiana…
        </div>
      )}
      {(error || tileFailed) && (
        <div className="map-error" role="alert">
          <span>
            {error ||
              "O mapa de ruas não carregou. Confira a conexão com a internet."}
          </span>
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
