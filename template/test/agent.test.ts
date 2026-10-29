/**
 * Runs the harness against a fake jambonz: a WebSocket client that speaks the harness protocol.
 * These tests need no model key: they cover the greeting, the secret, and the turns answered without a model.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { pino } from 'pino';
import { createHarness, type HarnessServer } from '@jambonz/sdk/harness';
import { agent } from '../src/agent.js';

const servers: HarnessServer[] = [];
after(() => Promise.all(servers.map((s) => s.close())));

async function start(secret?: string) {
  const server = createHarness({ ...agent, logger: pino({ level: 'silent' }), apiKey: secret });
  servers.push(server);
  const { port } = await server.listen({ port: 0, host: '127.0.0.1' });
  return `ws://127.0.0.1:${port}`;
}

/** A call as jambonz places it: connect, then session:start. */
async function call(url: string, headers: Record<string, string> = {}) {
  const ws = new WebSocket(url, 'harness.jambonz.org', { headers });
  const received: any[] = [];
  const waiters: { match: (m: any) => boolean; resolve: (m: any) => void }[] = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    received.push(m);
    for (const w of [...waiters]) if (w.match(m)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(m); }
  });
  await new Promise<void>((resolve, reject) => { ws.once('open', () => resolve()); ws.once('error', reject); });
  const send = (type: string, data: Record<string, unknown> = {}) =>
    ws.send(JSON.stringify({ type, call_sid: 'call-1', ...data }));
  const next = (type: string, pred: (m: any) => boolean = () => true) =>
    new Promise<any>((resolve, reject) => {
      const found = received.find((m) => m.type === type && pred(m));
      if (found) return resolve(found);
      waiters.push({ match: (m) => m.type === type && pred(m), resolve });
      setTimeout(() => reject(new Error(`no ${type} within 2s`)), 2000);
    });
  /** Everything the harness spoke for a reply, once it is done. */
  const spoken = async (replyId: string) => {
    await next('reply:done', (m) => m.reply_id === replyId);
    return received
      .filter((m) => m.type === 'reply:chunk' && m.reply_id === replyId)
      .map((m) => m.chunk?.choices?.[0]?.delta?.content ?? '')
      .join('');
  };
  send('session:start', {
    protocol: 1, account_sid: 'acct-1', application_sid: 'app-1', direction: 'inbound',
    from: '+15085551212', to: '+15085550000', language: 'en-US', metadata: {}, tools: [],
  });
  return { ws, send, next, spoken };
}

test('greets the caller without a model call', async () => {
  const c = await call(await start());
  c.send('turn:start', { turn_id: 1, input: { type: 'greeting' } });
  const first = await c.next('reply:chunk', (m) => m.turn_id === 1);
  assert.equal(await c.spoken(first.reply_id), 'Thanks for calling Acme. How can I help?');
  c.ws.close();
});

test('with a secret, a connection without it is refused', async () => {
  const url = await start('s3cret');
  await assert.rejects(call(url), /401/);
  await assert.rejects(call(url, { Authorization: 'Bearer wrong' }), /401/);
  const c = await call(url, { Authorization: 'Bearer s3cret' });
  c.ws.close();
});

test('asking for a person is answered without the model', async () => {
  process.env.OPERATOR_NUMBER = '+15085550100';
  const c = await call(await start());
  c.send('turn:start', { turn_id: 1, input: { type: 'speech', text: 'can I talk to a person', confidence: 0.9 } });
  const first = await c.next('reply:chunk', (m) => m.turn_id === 1);
  assert.match(await c.spoken(first.reply_id), /Press zero/);
  const done = await c.next('reply:done', (m) => m.turn_id === 1);
  assert.equal(done.turn_record?.route, 'offer_person');
  c.ws.close();
  delete process.env.OPERATOR_NUMBER;
});

test('pressing 0 transfers to the operator number', async () => {
  process.env.OPERATOR_NUMBER = '+15085550100';
  const c = await call(await start());
  c.send('event', { name: 'dtmf', digits: '0', duration_ms: 120 });
  const cmd = await c.next('command', (m) => m.name === 'transfer');
  assert.deepEqual(cmd.args, { to: '+15085550100' });
  c.send('command:result', { command_id: cmd.command_id, ok: true });
  c.ws.close();
  delete process.env.OPERATOR_NUMBER;
});

test('a long number is never read aloud', async () => {
  const check = agent.checkSentence!;
  assert.equal(await check('Your order is on its way.', {} as never), true);
  assert.match(String(await check('Your account is 4111 1111 1111 1111.', {} as never)), /rather not read/);
});
