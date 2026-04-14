const channelName = "dronepharm-order-sync";
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(channelName) : null;

export function notifyOrderChanged(payload) {
  if (!channel) {
    return;
  }

  channel.postMessage({
    type: "order-changed",
    payload,
    emittedAt: Date.now(),
  });
}

export function subscribeOrderChanged(listener) {
  if (!channel) {
    return () => {};
  }

  const handler = (event) => {
    if (event.data?.type === "order-changed") {
      listener(event.data.payload);
    }
  };

  channel.addEventListener("message", handler);
  return () => channel.removeEventListener("message", handler);
}
