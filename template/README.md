# My agent harness

A custom agent harness for [jambonz](https://jambonz.org). jambonz handles the phone call, speech recognition,
turn-taking, barge-in and the voice; this service decides what the agent says. jambonz opens one WebSocket to it per
call.

Your logic goes in [`src/agent.ts`](src/agent.ts). As generated it passes each turn to an OpenAI-compatible model, has
one tool of its own (`get_business_hours`), transfers callers who ask for a person (or press 0), and never reads a
long number aloud.

## Run it locally

```bash
npm install
cp .env.example .env    # set OPENAI_API_KEY; see the table below for the rest
npm run dev             # ws://localhost:8080, restarts when you edit src/
```

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | port to listen on |
| `HARNESS_SECRET` | empty | when set, jambonz must send `Authorization: Bearer <secret>`; use the same value as the agent's Secret in Agent Studio |
| `OPENAI_API_KEY` | | key for the model endpoint |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | any OpenAI-compatible chat-completions endpoint |
| `MODEL` | `gpt-4.1-mini` | model name |
| `OPERATOR_NUMBER` | empty | where callers who ask for a person, or press 0, are transferred (E.164 number or `sip:` URI). Empty uses the agent's transfer destination in Agent Studio |
| `LOG_LEVEL` | `info` | pino log level |

`GET /health` answers `{"ok":true,"calls":N}` for a load balancer or container health check.

## Let jambonz reach it

jambonz connects to your harness, so it needs an address jambonz can reach. For a quick test from your laptop, use a
tunnel:

```bash
ngrok http 8080          # gives https://<id>.ngrok-free.app; use wss://<id>.ngrok-free.app as the URL
```

In production run it behind TLS (a load balancer, or nginx or Caddy passing WebSocket upgrades) so the URL is
`wss://`. `ws://` is accepted only for a private address on the same network as jambonz.

## Use it from Agent Studio

1. **New agent**, choose **Custom harness**, and create it.
2. In the **Custom harness** section, enter the **Harness URL** (for example `wss://<id>.ngrok-free.app`).
3. If you set `HARNESS_SECRET`, enter the same value as the **Secret** and press **Save**. It is stored in your jambonz
   account, never in the agent.
4. **Start test call**. You hear the greeting from `src/agent.ts`; the log here shows the call.

Studio sends each call's details in `session.metadata` (agent id, version and the call's variables), and offers your
agent's Studio tools to the model alongside the harness's own.

## Use it from your own jambonz application

```json
{
  "verb": "agent",
  "stt": { "vendor": "deepgram", "language": "en-US" },
  "tts": { "vendor": "cartesia", "voice": "..." },
  "llm": { "vendor": "harness", "harness": { "url": "wss://harness.example.com" } },
  "actionHook": "/agent-done"
}
```

With a secret, add an LLM credential with vendor **Harness** to your jambonz account through the API, and name it in
the verb with `"label"`.

## Build your own logic

`src/agent.ts` exports the options for `createHarness()` from [`@jambonz/sdk/harness`](https://www.npmjs.com/package/@jambonz/sdk).
Every hook is optional:

| Hook | Runs | Use it for |
|---|---|---|
| `onSessionStart(session, ctx)` | once per call | per-call state, looking up the caller |
| `beforeModel(turn, ctx)` | each turn, before the model | routing, retrieval, gating; return `{ reply }` to answer without the model |
| `tools` | when the model calls one | tools of your own, run in-process |
| `checkSentence(sentence, ctx)` | before each sentence is spoken | blocking or rewriting what is said |
| `afterTurn(turn, ctx)` | after each reply | adding to the turn record with `ctx.record()` |
| `onEvent.<name>(event, ctx)` | on jambonz events | `dtmf`, `silence`, `user_interruption`, `transfer`, ... |
| `onSessionEnd(end, ctx)` | when the call ends | writing your own records |

`ctx` gives you per-call `state`, the conversation `history`, a logger, `say()` to speak on your own initiative,
`command()` for call control (`hangup`, `transfer`, `record`, `barge_in`, `listen`) and `callTool()` to run one of the
agent's Studio tools.

## Test and deploy

```bash
npm test                 # runs the harness against a fake jambonz; no model key needed
docker build -t my-agent-harness .
docker run -p 8080:8080 --env-file .env my-agent-harness
```
