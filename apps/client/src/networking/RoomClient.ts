import { parseServerMessage, type ClientMessage, type ServerMessage } from '@rival/shared';

export class RoomClient {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<(message: ServerMessage) => void>();

  constructor(private readonly url: string) {}

  connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;
      let opened = false;
      const timeout = window.setTimeout(() => {
        socket.close();
        reject(new Error('The race server did not respond.'));
      }, 7000);
      socket.addEventListener('open', () => { opened = true; window.clearTimeout(timeout); resolve(); }, { once: true });
      socket.addEventListener('error', () => { window.clearTimeout(timeout); reject(new Error('Could not connect to the race server.')); }, { once: true });
      socket.addEventListener('message', (event: MessageEvent<unknown>) => this.receive(event.data));
      socket.addEventListener('close', () => {
        window.clearTimeout(timeout);
        if (!opened) reject(new Error('The race server connection closed before opening.'));
        if (this.socket === socket) this.socket = null;
        const message: ServerMessage = { type: 'error', code: 'connection_closed', message: 'Race server connection closed.' };
        for (const listener of this.listeners) listener(message);
      });
    });
  }

  onMessage(listener: (message: ServerMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(message: ClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
    this.listeners.clear();
  }

  private receive(data: unknown): void {
    if (typeof data !== 'string') return;
    let value: unknown;
    try {
      value = JSON.parse(data) as unknown;
    } catch {
      return;
    }
    const message = parseServerMessage(value);
    if (!message) return;
    for (const listener of this.listeners) listener(message);
  }
}
