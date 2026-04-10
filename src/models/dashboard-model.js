export class DashboardModel {
  constructor(httpClient) {
    this.httpClient = httpClient;
    this.endpoints = {
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
    };
  }

  static toPathFromAbsolute(urlLike, fallbackPath) {
    try {
      const parsed = new URL(urlLike);
      return `${parsed.pathname}${parsed.search}`;
    } catch (_) {
      return fallbackPath;
    }
  }

  static deriveBasePath(path, fallbackBase) {
    if (!path) {
      return fallbackBase;
    }

    const index = path.lastIndexOf("/");
    return index <= 0 ? fallbackBase : path.slice(0, index);
  }

  static ensureTrailingSlash(path) {
    return path.endsWith("/") ? path : `${path}/`;
  }

  async discoverEndpoints() {
    try {
      const payload = await this.httpClient.request("/backend-root");
      const http = payload.endpoints_http || {};
      const ws = payload.endpoints_ws || {};

      const pedidosBase = http.pedidos || "/api/v1/pedidos";
      const farmaciasBase = http.farmacias || "/api/v1/farmacias";
      const dronesBase = http.drones || "/api/v1/drones";
      const historicoBase = DashboardModel.ensureTrailingSlash(http.historico || "/api/v1/historico/");
      const mapaBase = DashboardModel.deriveBasePath(http.mapa || "/api/v1/mapa/rotas", "/api/v1/mapa");

      this.endpoints = {
        ...this.endpoints,
        pedidosPost: `${pedidosBase}/`,
        pedidosList: `${pedidosBase}/`,
        pedidoCancelarPrefix: `${pedidosBase}/`,
        farmaciasList: `${farmaciasBase}/`,
        dronesList: `${dronesBase}/`,
        frotaStatus: http.frota || "/api/v1/frota/status",
        historicoList: historicoBase,
        historicoKpis: `${historicoBase}kpis`,
        mapaSnapshot: `${mapaBase}/snapshot`,
        wsTelemetria: DashboardModel.toPathFromAbsolute(ws.telemetria_global || "", "/ws/telemetria"),
        wsAlertas: DashboardModel.toPathFromAbsolute(ws.alertas || "", "/ws/alertas"),
      };

      return true;
    } catch (_) {
      return false;
    }
  }

  fetchFarmacias() {
    return this.httpClient.request(this.endpoints.farmaciasList);
  }

  fetchDrones() {
    return this.httpClient.request(this.endpoints.dronesList);
  }

  fetchPedidos(limit = 50) {
    return this.httpClient.request(`${this.endpoints.pedidosList}?limite=${limit}`);
  }

  fetchHistorico(limit = 20) {
    return this.httpClient.request(`${DashboardModel.ensureTrailingSlash(this.endpoints.historicoList)}?limite=${limit}`);
  }

  fetchKpis() {
    return this.httpClient.request(this.endpoints.historicoKpis);
  }

  fetchFrotaStatus() {
    return this.httpClient.request(this.endpoints.frotaStatus);
  }

  fetchSnapshot() {
    return this.httpClient.request(this.endpoints.mapaSnapshot);
  }

  fetchGestao() {
    return Promise.all([
      this.fetchDrones(),
      this.fetchFarmacias(),
      this.fetchPedidos(50),
    ]);
  }

  fetchDashboard() {
    return Promise.allSettled([
      this.fetchSnapshot(),
      this.fetchFrotaStatus(),
      this.fetchHistorico(20),
      this.fetchKpis(),
    ]);
  }

  createPedido(formData) {
    return this.httpClient.request(this.endpoints.pedidosPost, {
      method: "POST",
      body: JSON.stringify({
        coordenada: {
          latitude: Number(formData.get("latitude")),
          longitude: Number(formData.get("longitude")),
        },
        peso_kg: Number(formData.get("peso_kg")),
        prioridade: Number(formData.get("prioridade")),
        descricao: String(formData.get("descricao") || "").trim(),
        farmacia_id: Number(formData.get("farmacia_id")),
      }),
    });
  }

  createFarmacia(formData) {
    return this.httpClient.request(this.endpoints.farmaciasList, {
      method: "POST",
      body: JSON.stringify({
        nome: String(formData.get("nome") || "").trim(),
        latitude: Number(formData.get("latitude")),
        longitude: Number(formData.get("longitude")),
        endereco: String(formData.get("endereco") || "").trim(),
        cidade: String(formData.get("cidade") || "").trim(),
        uf: String(formData.get("uf") || "").trim().toUpperCase(),
        deposito: Boolean(formData.get("deposito")),
      }),
    });
  }

  createDrone(formData) {
    return this.httpClient.request(this.endpoints.dronesList, {
      method: "POST",
      body: JSON.stringify({
        id: String(formData.get("id") || "").trim(),
        nome: String(formData.get("nome") || "").trim(),
        capacidade_max_kg: Number(formData.get("capacidade_max_kg")),
        autonomia_max_km: Number(formData.get("autonomia_max_km")),
        velocidade_ms: Number(formData.get("velocidade_ms")),
      }),
    });
  }

  desativarFarmacia(id) {
    return this.httpClient.request(`${this.endpoints.farmaciasList}${id}`, {
      method: "DELETE",
    });
  }

  cancelarPedido(id) {
    return this.httpClient.request(`${this.endpoints.pedidoCancelarPrefix}${id}/cancelar`, {
      method: "PATCH",
    });
  }

  desativarDrone(id) {
    return this.httpClient.request(`${this.endpoints.dronesList}${id}/status?status=manutencao`, {
      method: "PATCH",
    });
  }
}
