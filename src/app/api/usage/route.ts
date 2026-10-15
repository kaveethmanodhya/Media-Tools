import { createHash, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VISITORS_KEY = 'mediatools:usage:v1:visitors';
const DOWNLOADS_KEY = 'mediatools:usage:v1:downloads';
const COOKIE_NAME = 'mt_visitor';
const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RedisResult = { result?: string | number | null; error?: string };

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

async function redis(commands: (string | number)[][]): Promise<RedisResult[]> {
  const config = redisConfig();
  if (!config) throw new Error('not_configured');
  const response = await fetch(config.url + '/pipeline', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + config.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
    cache: 'no-store',
    signal: AbortSignal.timeout(4500),
  });
  if (!response.ok) throw new Error('database_unavailable');
  const data: unknown = await response.json();
  if (!Array.isArray(data) || data.length !== commands.length) throw new Error('invalid_response');
  const results = data as RedisResult[];
  if (results.some(item => item.error)) throw new Error('redis_error');
  return results;
}

const noStore = { 'Cache-Control': 'no-store, private' };

export async function GET() {
  if (!redisConfig()) {
    return NextResponse.json({ available: false, reason: 'not_configured' }, { status: 503, headers: noStore });
  }
  try {
    const [visitors, downloads] = await redis([
      ['PFCOUNT', VISITORS_KEY],
      ['GET', DOWNLOADS_KEY],
    ]);
    return NextResponse.json({
      available: true,
      visitors: Number(visitors.result ?? 0),
      downloads: Number(downloads.result ?? 0),
      definitions: { visitors: 'Approximate unique browsers', downloads: 'Download actions' },
    }, { headers: noStore });
  } catch {
    return NextResponse.json({ available: false, reason: 'unavailable' }, { status: 503, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  if (!redisConfig()) {
    return NextResponse.json({ available: false, reason: 'not_configured' }, { status: 503, headers: noStore });
  }

  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: noStore });
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: noStore });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: noStore });
  }
  if (!body || typeof body !== 'object' || !('event' in body)) {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400, headers: noStore });
  }
  const event = (body as { event?: unknown }).event;
  if (event !== 'visit' && event !== 'download') {
    return NextResponse.json({ error: 'Unknown event' }, { status: 400, headers: noStore });
  }

  try {
    if (event === 'download') {
      await redis([['INCR', DOWNLOADS_KEY]]);
      return NextResponse.json({ recorded: true }, { headers: noStore });
    }

    const prior = request.cookies.get(COOKIE_NAME)?.value;
    const visitorId = prior && VISITOR_ID.test(prior) ? prior : randomUUID();
    const anonymousKey = createHash('sha256').update(visitorId).digest('hex');
    await redis([['PFADD', VISITORS_KEY, anonymousKey]]);

    const response = NextResponse.json({ recorded: true }, { headers: noStore });
    if (visitorId !== prior) {
      response.cookies.set(COOKIE_NAME, visitorId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  } catch {
    return NextResponse.json({ recorded: false, reason: 'unavailable' }, { status: 503, headers: noStore });
  }
}
