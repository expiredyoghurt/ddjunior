export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra; // optional fields sent back with the error
  }
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export async function readJson(request) {
  try {
    const text = await request.text();
    if (text.length > 400_000) throw new HttpError(413, 'That request is too large.');
    return text ? JSON.parse(text) : {};
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, 'The request was not valid JSON.');
  }
}

export const clientIp = (request) => request.headers.get('cf-connecting-ip') || 'local';

export async function rateLimited(env, binding, key) {
  const rl = env[binding];
  if (!rl) return false;
  try {
    const { success } = await rl.limit({ key });
    return !success;
  } catch {
    return false;
  }
}

export const clip = (s, n) => String(s ?? '').slice(0, n);
export const int = (v, d = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};
