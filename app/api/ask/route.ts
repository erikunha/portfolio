import { checkBudget, getAskLimit, incrementBudget } from '@/lib/rate-limit';
import { STREAM_ERR_SENTINEL } from '@/lib/stream-protocol';
import Anthropic from '@anthropic-ai/sdk';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Module-scope client — reused across warm invocations.
const anthropic = new Anthropic();

// cache_control marks this block for Anthropic prompt caching.
// The system prompt is identical on every call — ~93% cheaper on cache hits.
const SYSTEM: Anthropic.Messages.TextBlockParam[] = [
  {
    type: 'text',
    text: `You are an AI proxy on Erik Cunha's portfolio site (erikunha.com.br). Answer questions about Erik concisely and accurately. Key facts:
- Staff/Principal Frontend Engineer, 8+ years
- Stack: Angular, React, Next.js, TypeScript, RxJS, NgRx, Node.js
- Current employer: Betsson Group (fintech, PCI-DSS)
- Past: Canon Medical, CICCC, Grupo SBF (Nike Brazil), Encora, Zup Innovation, Venturus, MB Labs
- Based in Brazil, open to remote / relocation
- Work auth: EU (Malta), Canada co-op, Brazil citizen
- Available immediately
- Contact: erikhenriquealvescunha@gmail.com
- GitHub: github.com/erikunha, LinkedIn: linkedin.com/in/erikunha

Be direct and honest. Do not fabricate information. Keep answers under 200 words unless the question demands more detail.`,
    cache_control: { type: 'ephemeral' },
  },
];

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'anon';

  // Per-IP rate limit
  const { success } = await getAskLimit().limit(ip);
  if (!success) {
    return Response.json({ error: 'rate limit exceeded — try again in an hour' }, { status: 429 });
  }

  // Global monthly budget check
  const { allowed } = await checkBudget();
  if (!allowed) {
    return Response.json(
      { error: 'monthly budget exhausted — email erikhenriquealvescunha@gmail.com directly' },
      { status: 503 },
    );
  }

  let question: string;
  try {
    const body = (await req.json()) as { question?: unknown };
    if (typeof body.question !== 'string' || !body.question.trim()) {
      return Response.json({ error: 'question is required' }, { status: 400 });
    }
    question = body.question.trim().slice(0, 500);
  } catch {
    return Response.json({ error: 'invalid request body' }, { status: 400 });
  }

  const anthropicStream = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: SYSTEM,
    messages: [{ role: 'user', content: question }],
    stream: true,
  });

  const enc = new TextEncoder();
  let inputTokens  = 0;
  let outputTokens = 0;

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of anthropicStream) {
          if (event.type === 'message_start') {
            inputTokens = event.message.usage.input_tokens;
          } else if (event.type === 'message_delta') {
            outputTokens = event.usage.output_tokens;
          } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(enc.encode(event.delta.text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'upstream error';
        controller.enqueue(enc.encode(`${STREAM_ERR_SENTINEL}${msg}`));
      } finally {
        controller.close();
        // Fire-and-forget — never blocks the response.
        incrementBudget(inputTokens, outputTokens);
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
