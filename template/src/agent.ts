/**
 * Your agent. jambonz handles the phone call, speech recognition, turn-taking, barge-in and the voice;
 * everything here decides what the agent says. Each hook is optional: delete what you do not need.
 *
 * Out of the box this is a pass-through to an OpenAI-compatible model, with one tool of its own and a
 * rule that connects callers to a person. Replace the pieces with your own logic.
 */
import type { HarnessContext, HarnessOptions } from '@jambonz/sdk/harness';

// Transfers the caller to OPERATOR_NUMBER, or without one to the transfer destination set on the agent in
// Agent Studio. jambonz speaks the announcement first; if the transfer cannot start, the caller stays here.
async function connectToPerson(ctx: HarnessContext): Promise<void> {
  ctx.state.set('transfer_requested', true);
  const to = process.env.OPERATOR_NUMBER;
  const result = await ctx.command('transfer', { ...(to ? { to } : {}), announce: 'Connecting you to a person now.' });
  if (!result.ok) {
    ctx.log.warn({ error: result.error }, 'transfer failed');
    ctx.say('Sorry, I could not connect you. How else can I help?');
  }
}

export const agent: HarnessOptions = {
  model: process.env.MODEL ?? 'gpt-4.1-mini',

  // The system prompt for every model call. Replies are spoken aloud: keep them short, no lists or markdown.
  instructions:
    'You answer phone calls for Acme. Be warm and brief: one or two sentences, plain text. ' +
    'Use get_business_hours when asked when Acme is open.',

  // Spoken when the call connects, without a model call. Remove it to have the model greet.
  greeting: 'Thanks for calling Acme. How can I help?',

  // Once per call. session has from, to, direction, the metadata Studio sends, and the agent's Studio tools.
  onSessionStart(session, ctx) {
    ctx.log.info({ from: session.from, to: session.to, metadata: session.metadata }, 'call started');
  },

  // Before each model call: routing, retrieval, gating. Return nothing to use the defaults, or change the
  // prompt, the tools offered, the model, or answer directly with `reply` and skip the model.
  beforeModel(turn, ctx) {
    if (/\b(agent|human|person|representative)\b/i.test(turn.text)) {
      void connectToPerson(ctx);
      return { reply: '', route: 'transfer_to_person' };
    }
  },

  // Tools of the harness's own, run in-process. The agent's tools from Studio are offered to the model too
  // and run through jambonz; you do not declare those here.
  tools: {
    get_business_hours: {
      description: 'The hours Acme is open, by day of the week.',
      parameters: { type: 'object', properties: {} },
      run: () => ({ weekdays: '8am to 6pm', saturday: '9am to 1pm', sunday: 'closed' }),
    },
  },

  // Before each sentence is spoken: true speaks it, false stops the reply, a string is spoken instead.
  checkSentence(sentence) {
    // never read a long number aloud (an account or card number the model repeated)
    return /\d{7,}/.test(sentence.replace(/[\s-]/g, '')) ? 'I would rather not read that number out loud.' : true;
  },

  // After each reply. What you add with ctx.record() is stored on the turn and shown in Studio.
  afterTurn(turn, ctx) {
    if (ctx.state.get('transfer_requested')) ctx.record('flags', ['transfer_requested']);
  },

  // Events from jambonz: dtmf, silence, user_interruption, transfer, recording, application_update, ...
  onEvent: {
    async dtmf(event, ctx) {
      if (event.digits === '0') await connectToPerson(ctx);
    },
  },

  onSessionEnd(end, ctx) {
    ctx.log.info({ reason: end.reason, duration_ms: end.duration_ms }, 'call ended');
  },
};
