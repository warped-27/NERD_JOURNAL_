type Level = 'debug' | 'info' | 'warn' | 'error';

const DENYLIST = ['password', 'apiKey', 'token', 'envelope', 'salt', 'verifier'];

function redact(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = DENYLIST.some((d) => k.toLowerCase().includes(d)) ? '[REDACTED]' : redact(v);
  }
  return out;
}

const isDev = process.env['NODE_ENV'] !== 'production';

function log(level: Level, message: string, meta?: unknown): void {
  if (!isDev && level === 'debug') return;
  const safe = meta !== undefined ? redact(meta) : undefined;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[${level.toUpperCase()}] ${message}`, ...(safe !== undefined ? [safe] : []));
}

export const logger = {
  debug: (msg: string, meta?: unknown) => log('debug', msg, meta),
  info:  (msg: string, meta?: unknown) => log('info',  msg, meta),
  warn:  (msg: string, meta?: unknown) => log('warn',  msg, meta),
  error: (msg: string, meta?: unknown) => log('error', msg, meta),
};
