import { NextResponse, type NextRequest } from 'next/server';
import { logEvent } from '@/lib/log';

// Anonymous visitor id: hash of IP + user agent + day, so sessions can be told apart without storing the IP.
async function visitorId(ip: string, ua: string) {
  const day = new Date().toISOString().slice(0, 10);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day}|${ip}|${ua}`));
  return [...new Uint8Array(buf)].slice(0, 4).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const device = (ua: string) => (/Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop');
const browser = (ua: string) => (/Edg\//.test(ua) ? 'edge' : /Firefox\//.test(ua) ? 'firefox' : /Chrome\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'other');

export async function proxy(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
  const ua = req.headers.get('user-agent') ?? '';
  const vid = await visitorId(ip, ua);
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/api')) {
    logEvent('visit', { p: pathname, vid, device: device(ua), browser: browser(ua), lang: req.headers.get('accept-language')?.slice(0, 5), ref: req.headers.get('referer') ?? undefined });
  }
  const headers = new Headers(req.headers);
  headers.set('x-vid', vid);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/((?!_next/static|_next/image|maplibre|icon.svg|manifest.webmanifest|favicon.ico).*)'] };
