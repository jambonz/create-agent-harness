/**
 * Starts the harness. jambonz opens one WebSocket to it per call; src/agent.ts decides what the agent says.
 */
import { createHarness } from '@jambonz/sdk/harness';
import { pino } from 'pino';
import { agent } from './agent.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const port = Number(process.env.PORT ?? 8080);

const server = createHarness({
  ...agent,
  logger,
  // when set, jambonz must present it; it is the Secret of your Custom harness agent in Agent Studio
  apiKey: process.env.HARNESS_SECRET || undefined,
});

const { host } = await server.listen({ port, host: '0.0.0.0' });
logger.info({ host, port, secret: !!process.env.HARNESS_SECRET }, 'agent harness listening');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
}
