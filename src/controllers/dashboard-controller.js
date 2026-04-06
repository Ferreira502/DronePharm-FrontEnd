export class DashboardController {
  constructor({ config, model, view, mapView, socketService, store }) {
    this.config = config;
    this.model = model;
    this.view = view;
    this.mapView = mapView;
    this.socketService = socketService;
    this.store = store;
    this.refreshTimer = null;
  }

  async init() {
    this.view.setBackendLabel(this.config.backendLabel || "backend local");
    this.view.setConnection("neutral", "Inicializando");

    const discovered = await this.model.discoverEndpoints();
    this.view.addAlert(
      discovered
        ? "Endpoints descobertos automaticamente no backend."
        : "Nao foi possivel descobrir endpoints. Rotas padrao mantidas.",
      discovered ? "ok" : "warn"
    );

    this.bindEvents();
    await this.loadFarmacias();
    await this.loadGestao();
    await this.refreshDashboard();
    this.startRealtime();

    this.refreshTimer = window.setInterval(() => {
      this.refreshDashboard();
    }, this.config.refreshIntervalMs || 20000);

    this.view.addAlert("Dashboard inicializado com proxy local e arquitetura MVC.", "ok");
  }

  bindEvents() {
    const { pedidoForm, farmaciaForm, droneForm, refreshMapBtn, refreshGestaoBtn, exportBtn } = this.view.els;

    refreshMapBtn.addEventListener("click", async () => {
      await this.refreshDashboard();
      this.view.addAlert("Atualizacao manual executada.", "ok");
    });

    refreshGestaoBtn.addEventListener("click", async () => {
      await this.loadGestao();
      this.view.addAlert("Listas de gestao atualizadas.", "ok");
    });

    pedidoForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await this.handleFormSubmit({
        form: event.currentTarget,
        action: (formData) => this.model.createPedido(formData),
        successMessage: "Pedido cadastrado com sucesso.",
      });
    });

    farmaciaForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await this.handleFormSubmit({
        form: event.currentTarget,
        action: (formData) => this.model.createFarmacia(formData),
        successMessage: "Farmacia cadastrada com sucesso.",
        afterSuccess: async () => {
          await this.loadFarmacias();
          await this.loadGestao();
          await this.refreshDashboard();
        },
      });
    });

    droneForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await this.handleFormSubmit({
        form: event.currentTarget,
        action: (formData) => this.model.createDrone(formData),
        successMessage: "Drone cadastrado com sucesso.",
        afterSuccess: async () => {
          await this.loadGestao();
          await this.refreshDashboard();
        },
      });
    });

    document.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) {
        return;
      }

      const { action, id } = button.dataset;

      try {
        if (action === "desativar-farmacia") {
          await this.model.desativarFarmacia(id);
          this.view.addAlert(`Farmacia ${id} desativada.`, "ok");
        } else if (action === "cancelar-pedido") {
          await this.model.cancelarPedido(id);
          this.view.addAlert(`Pedido ${id} cancelado.`, "ok");
        } else if (action === "desativar-drone") {
          await this.model.desativarDrone(id);
          this.view.addAlert(`Drone ${id} movido para manutencao.`, "ok");
        }

        await this.loadFarmacias();
        await this.loadGestao();
        await this.refreshDashboard();
      } catch (error) {
        this.view.addAlert(`Falha na acao: ${error.message}`, "danger");
      }
    });

    exportBtn.addEventListener("click", () => {
      const payload = this.store.getState().reportCache || { generated_at: new Date().toISOString() };
      this.view.downloadJson("dronepharm-relatorio.json", payload);
      this.view.addAlert("Relatorio exportado em JSON.", "ok");
    });
  }

  async handleFormSubmit({ form, action, successMessage, afterSuccess }) {
    try {
      await action(new FormData(form));
      this.view.addAlert(successMessage, "ok");
      this.view.resetForm(form);
      await this.refreshDashboard();
      await afterSuccess?.();
    } catch (error) {
      this.view.addAlert(`Falha ao enviar formulario: ${error.message}`, "danger");
    }
  }

  async loadFarmacias() {
    try {
      const data = await this.model.fetchFarmacias();
      const farmacias = data.farmacias || [];

      if (!farmacias.length) {
        this.view.addAlert("Nenhuma farmacia ativa encontrada.", "warn");
        return;
      }

      this.view.suggestFarmaciaId(farmacias);
      this.view.addAlert(`Farmacias carregadas: ${farmacias.length}.`, "ok");
    } catch (error) {
      this.view.addAlert(`Nao foi possivel carregar farmacias: ${error.message}`, "warn");
    }
  }

  async loadGestao() {
    try {
      const [drones, farmacias, pedidos] = await this.model.fetchGestao();
      this.view.renderGestaoDrones(drones.drones || []);
      this.view.renderGestaoFarmacias(farmacias.farmacias || []);
      this.view.renderGestaoPedidos(pedidos.pedidos || []);
    } catch (error) {
      this.view.addAlert(`Falha ao carregar gestao: ${error.message}`, "warn");
    }
  }

  async refreshDashboard() {
    const [snapshotResult, frotaResult, historicoResult, kpisResult] = await this.model.fetchDashboard();
    let successCount = 0;

    if (snapshotResult.status === "fulfilled") {
      this.mapView.drawSnapshot(snapshotResult.value);
      successCount += 1;
    } else {
      this.view.addAlert(`Mapa indisponivel: ${snapshotResult.reason.message}`, "warn");
    }

    if (frotaResult.status === "fulfilled") {
      this.view.renderFrotaKpis(frotaResult.value.resumo || {});
      this.view.renderDroneCards(frotaResult.value.drones || []);
      successCount += 1;
    } else {
      this.view.addAlert(`Frota indisponivel: ${frotaResult.reason.message}`, "warn");
    }

    if (historicoResult.status === "fulfilled") {
      this.view.renderHistorico(historicoResult.value.historico || []);
      successCount += 1;
    } else {
      this.view.addAlert(`Historico indisponivel: ${historicoResult.reason.message}`, "warn");
    }

    if (kpisResult.status === "fulfilled") {
      this.view.renderReportKpis(kpisResult.value);
      successCount += 1;
    } else {
      this.view.renderReportKpis({});
      this.view.addAlert("KPIs indisponiveis no backend.", "warn");
    }

    this.store.patch({
      reportCache: {
        snapshot: snapshotResult.status === "fulfilled" ? snapshotResult.value : null,
        frota: frotaResult.status === "fulfilled" ? frotaResult.value : null,
        historico: historicoResult.status === "fulfilled" ? historicoResult.value : null,
        kpis: kpisResult.status === "fulfilled" ? kpisResult.value : null,
        exported_at: new Date().toISOString(),
      },
    });

    this.view.setConnection(successCount >= 3 ? "ok" : "warn", successCount >= 3 ? "Conectado" : "Parcial");
  }

  startRealtime() {
    this.socketService.closeAll();

    this.socketService.open(this.model.endpoints.wsTelemetria, {
      onOpen: () => this.view.setConnection("ok", "Tempo real ativo"),
      onClose: () => this.view.setConnection("warn", "WS desconectado"),
      onError: () => this.view.setConnection("warn", "WS com falha"),
      onMessage: async (payload) => {
        if (payload.tipo !== "telemetria") {
          return;
        }

        const bateria = Number(payload.bateria_pct ?? 0);
        this.view.addAlert(
          `Telemetria ${payload.drone_id}: bateria ${(bateria * 100).toFixed(1)}%, vento ${payload.vento_ms} m/s`,
          "info"
        );
        await this.refreshDashboard();
      },
    });

    this.socketService.open(this.model.endpoints.wsAlertas, {
      onMessage: (payload) => {
        const message = `${payload.tipo || "ALERTA"} | ${payload.drone_id || "-"} | ${payload.mensagem || "Evento critico"}`;
        this.view.addAlert(message, payload.nivel === "CRITICO" ? "danger" : "warn");
      },
    });
  }
}
