// Netlify Function: a locked-down proxy between the game and the Gemini API.
// The key lives in the GEMINI_API_KEY environment variable and never reaches the browser.

const GEM = 'https://generativelanguage.googleapis.com/v1beta';
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const MAX_BODY = 200000;

const reply = (status, obj) => new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });

async function passthrough(r) {
  return new Response(await r.text(), { status: r.status, headers: JSON_HEADERS });
}

export default async (req) => {
  const key = process.env.GEMINI_API_KEY;
  const url = new URL(req.url);
  const op = url.searchParams.get('op');

  if (op === 'status' && req.method === 'GET') {
    return reply(200, { configured: !!key });
  }
  if (!key) {
    return reply(500, { error: { message: 'GEMINI_API_KEY is not set in Netlify environment variables.' } });
  }

  if (op === 'models' && req.method === 'GET') {
    const r = await fetch(`${GEM}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
    return passthrough(r);
  }

  if (op === 'generate' && req.method === 'POST') {
    const model = url.searchParams.get('model') || '';
    if (!/^gemini-[a-z0-9.-]+$/i.test(model)) {
      return reply(400, { error: { message: 'Unknown model name.' } });
    }
    const body = await req.text();
    if (body.length > MAX_BODY) {
      return reply(413, { error: { message: 'Request too large.' } });
    }
    const r = await fetch(`${GEM}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body,
    });
    return passthrough(r);
  }

  return reply(404, { error: { message: 'Unknown operation.' } });
};
