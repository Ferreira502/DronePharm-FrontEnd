const STORAGE_KEY = "dronepharm-order-lifecycle-v2";
const STAGES = [
  { status: "pendente", offsetMs: 0, label: "Aguardando triagem" },
  { status: "calculado", offsetMs: 6000, label: "Rota calculada" },
  { status: "despachado", offsetMs: 12000, label: "Missao despachada" },
  { status: "em_voo", offsetMs: 18000, label: "Drone em rota" },
];
const STATUS_RANK = Object.freeze({
  pendente: 0,
  calculado: 1,
  despachado: 2,
  em_voo: 3,
  entregue: 4,
  cancelado: 4,
  falha: 4,
});

function nowMs() {
  return Date.now();
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function readStore() {
  if (typeof localStorage === "undefined") {
    return {};
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeStore(store) {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function getOrderTime(rawOrder = {}) {
  return rawOrder.criado_em || rawOrder.horario_pedido || rawOrder.created_at || rawOrder.createdAt || null;
}

function isTerminalStatus(status) {
  return ["entregue", "cancelado", "falha"].includes(normalizeStatus(status));
}

function shouldResetMeta(existing, rawOrder) {
  if (!existing.createdAt) {
    return true;
  }

  if (getOrderTime(rawOrder)) {
    return false;
  }

  const nextStatus = normalizeStatus(rawOrder.status);
  if (!nextStatus) {
    return false;
  }

  if (isTerminalStatus(existing.manualStatus) && !isTerminalStatus(nextStatus)) {
    return true;
  }

  if (existing.droneId && rawOrder.drone_id && String(existing.droneId) !== String(rawOrder.drone_id)) {
    return true;
  }

  if (existing.routeId && (rawOrder.rota_id || rawOrder.route_id) && Number(existing.routeId) !== Number(rawOrder.rota_id || rawOrder.route_id)) {
    return true;
  }

  return false;
}

function ensureMetaForOrder(store, rawOrder) {
  const id = String(rawOrder.id);
  const existing = store[id] || {};
  const sourceCreatedAt = getOrderTime(rawOrder);
  const createdAt = sourceCreatedAt || (shouldResetMeta(existing, rawOrder) ? new Date().toISOString() : existing.createdAt);
  const serverStatus = normalizeStatus(rawOrder.status);
  const persistedStatus = normalizeStatus(serverStatus || existing.manualStatus || "pendente");
  const droneId = existing.droneId || rawOrder.drone_id || `DP-${String(rawOrder.id).padStart(2, "0")}`;
  const routeId = existing.routeId || rawOrder.rota_id || rawOrder.route_id || Number(rawOrder.id);

  store[id] = {
    createdAt,
    manualStatus: persistedStatus,
    droneId,
    routeId,
    updatedAt: existing.updatedAt || nowMs(),
  };

  return store[id];
}

function getAutomaticStatus(meta, referenceTime = nowMs()) {
  const manualStatus = normalizeStatus(meta.manualStatus);
  if (isTerminalStatus(manualStatus)) {
    return manualStatus;
  }

  const createdMs = Date.parse(meta.createdAt);
  if (!Number.isFinite(createdMs)) {
    return "pendente";
  }

  const elapsed = Math.max(0, referenceTime - createdMs);
  let current = STAGES[0];

  for (const stage of STAGES) {
    if (elapsed >= stage.offsetMs) {
      current = stage;
    }
  }

  const manualRank = STATUS_RANK[manualStatus] ?? 0;
  const automaticRank = STATUS_RANK[current.status] ?? 0;
  return manualRank > automaticRank ? manualStatus : current.status;
}

function getStageMeta(status) {
  return STAGES.find((stage) => stage.status === status) || STAGES[0];
}

function formatRelativeDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0s";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function buildOrderView(rawOrder, meta, referenceTime = nowMs()) {
  const status = getAutomaticStatus(meta, referenceTime);
  const createdMs = Date.parse(meta.createdAt);
  const safeCreatedMs = Number.isFinite(createdMs) ? createdMs : referenceTime;
  const elapsedMs = Math.max(0, referenceTime - safeCreatedMs);
  const terminal = isTerminalStatus(status);
  const stageMeta = getStageMeta(status);
  const etaMs = terminal
    ? 0
    : Math.max(0, STAGES[STAGES.length - 1].offsetMs - elapsedMs);
  const progress = terminal
    ? 1
    : Math.min(1, elapsedMs / STAGES[STAGES.length - 1].offsetMs);

  return {
    ...rawOrder,
    status,
    drone_id: meta.droneId,
    rota_id: meta.routeId,
    lifecycle_label: stageMeta.label,
    tempo_decorrido_seg: Math.floor(elapsedMs / 1000),
    tempo_restante_seg: Math.floor(etaMs / 1000),
    elapsed_label: formatRelativeDuration(elapsedMs),
    eta_label: terminal ? "-" : formatRelativeDuration(etaMs),
    route_progress: progress,
    is_finalizado: terminal,
  };
}

function syncOrderStore(rawOrders = []) {
  const store = readStore();
  const referenceTime = nowMs();
  const activeIds = new Set(rawOrders.map((rawOrder) => String(rawOrder.id)));

  for (const key of Object.keys(store)) {
    if (!activeIds.has(key) && isTerminalStatus(store[key]?.manualStatus)) {
      delete store[key];
    }
  }

  for (const rawOrder of rawOrders) {
    ensureMetaForOrder(store, rawOrder);
  }

  writeStore(store);
  return rawOrders.map((rawOrder) => buildOrderView(rawOrder, store[String(rawOrder.id)], referenceTime));
}

function updateManualStatus(id, status) {
  const store = readStore();
  const key = String(id);
  const existing = store[key] || {
    createdAt: new Date().toISOString(),
    droneId: `DP-${String(id).padStart(2, "0")}`,
    routeId: Number(id),
  };

  store[key] = {
    ...existing,
    manualStatus: normalizeStatus(status),
    updatedAt: nowMs(),
  };

  writeStore(store);
}

function extractDeposito(snapshot) {
  return (snapshot.features || []).find((feature) => feature.properties?.tipo === "deposito") || null;
}

function routeAlreadyExists(snapshot, order) {
  return (snapshot.features || []).some((feature) => {
    if (feature.geometry?.type !== "LineString") {
      return false;
    }

    const pedidoIds = feature.properties?.pedido_ids;
    if (Array.isArray(pedidoIds) && pedidoIds.includes(order.id)) {
      return true;
    }

    return Number(feature.properties?.id) === Number(order.rota_id);
  });
}

function createSyntheticRouteFeature(deposito, order) {
  if (!deposito?.geometry?.coordinates) {
    return null;
  }

  const [depLon, depLat] = deposito.geometry.coordinates;
  const targetLon = order.longitude ?? order.destino_longitude;
  const targetLat = order.latitude ?? order.destino_latitude;

  if (!Number.isFinite(depLon) || !Number.isFinite(depLat) || !Number.isFinite(targetLon) || !Number.isFinite(targetLat)) {
    return null;
  }

  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [
        [depLon, depLat],
        [targetLon, targetLat],
      ],
    },
    properties: {
      id: order.rota_id,
      tipo: "rota_linha",
      status: order.status,
      drone_id: order.drone_id,
      pedido_ids: [order.id],
      cor: order.prioridade === 1 ? "#b42318" : order.prioridade === 2 ? "#1565c0" : "#157347",
      synthetic: true,
      route_progress: order.route_progress,
    },
  };
}

export function syncOrdersWithLifecycle(rawOrders = []) {
  return syncOrderStore(rawOrders);
}

export function registerCreatedOrder(rawOrder) {
  return syncOrderStore(rawOrder ? [rawOrder] : []);
}

export function markOrderAsCancelled(id) {
  updateManualStatus(id, "cancelado");
}

export function markOrderAsDelivered(id) {
  updateManualStatus(id, "entregue");
}

export function enhanceSnapshotWithLifecycle(snapshot) {
  const nextSnapshot = {
    ...snapshot,
    features: Array.isArray(snapshot.features) ? [...snapshot.features] : [],
  };
  const pedidoFeatures = nextSnapshot.features.filter((feature) => feature.properties?.tipo === "pedido");
  const orders = pedidoFeatures.map((feature) => ({
    id: feature.properties.id,
    status: feature.properties.status,
    prioridade: feature.properties.prioridade,
    descricao: feature.properties.descricao,
    farmacia_id: feature.properties.farmacia_id,
    rota_id: feature.properties.rota_id,
    drone_id: feature.properties.drone_id,
    criado_em: feature.properties.criado_em,
    created_at: feature.properties.created_at,
    latitude: feature.geometry?.coordinates?.[1],
    longitude: feature.geometry?.coordinates?.[0],
  }));
  const enhancedOrders = syncOrderStore(orders);
  const orderMap = new Map(enhancedOrders.map((order) => [Number(order.id), order]));
  const deposito = extractDeposito(nextSnapshot);

  nextSnapshot.features = nextSnapshot.features.flatMap((feature) => {
    if (feature.properties?.tipo !== "pedido") {
      if (feature.geometry?.type === "LineString") {
        const relatedOrderId = feature.properties?.pedido_ids?.[0];
        const relatedOrder = orderMap.get(Number(relatedOrderId));
        if (relatedOrder) {
          return [{
            ...feature,
            properties: {
              ...feature.properties,
              status: relatedOrder.status,
              drone_id: relatedOrder.drone_id,
              route_progress: relatedOrder.route_progress,
            },
          }];
        }
      }

      return [feature];
    }

    const enhancedOrder = orderMap.get(Number(feature.properties.id));
    if (!enhancedOrder) {
      return [feature];
    }

    const nextFeature = {
      ...feature,
      properties: {
        ...feature.properties,
        status: enhancedOrder.status,
        drone_id: enhancedOrder.drone_id,
        rota_id: enhancedOrder.rota_id,
        tempo_decorrido_seg: enhancedOrder.tempo_decorrido_seg,
        tempo_restante_seg: enhancedOrder.tempo_restante_seg,
        route_progress: enhancedOrder.route_progress,
      },
    };

    const syntheticRoute = !enhancedOrder.is_finalizado && !routeAlreadyExists(nextSnapshot, enhancedOrder)
      ? createSyntheticRouteFeature(deposito, enhancedOrder)
      : null;

    return syntheticRoute ? [nextFeature, syntheticRoute] : [nextFeature];
  });

  return nextSnapshot;
}
