export class BasePageController {
  constructor({ config, model, shellView, socketService }) {
    this.config = config;
    this.model = model;
    this.shellView = shellView;
    this.socketService = socketService;
  }

  async initializeShell() {
    this.shellView.setBackendLabel(this.config.backendLabel || "backend local");
    this.shellView.setConnection("neutral", "Inicializando");

    const discovered = await this.model.discoverEndpoints();
    this.shellView.addAlert(
      discovered
        ? "Rotas do backend sincronizadas automaticamente."
        : "Rotas padrao ativadas para o backend.",
      discovered ? "ok" : "warn"
    );
  }

  startAlertSocket() {
    this.socketService.open(this.model.endpoints.wsAlertas, {
      onOpen: () => this.shellView.setConnection("ok", "Tempo real ativo"),
      onClose: () => this.shellView.setConnection("warn", "WS desconectado"),
      onError: () => this.shellView.setConnection("warn", "WS com falha"),
      onMessage: (payload) => {
        const message = `${payload.tipo || "ALERTA"} | ${payload.drone_id || "-"} | ${payload.mensagem || "Evento critico"}`;
        this.shellView.addAlert(message, payload.nivel === "CRITICO" ? "danger" : "warn");
      },
    });
  }

  markSynced() {
    this.shellView.setConnection("ok", "Sincronizado");
    this.shellView.setLastUpdate(new Date());
  }

  handleError(prefix, error) {
    this.shellView.setConnection("warn", "Atencao");
    this.shellView.addAlert(`${prefix}: ${error.message}`, "danger");
  }
}
