function colorByPriority(priority) {
  if (priority === 1) {
    return "#b42318";
  }

  if (priority === 2) {
    return "#1565c0";
  }

  return "#157347";
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function isVisiblePedidoStatus(status) {
  const normalized = normalizeStatus(status);
  return [
    "pendente",
    "novo",
    "aberto",
    "aguardando",
    "aguardando_coleta",
    "aguardando coleta",
    "em_preparo",
    "em preparo",
    "calculado",
    "despachado",
    "em_rota",
    "em rota",
    "em_voo",
    "em voo",
    "despachado",
    "ativo",
  ].includes(normalized);
}

function isVisibleRouteStatus(status) {
  const normalized = normalizeStatus(status);
  return [
    "planejada",
    "ativa",
    "calculada",
    "despachada",
    "despachado",
    "calculado",
    "em_rota",
    "em rota",
    "em_voo",
    "em voo",
    "despachada",
    "em_andamento",
    "em andamento",
  ].includes(normalized);
}

function isFinalizedStatus(status) {
  const normalized = normalizeStatus(status);
  return ["cancelado", "entregue", "concluido", "concluído", "finalizado"].includes(normalized);
}

function interpolatePoint(latLngs, progress) {
  if (latLngs.length <= 1) {
    return latLngs[0] || [0, 0];
  }

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const targetSegment = clampedProgress * (latLngs.length - 1);
  const segmentIndex = Math.min(latLngs.length - 2, Math.floor(targetSegment));
  const localProgress = targetSegment - segmentIndex;
  const [startLat, startLng] = latLngs[segmentIndex];
  const [endLat, endLng] = latLngs[segmentIndex + 1];

  return [
    startLat + (endLat - startLat) * localProgress,
    startLng + (endLng - startLng) * localProgress,
  ];
}

export class MapView {
  constructor(elementId) {
    this.map = L.map(elementId).setView([-19.92, -43.94], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(this.map);

    this.layers = {
      deposito: L.layerGroup().addTo(this.map),
      pedidos: L.layerGroup().addTo(this.map),
      rotas: L.layerGroup().addTo(this.map),
      frota: L.layerGroup().addTo(this.map),
      animacao: L.layerGroup().addTo(this.map),
    };
    this.animationFrames = [];
    this.hasFittedBounds = false;
  }

  clear() {
    this.stopAnimations();
    Object.values(this.layers).forEach((layer) => layer.clearLayers());
  }

  stopAnimations() {
    for (const cancel of this.animationFrames) {
      cancel();
    }

    this.animationFrames = [];
  }

  createRouteMarker(latLngs, color, progress, animate = true) {
    if (!latLngs.length) {
      return;
    }

    const marker = L.marker(interpolatePoint(latLngs, progress), {
      interactive: false,
      icon: L.divIcon({
        className: "route-drone-icon",
        html: `<span class="route-drone-ping" style="--route-color:${color};"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    }).addTo(this.layers.animacao);

    if (!animate) {
      return;
    }

    let direction = 1;
    let animatedProgress = progress;
    let previousTimestamp;
    let frameId = 0;

    const step = (timestamp) => {
      if (!previousTimestamp) {
        previousTimestamp = timestamp;
      }

      const delta = timestamp - previousTimestamp;
      previousTimestamp = timestamp;
      const speed = progress >= 0.98 ? 0.00008 : 0.00022;
      animatedProgress += direction * delta * speed;

      if (animatedProgress >= 1) {
        animatedProgress = 1;
        direction = -1;
      } else if (animatedProgress <= progress) {
        animatedProgress = progress;
        direction = 1;
      }

      marker.setLatLng(interpolatePoint(latLngs, animatedProgress));
      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
    this.animationFrames.push(() => cancelAnimationFrame(frameId));
  }

  drawSnapshot(snapshot, options = {}) {
    const { fitBounds = true, animateRoutes = true } = options;
    this.clear();
    const bounds = [];

    for (const feature of snapshot.features || []) {
      const { geometry, properties } = feature;
      if (!geometry || !properties) {
        continue;
      }

      if (geometry.type === "Point") {
        const [longitude, latitude] = geometry.coordinates;
        bounds.push([latitude, longitude]);

        if (properties.tipo === "deposito") {
          L.circleMarker([latitude, longitude], {
            radius: 10,
            color: "#0b4f7d",
            fillColor: "#0b4f7d",
            fillOpacity: 0.85,
          })
            .bindPopup(`<strong>Deposito:</strong> ${properties.nome || properties.id}`)
            .addTo(this.layers.deposito);
        } else if (properties.tipo === "pedido") {
          if (!isVisiblePedidoStatus(properties.status) || isFinalizedStatus(properties.status)) {
            continue;
          }

          L.circleMarker([latitude, longitude], {
            radius: 7,
            color: colorByPriority(properties.prioridade),
            fillColor: colorByPriority(properties.prioridade),
            fillOpacity: 0.85,
          })
            .bindPopup(
              `<strong>Pedido #${properties.id}</strong><br>Status: ${properties.status || "-"}<br>Prioridade: ${properties.prioridade || "-"}`
            )
            .addTo(this.layers.pedidos);
        } else if (properties.tipo === "drone") {
          L.circleMarker([latitude, longitude], {
            radius: 8,
            color: "#7c3aed",
            fillColor: "#7c3aed",
            fillOpacity: 0.9,
          })
            .bindPopup(
              `<strong>${properties.nome || properties.id}</strong><br>Status: ${properties.status || "-"}<br>Bateria: ${properties.bateria_pct || "-"}%`
            )
            .addTo(this.layers.frota);
        }
      }

      if (geometry.type === "LineString") {
        if (!isVisibleRouteStatus(properties.status) || isFinalizedStatus(properties.status)) {
          continue;
        }

        const latLngs = geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]);
        latLngs.forEach((point) => bounds.push(point));
        const routeColor = properties.cor || "#197278";
        const routeProgress = Number(properties.route_progress ?? 0.15);

        L.polyline(latLngs, {
          color: routeColor,
          weight: 4,
          opacity: 0.85,
          dashArray: "10 8",
        })
          .bindPopup(
            `<strong>Rota #${properties.id}</strong><br>Drone: ${properties.drone_id || "-"}<br>Status: ${properties.status || "-"}`
          )
          .addTo(this.layers.rotas);

        L.polyline(latLngs, {
          color: routeColor,
          weight: 10,
          opacity: 0.08,
        }).addTo(this.layers.rotas);

        this.createRouteMarker(latLngs, routeColor, routeProgress, animateRoutes);
      }
    }

    if (bounds.length && (fitBounds || !this.hasFittedBounds)) {
      this.map.fitBounds(bounds, { padding: [30, 30] });
      this.hasFittedBounds = true;
    }
  }
}
