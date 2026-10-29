# @jambonz/create-agent-harness

Scaffold a **custom agent harness** for [jambonz](https://jambonz.org): a small TypeScript service that decides what
your voice agent says, while jambonz handles the phone call, speech recognition, turn-taking, barge-in and the voice.

```bash
npm create @jambonz/agent-harness@latest my-agent
cd my-agent
npm install
cp .env.example .env     # add your OPENAI_API_KEY
npm run dev              # ws://localhost:8080
```

Your logic goes in `src/agent.ts`. As generated, the harness:

- passes each turn to an OpenAI-compatible model (any endpoint that speaks chat completions)
- has a tool of its own (`get_business_hours`) the model can call, alongside the agent's tools from Agent Studio
- transfers a caller who asks for a person (or presses 0), without a model call
- never reads a long number aloud
- comes with a test that runs it against a fake jambonz (no model key needed), a Dockerfile and a health check

It is built on [`@jambonz/sdk/harness`](https://www.npmjs.com/package/@jambonz/sdk), which speaks the harness
protocol for you: streaming replies, conversation history, barge-in, tools, call control and the turn record.

## Connect it to jambonz

- **Agent Studio:** create a **Custom harness** agent and enter your harness's WebSocket URL (and a secret, if you set
  `HARNESS_SECRET`). The generated README walks through it, including a tunnel for testing from your laptop.
- **Your own jambonz application:** use the `agent` verb with `llm: { vendor: "harness", harness: { url: "wss://…" } }`.

## Learn more

- [Custom harness in Agent Studio](https://docs.jambonz.org/agent-studio/custom-harness/overview)
- [Harness protocol reference](https://docs.jambonz.org/agent-studio/custom-harness/protocol)
- [`@jambonz/sdk/harness` reference](https://docs.jambonz.org/agent-studio/custom-harness/sdk)

## License

MIT
