import { WebSocketServer } from 'ws';
import { createRoomGateway } from './createRoomGateway.ts';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
const server = new WebSocketServer({ host, port, maxPayload: 16 * 1024 });
const gateway = createRoomGateway(server);
server.on('listening', () => console.info(`Rival Riding room server listening on ws://${host}:${port}`));
server.on('error', (error) => { gateway.dispose(); console.error(`Rival Riding room server could not listen on ws://${host}:${port}: ${error.message}`); process.exitCode = 1; });
function shutdown(): void { gateway.dispose(); server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 5000).unref(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
