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
    };
  }

  clear() {
    Object.values(this.layers).forEach((layer) => layer.clearLayers());
  }

  drawSnapshot(snapshot) {
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

        L.polyline(latLngs, {
          color: properties.cor || "#197278",
          weight: 4,
          opacity: 0.85,
        })
          .bindPopup(
            `<strong>Rota #${properties.id}</strong><br>Drone: ${properties.drone_id || "-"}<br>Status: ${properties.status || "-"}`
          )
          .addTo(this.layers.rotas);
      }
    }

    if (bounds.length) {
      this.map.fitBounds(bounds, { padding: [30, 30] });
    }
  }
}
