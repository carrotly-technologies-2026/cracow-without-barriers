export type LogMeta = Record<string, unknown>;

/** One JSON line per event on stdout (visible in Coolify logs). Disable with ANALYTICS_LOG=0. */
export function logEvent(ev: string, data: LogMeta = {}) {
  if (process.env.ANALYTICS_LOG === '0') return;
  console.log(JSON.stringify({ t: new Date().toISOString(), ev, ...data }));
}

/** Wraps an API handler: logs name, status, duration, anonymous visitor id and whatever the handler puts in `meta`. */
export function logged(name: string, handler: (req: Request, meta: LogMeta) => Promise<Response> | Response) {
  return async (req: Request): Promise<Response> => {
    const t0 = Date.now();
    const meta: LogMeta = {};
    let status = 500;
    try {
      const res = await handler(req, meta);
      status = res.status;
      return res;
    } catch (e) {
      meta.error = String(e).slice(0, 120);
      throw e;
    } finally {
      logEvent('api', { name, status, ms: Date.now() - t0, vid: req.headers.get('x-vid') ?? undefined, ...meta });
    }
  };
}
