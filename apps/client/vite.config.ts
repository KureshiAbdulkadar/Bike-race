import { defineConfig, type Plugin } from 'vite';
import { WebSocketServer } from 'ws';
import { createRoomGateway } from '../server/src/createRoomGateway.ts';

function localRooms(): Plugin {
  return {
    name: 'rival-local-rooms', apply: 'serve',
    configureServer(vite) {
      const sockets = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
      const gateway = createRoomGateway(sockets);
      vite.httpServer?.on('upgrade', (request, socket, head) => {
        if (request.url?.split('?')[0] !== '/ws') return;
        sockets.handleUpgrade(request, socket, head, (client) => sockets.emit('connection', client, request));
      });
      vite.httpServer?.once('close', () => { gateway.dispose(); sockets.close(); });
    },
  };
}

export default defineConfig({
  plugins: [localRooms()],
  server: { host: '127.0.0.1' },
  optimizeDeps: { include: ['@babylonjs/core', '@rival/shared'] },
});
