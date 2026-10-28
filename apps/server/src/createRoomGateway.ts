import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { parseClientMessage, TICK_RATE, type ServerMessage } from '@rival/shared';
import { createPlayerId, RoomService } from './RoomService.ts';

/** Same validated authoritative gateway in standalone production and local Vite dev. */
export function createRoomGateway(server: WebSocketServer): { dispose: () => void } {
  const rooms = new RoomService();
  const rates = new WeakMap<WebSocket, { start: number; count: number }>();
  const timer = setInterval(() => rooms.tick(), 1000 / TICK_RATE);
  const send = (socket: WebSocket, message: ServerMessage): void => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };
  server.on('connection', (socket) => {
    const playerId = createPlayerId();
    socket.on('message', (data: RawData, isBinary) => {
      const now = Date.now();
      let rate = rates.get(socket);
      if (!rate || now - rate.start >= 1000) { rate = { start: now, count: 0 }; rates.set(socket, rate); }
      if (++rate.count > 60) { socket.close(1008, 'Message rate exceeded.'); return; }
      if (isBinary) { send(socket, { type: 'error', code: 'invalid_payload', message: 'Only JSON text messages are supported.' }); return; }
      let value: unknown;
      try { value = JSON.parse(data.toString()) as unknown; }
      catch { send(socket, { type: 'error', code: 'invalid_json', message: 'Message must contain valid JSON.' }); return; }
      const message = parseClientMessage(value);
      if (!message) { send(socket, { type: 'error', code: 'invalid_payload', message: 'Message does not match the client protocol.' }); return; }
      rooms.handle(playerId, (response) => send(socket, response), message);
    });
    socket.on('close', () => rooms.disconnect(playerId));
    socket.on('error', () => rooms.disconnect(playerId));
  });
  return { dispose: () => { clearInterval(timer); rooms.dispose(); for (const socket of server.clients) socket.terminate(); } };
}
