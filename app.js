const state = {
  apiBase: "http://localhost:8000",
  wsToken: "",
  restToken: "",
  endpoints: {
    pedidosPost: "/api/v1/pedidos/",
    pedidosList: "/api/v1/pedidos/",
    pedidoCancelarPrefix: "/api/v1/pedidos/",
    frotaStatus: "/api/v1/frota/status",
    historicoList: "/api/v1/historico",
    historicoKpis: "/api/v1/historico/kpis",
    mapaSnapshot: "/api/v1/mapa/snapshot",
    wsTelemetria: "/ws/telemetria",
    wsAlertas: "/ws/alertas",
    farmaciasList: "/api/v1/farmacias/",
    dronesList: "/api/v1/drones/",
  },
  map: null,
  layers: {
    deposito: null,
    pedidos: null,
    rotas: null,
    frota: null,
  },
  sockets: [],
  reportCache: null,
};

const els = {
  configForm: document.getElementById("config-form"),
  apiBaseUrl: document.getElementById("api-base-url"),
  wsToken: document.getElementById("ws-token"),
  restToken: document.getElementById("rest-token"),
  connectionPill: document.getElementById("connection-pill"),
  refreshMapBtn: document.getElementById("refresh-map-btn"),
  alertsList: document.getElementById("alerts-list"),
  droneList: document.getElementById("drone-list"),
  pedidoForm: document.getElementById("pedido-form"),
  farmaciaForm: document.getElementById("farmacia-form"),
  droneForm: document.getElementById("drone-form"),
  refreshGestaoBtn: document.getElementById("refresh-gestao-btn"),
  dronesBody: document.getElementById("drones-body"),
  farmaciasBody: document.getElementById("farmacias-body"),
  pedidosBody: document.getElementById("pedidos-body"),
  historicoBody: document.getElementById("historico-body"),
  exportBtn: document.getElementById("export-report-btn"),
  kpi: {
    totalDrones: document.getElementById("kpi-total-drones"),
    emVoo: document.getElementById("kpi-em-voo"),
    alertaBateria: document.getElementById("kpi-alerta-bateria"),
    entregas: document.getElementById("kpi-entregas"),
    pontualidade: document.getElementById("kpi-pontualidade"),
    tempoMedio: document.getElementById("kpi-tempo-medio"),
    pesoTotal: document.getElementById("kpi-peso-total"),
  },
};

function setConnection(status, label) {
  els.connectionPill.textContent = label;
  els.connectionPill.className = `pill ${status}`;
}

function addAlert(message, severity = "info") {
  const li = document.createElement("li");
  li.className = `alert-${severity}`;
  li.innerHTML = `<strong>${new Date().toLocaleTimeString()}</strong> · ${message}`;
  els.alertsList.prepend(li);
  while (els.alertsList.children.length > 12) {
    els.alertsList.removeChild(els.alertsList.lastChild);
  }
}

function buildHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (state.restToken) {
    headers.Authorization = `Bearer ${state.restToken}`;
  }
  return headers;
}

function toPathFromAbsolute(urlLike, fallbackPath) {
  try {
    const parsed = new URL(urlLike);
    return `${parsed.pathname}${parsed.search}`;
  } catch (_) {
    return fallbackPath;
  }
}

function deriveBasePath(path, fallbackBase) {
  if (!path) return fallbackBase;
  const idx = path.lastIndexOf("/");
  if (idx <= 0) return fallbackBase;
  return path.slice(0, idx);
}

async function api(path, options = {}) {
  const url = `${state.apiBase}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...buildHeaders(),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }
  return response.json();
}

async function discoverBackendEndpoints() {
  try {
    const root = await fetch(`${state.apiBase}/`);
    if (!root.ok) return;
    const payload = await root.json();
    const http = payload.endpoints_http || {};
    const ws = payload.endpoints_ws || {};

    const pedidosBase = http.pedidos || "/api/v1/pedidos";
    const farmaciasBase = http.farmacias || "/api/v1/farmacias";
    const dronesBase = http.drones || "/api/v1/drones";
    const historicoBase = http.historico || "/api/v1/historico";
    const mapaBase = deriveBasePath(http.mapa || "/api/v1/mapa/rotas", "/api/v1/mapa");

    state.endpoints.pedidosPost = `${pedidosBase}/`;
    state.endpoints.pedidosList = `${pedidosBase}/`;
    state.endpoints.pedidoCancelarPrefix = `${pedidosBase}/`;
    state.endpoints.farmaciasList = `${farmaciasBase}/`;
    state.endpoints.dronesList = `${dronesBase}/`;
    state.endpoints.frotaStatus = http.frota || "/api/v1/frota/status";
    state.endpoints.historicoList = historicoBase;
    state.endpoints.historicoKpis = `${historicoBase}/kpis`;
    state.endpoints.mapaSnapshot = `${mapaBase}/snapshot`;
    state.endpoints.wsTelemetria = toPathFromAbsolute(ws.telemetria_global || "", "/ws/telemetria");
    state.endpoints.wsAlertas = toPathFromAbsolute(ws.alertas || "", "/ws/alertas");

    addAlert("Endpoints descobertos automaticamente no backend DronePharm.", "ok");
  } catch (_) {
    addAlert("Não foi possível descobrir endpoints via GET /. Usando rotas padrão.", "warn");
  }
}

async function carregarFarmacias() {
  try {
    const data = await api(state.endpoints.farmaciasList);
    const farmacias = data.farmacias || [];
    if (!farmacias.length) {
      addAlert("Nenhuma farmácia ativa encontrada. Cadastre uma em /docs.", "warn");
      return;
    }
    const primeira = farmacias[0];
    const inputFarmacia = document.querySelector("input[name='farmacia_id']");
    if (inputFarmacia && (!inputFarmacia.value || Number(inputFarmacia.value) <= 0)) {
      inputFarmacia.value = String(primeira.id);
    }
    addAlert(`Farmácias carregadas: ${farmacias.length}. ID sugerido: ${primeira.id}`, "ok");
  } catch (error) {
    addAlert(`Não foi possível carregar farmácias: ${error.message}`, "warn");
  }
}

function initMap() {
  state.map = L.map("map").setView([-19.92, -43.94], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(state.map);

  state.layers.deposito = L.layerGroup().addTo(state.map);
  state.layers.pedidos = L.layerGroup().addTo(state.map);
  state.layers.rotas = L.layerGroup().addTo(state.map);
  state.layers.frota = L.layerGroup().addTo(state.map);
}

function clearMapLayers() {
  Object.values(state.layers).forEach((layer) => layer.clearLayers());
}

function colorByPriority(prio) {
  if (prio === 1) return "#b42318";
  if (prio === 2) return "#1565c0";
  return "#157347";
}

function drawSnapshot(snapshot) {
  clearMapLayers();
  const bounds = [];

  for (const feature of snapshot.features || []) {
    const { geometry, properties } = feature;
    if (!geometry || !properties) continue;

    if (geometry.type === "Point") {
      const [lon, lat] = geometry.coordinates;
      bounds.push([lat, lon]);

      if (properties.tipo === "deposito") {
        L.circleMarker([lat, lon], {
          radius: 10,
          color: "#0b4f7d",
          fillColor: "#0b4f7d",
          fillOpacity: 0.85,
        })
          .bindPopup(`<strong>Depósito:</strong> ${properties.nome || properties.id}`)
          .addTo(state.layers.deposito);
      } else if (properties.tipo === "pedido") {
        L.circleMarker([lat, lon], {
          radius: 7,
          color: colorByPriority(properties.prioridade),
          fillColor: colorByPriority(properties.prioridade),
          fillOpacity: 0.85,
        })
          .bindPopup(
            `<strong>Pedido #${properties.id}</strong><br>Status: ${properties.status || "-"}<br>Prioridade: ${properties.prioridade || "-"}`
          )
          .addTo(state.layers.pedidos);
      } else if (properties.tipo === "drone") {
        L.circleMarker([lat, lon], {
          radius: 8,
          color: "#7c3aed",
          fillColor: "#7c3aed",
          fillOpacity: 0.9,
        })
          .bindPopup(
            `<strong>${properties.nome || properties.id}</strong><br>Status: ${properties.status || "-"}<br>Bateria: ${properties.bateria_pct || "-"}%`
          )
          .addTo(state.layers.frota);
      }
    }

    if (geometry.type === "LineString") {
      const latLngs = geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      latLngs.forEach((point) => bounds.push(point));
      L.polyline(latLngs, {
        color: properties.cor || "#197278",
        weight: 4,
        opacity: 0.85,
      })
        .bindPopup(
          `<strong>Rota #${properties.id}</strong><br>Drone: ${properties.drone_id || "-"}<br>Status: ${properties.status || "-"}`
        )
        .addTo(state.layers.rotas);
    }
  }

  if (bounds.length) {
    state.map.fitBounds(bounds, { padding: [30, 30] });
  }
}

function renderDroneList(drones = []) {
  els.droneList.innerHTML = "";
  for (const drone of drones) {
    const div = document.createElement("article");
    div.className = "drone-item";
    div.innerHTML = `
      <div class="title">${drone.nome || drone.id} · ${drone.status || "-"}</div>
      <div class="meta">Bateria: ${drone.bateria_pct ?? "-"}% | Missões: ${drone.missoes_realizadas ?? "-"}</div>
      <div class="meta">GPS: ${drone.latitude_atual ?? "-"}, ${drone.longitude_atual ?? "-"}</div>
    `;
    els.droneList.appendChild(div);
  }
}

function renderHistorico(rows = []) {
  els.historicoBody.innerHTML = "";
  for (const h of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>#${h.pedido_id}</td>
      <td>${h.drone_id}</td>
      <td>${h.farmacia_id}</td>
      <td>${h.tempo_real_min ?? "-"}</td>
      <td>${h.distancia_km ?? "-"}</td>
      <td>${h.entregue_no_prazo ? "Sim" : "Não"}</td>
    `;
    els.historicoBody.appendChild(tr);
  }
}

function updateFrotaKpis(resumo = {}) {
  els.kpi.totalDrones.textContent = resumo.total ?? 0;
  els.kpi.emVoo.textContent = resumo.em_voo ?? 0;
  els.kpi.alertaBateria.textContent = resumo.alerta_bateria ?? 0;
}

function updateReportKpis(kpi = {}) {
  els.kpi.entregas.textContent = kpi.total_entregas ?? 0;
  els.kpi.pontualidade.textContent = `${Number(kpi.taxa_pontualidade_pct ?? 0).toFixed(1)}%`;
  els.kpi.tempoMedio.textContent = `${Number(kpi.tempo_medio_min ?? 0).toFixed(1)} min`;
  els.kpi.pesoTotal.textContent = `${Number(kpi.peso_total_entregue_kg ?? 0).toFixed(2)} kg`;
}

async function refreshAll() {
  const [snapshotR, frotaR, historicoR, kpisR] = await Promise.allSettled([
    api(state.endpoints.mapaSnapshot),
    api(state.endpoints.frotaStatus),
    api(`${state.endpoints.historicoList}?limite=20`),
    api(state.endpoints.historicoKpis),
  ]);

  let okCount = 0;
  if (snapshotR.status === "fulfilled") {
    drawSnapshot(snapshotR.value);
    okCount += 1;
  }
  if (frotaR.status === "fulfilled") {
    updateFrotaKpis(frotaR.value.resumo || {});
    renderDroneList(frotaR.value.drones || []);
    okCount += 1;
  }
  if (historicoR.status === "fulfilled") {
    renderHistorico(historicoR.value.historico || []);
    okCount += 1;
  }
  if (kpisR.status === "fulfilled") {
    updateReportKpis(kpisR.value);
    okCount += 1;
  } else {
    // Mantém o dashboard funcional mesmo sem a view vw_kpis_gerais.
    updateReportKpis({});
  }

  state.reportCache = {
    snapshot: snapshotR.status === "fulfilled" ? snapshotR.value : null,
    frota: frotaR.status === "fulfilled" ? frotaR.value : null,
    historico: historicoR.status === "fulfilled" ? historicoR.value : null,
    kpis: kpisR.status === "fulfilled" ? kpisR.value : null,
    exported_at: new Date().toISOString(),
  };

  if (okCount >= 3) {
    setConnection("ok", "Conectado");
  } else {
    setConnection("warn", "Parcial");
  }

  if (snapshotR.status === "rejected") {
    addAlert(`Mapa indisponível: ${snapshotR.reason.message}`, "warn");
  }
  if (frotaR.status === "rejected") {
    addAlert(`Frota indisponível: ${frotaR.reason.message}`, "warn");
  }
  if (historicoR.status === "rejected") {
    addAlert(`Histórico indisponível: ${historicoR.reason.message}`, "warn");
  }
  if (kpisR.status === "rejected") {
    addAlert(`KPIs indisponíveis (view ausente no banco).`, "warn");
  }
}

function wsBaseUrl() {
  const url = new URL(state.apiBase);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${url.host}`;
}

function closeSockets() {
  for (const ws of state.sockets) {
    try {
      ws.close();
    } catch (_) {}
  }
  state.sockets = [];
}

function openSocket(path, onMessage) {
  const tokenQ = state.wsToken ? `?token=${encodeURIComponent(state.wsToken)}` : "";
  const socket = new WebSocket(`${wsBaseUrl()}${path}${tokenQ}`);
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      onMessage(payload);
    } catch (_) {}
  };
  socket.onopen = () => setConnection("ok", "Tempo real ativo");
  socket.onerror = () => setConnection("warn", "WS com falha");
  socket.onclose = () => setConnection("warn", "WS desconectado");
  state.sockets.push(socket);
}

function startRealtime() {
  closeSockets();

  openSocket(state.endpoints.wsTelemetria, (payload) => {
    if (payload.tipo === "telemetria") {
      addAlert(
        `Telemetria ${payload.drone_id}: bateria ${(payload.bateria_pct * 100).toFixed(1)}%, vento ${payload.vento_ms} m/s`,
        "info"
      );
      refreshAll();
    }
  });

  openSocket(state.endpoints.wsAlertas, (payload) => {
    const text = `${payload.tipo || "ALERTA"} · ${payload.drone_id || "-"} · ${payload.mensagem || "Evento crítico"}`;
    addAlert(text, payload.nivel === "CRITICO" ? "danger" : "warn");
  });
}

async function createPedido(formData) {
  const body = {
    coordenada: {
      latitude: Number(formData.get("latitude")),
      longitude: Number(formData.get("longitude")),
    },
    peso_kg: Number(formData.get("peso_kg")),
    prioridade: Number(formData.get("prioridade")),
    descricao: formData.get("descricao") || "",
    farmacia_id: Number(formData.get("farmacia_id")),
  };
  await api(state.endpoints.pedidosPost, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function createFarmacia(formData) {
  const body = {
    nome: String(formData.get("nome") || "").trim(),
    latitude: Number(formData.get("latitude")),
    longitude: Number(formData.get("longitude")),
    endereco: String(formData.get("endereco") || "").trim(),
    cidade: String(formData.get("cidade") || "").trim(),
    uf: String(formData.get("uf") || "").trim().toUpperCase(),
    deposito: Boolean(formData.get("deposito")),
  };
  await api(state.endpoints.farmaciasList, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function createDrone(formData) {
  const body = {
    id: String(formData.get("id") || "").trim(),
    nome: String(formData.get("nome") || "").trim(),
    capacidade_max_kg: Number(formData.get("capacidade_max_kg")),
    autonomia_max_km: Number(formData.get("autonomia_max_km")),
    velocidade_ms: Number(formData.get("velocidade_ms")),
  };
  await api(state.endpoints.dronesList, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function desativarFarmacia(id) {
  await api(`${state.endpoints.farmaciasList}${id}`, {
    method: "DELETE",
  });
}

async function cancelarPedido(id) {
  await api(`${state.endpoints.pedidoCancelarPrefix}${id}/cancelar`, {
    method: "PATCH",
  });
}

async function desativarDrone(id) {
  await api(`${state.endpoints.dronesList}${id}/status?status=manutencao`, {
    method: "PATCH",
  });
}

function renderGestaoDrones(drones = []) {
  if (!els.dronesBody) return;
  els.dronesBody.innerHTML = "";
  for (const d of drones) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.id}</td>
      <td>${d.nome}</td>
      <td>${d.status}</td>
      <td><button class="danger-btn" data-action="desativar-drone" data-id="${d.id}">Desativar</button></td>
    `;
    els.dronesBody.appendChild(tr);
  }
}

function renderGestaoFarmacias(farmacias = []) {
  if (!els.farmaciasBody) return;
  els.farmaciasBody.innerHTML = "";
  for (const f of farmacias) {
    const disabled = f.deposito ? "disabled" : "";
    const label = f.deposito ? "Depósito" : "Excluir";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${f.id}</td>
      <td>${f.nome}</td>
      <td>${f.deposito ? "Sim" : "Não"}</td>
      <td><button class="danger-btn" ${disabled} data-action="desativar-farmacia" data-id="${f.id}">${label}</button></td>
    `;
    els.farmaciasBody.appendChild(tr);
  }
}

function renderGestaoPedidos(pedidos = []) {
  if (!els.pedidosBody) return;
  els.pedidosBody.innerHTML = "";
  const visiveis = (pedidos || []).filter((p) => p.status !== "cancelado");
  for (const p of visiveis) {
    const disable = p.status !== "pendente" ? "disabled" : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.status}</td>
      <td>${p.farmacia_id}</td>
      <td><button class="danger-btn" ${disable} data-action="cancelar-pedido" data-id="${p.id}">Cancelar</button></td>
    `;
    els.pedidosBody.appendChild(tr);
  }
}

async function carregarGestao() {
  try {
    const [drones, farmacias, pedidos] = await Promise.all([
      api(state.endpoints.dronesList),
      api(state.endpoints.farmaciasList),
      api(`${state.endpoints.pedidosList}?limite=50`),
    ]);
    renderGestaoDrones(drones.drones || []);
    renderGestaoFarmacias(farmacias.farmacias || []);
    renderGestaoPedidos(pedidos.pedidos || []);
  } catch (error) {
    addAlert(`Falha ao carregar gestão: ${error.message}`, "warn");
  }
}

function downloadJSON(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  els.configForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.apiBase = els.apiBaseUrl.value.trim().replace(/\/$/, "");
    state.wsToken = els.wsToken.value.trim();
    state.restToken = els.restToken.value.trim();
    addAlert(`Conectando em ${state.apiBase}`, "ok");
    await discoverBackendEndpoints();
    refreshAll();
    startRealtime();
  });

  els.refreshMapBtn.addEventListener("click", () => {
    refreshAll();
    addAlert("Atualização manual executada.", "ok");
  });

  els.pedidoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await createPedido(new FormData(form));
      addAlert("Pedido registrado com sucesso.", "ok");
      if (form && typeof form.reset === "function") {
        form.reset();
      }
      refreshAll();
    } catch (error) {
      addAlert(`Falha ao cadastrar pedido: ${error.message}`, "danger");
    }
  });

  if (els.farmaciaForm) {
    els.farmaciaForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        await createFarmacia(new FormData(form));
        addAlert("Farmácia cadastrada com sucesso.", "ok");
      if (form && typeof form.reset === "function") {
        form.reset();
      }
      await carregarFarmacias();
      await carregarGestao();
      refreshAll();
    } catch (error) {
      addAlert(`Falha ao cadastrar farmácia: ${error.message}`, "danger");
    }
  });
  }

  if (els.droneForm) {
    els.droneForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        await createDrone(new FormData(form));
        addAlert("Drone cadastrado com sucesso.", "ok");
        if (form && typeof form.reset === "function") {
          form.reset();
        }
        await carregarGestao();
        refreshAll();
      } catch (error) {
        addAlert(`Falha ao cadastrar drone: ${error.message}`, "danger");
      }
    });
  }

  if (els.refreshGestaoBtn) {
    els.refreshGestaoBtn.addEventListener("click", carregarGestao);
  }

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    const action = button.dataset.action;
    try {
      if (action === "desativar-farmacia") {
        await desativarFarmacia(id);
        addAlert(`Farmácia ${id} desativada.`, "ok");
      } else if (action === "cancelar-pedido") {
        await cancelarPedido(id);
        addAlert(`Pedido ${id} cancelado.`, "ok");
      } else if (action === "desativar-drone") {
        await desativarDrone(id);
        addAlert(`Drone ${id} movido para manutenção.`, "ok");
      }
      await carregarFarmacias();
      await carregarGestao();
      refreshAll();
    } catch (error) {
      addAlert(`Falha na ação: ${error.message}`, "danger");
    }
  });

  els.exportBtn.addEventListener("click", () => {
    const payload = state.reportCache || { generated_at: new Date().toISOString() };
    downloadJSON("dronepharm-relatorio.json", payload);
    addAlert("Relatório exportado em JSON.", "ok");
  });
}

async function bootstrap() {
  initMap();
  bindEvents();
  await discoverBackendEndpoints();
  await carregarFarmacias();
  await carregarGestao();
  refreshAll();
  startRealtime();
  addAlert("Dashboard inicializada.", "ok");
  setInterval(refreshAll, 20000);
}

bootstrap();
