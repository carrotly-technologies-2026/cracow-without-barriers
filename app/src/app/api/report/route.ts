import { NextResponse } from 'next/server';
import { addReport, confirmReport, listReports, rateLimited, REPORT_TYPES, type ReportType } from '@/lib/reports';
export const dynamic = 'force-dynamic';

export async function GET() { return NextResponse.json({ reports: await listReports() }); }

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const clientId = typeof b?.clientId === 'string' ? b.clientId.slice(0, 40) : '';
  if (!clientId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  if (rateLimited(clientId)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  if (b.confirmId) {
    const r = await confirmReport(String(b.confirmId), clientId);
    return r ? NextResponse.json({ report: r }) : NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!Number.isFinite(b.lat) || !Number.isFinite(b.lon) || !REPORT_TYPES.includes(b.type as ReportType)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const r = await addReport({ lat: b.lat, lon: b.lon, type: b.type, note: typeof b.note === 'string' ? b.note : undefined, clientId });
  return NextResponse.json({ report: r }, { status: 201 });
}
