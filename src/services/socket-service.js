export class SocketService {
  constructor() {
    this.sockets = [];
  }

  closeAll() {
    for (const socket of this.sockets) {
      try {
        socket.close();
      } catch (_) {
        // noop
      }
    }

    this.sockets = [];
  }

  open(path, handlers = {}) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}${path}`);

    socket.onopen = () => handlers.onOpen?.();
    socket.onclose = () => handlers.onClose?.();
    socket.onerror = () => handlers.onError?.();
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handlers.onMessage?.(payload);
      } catch (_) {
        // noop
      }
    };

    this.sockets.push(socket);
    return socket;
  }
}
