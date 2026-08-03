export type WebsocketEventHandler = (payload: unknown) => void;

export interface WebsocketEventBus {
  connect(url: string): void;
  on(eventName: string, handler: WebsocketEventHandler): () => void;
  publish(eventName: string, payload: unknown): void;
}

export function createWebsocketEventBus(): WebsocketEventBus {
  const handlers = new Map<string, Set<WebsocketEventHandler>>();
  let socket: WebSocket | undefined;
  let url: string | undefined;
  let retry = 0;

  function open(): void {
    if (!url || typeof WebSocket === "undefined") {
      return;
    }
    socket = new WebSocket(url);

    socket.addEventListener("open", () => {
      retry = 0; // reset backoff on a good connection
    });

    socket.addEventListener("message", (message) => {
      try {
        const event = JSON.parse(String(message.data)) as { type: string; payload: unknown };
        for (const handler of handlers.get(event.type) ?? []) {
          handler(event.payload);
        }
      } catch {
        // Malformed frame — ignore, never let it kill the socket/reconnect loop.
      }
    });

    // Auto-reconnect with capped backoff so a head-end restart or ship-WiFi blip
    // recovers WITHOUT a TV reboot (sockets otherwise stay dead until relaunch).
    socket.addEventListener("close", () => {
      const delay = Math.min(30000, 1000 * 2 ** retry);
      retry += 1;
      setTimeout(open, delay);
    });
    // error → close the socket; the close handler drives the retry.
    socket.addEventListener("error", () => socket?.close());
  }

  return {
    connect(u) {
      url = u;
      retry = 0;
      open();
    },
    on(eventName, handler) {
      const eventHandlers = handlers.get(eventName) ?? new Set<WebsocketEventHandler>();
      eventHandlers.add(handler);
      handlers.set(eventName, eventHandlers);

      return () => eventHandlers.delete(handler);
    },
    publish(eventName, payload) {
      socket?.send(JSON.stringify({ type: eventName, payload }));
    },
  };
}
