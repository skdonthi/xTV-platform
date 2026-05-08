export type WebsocketEventHandler = (payload: unknown) => void;

export interface WebsocketEventBus {
  connect(url: string): void;
  on(eventName: string, handler: WebsocketEventHandler): () => void;
  publish(eventName: string, payload: unknown): void;
}

export function createWebsocketEventBus(): WebsocketEventBus {
  const handlers = new Map<string, Set<WebsocketEventHandler>>();
  let socket: WebSocket | undefined;

  return {
    connect(url) {
      socket = new WebSocket(url);
      socket.addEventListener("message", (message) => {
        const event = JSON.parse(String(message.data)) as { type: string; payload: unknown };
        for (const handler of handlers.get(event.type) ?? []) {
          handler(event.payload);
        }
      });
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
