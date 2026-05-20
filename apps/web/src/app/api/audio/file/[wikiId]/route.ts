import { promises as fs } from 'node:fs';
import { NextResponse } from 'next/server';
import { findAnyCachedForWiki } from '@/lib/tts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/audio/file/[wikiId]
//
// Stream the cached MP3 for the supplied wikiId. The POST sibling
// endpoint generates the file on first request; this route only serves
// what's already cached. If nothing's cached, 404 so the client knows
// to call POST first.
//
// We honor Range headers so the player can seek without re-downloading
// the full file. Without Range, expo-av's progress UI flickers and
// scrubbing is jittery.
export async function GET(
  request: Request,
  ctx: { params: Promise<{ wikiId: string }> },
): Promise<Response> {
  try {
    const { wikiId } = await ctx.params;
    const filePath = await findAnyCachedForWiki(wikiId);
    if (!filePath) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'no cached audio; call POST first' } },
        { status: 404 },
      );
    }

    const stat = await fs.stat(filePath);
    const totalBytes = stat.size;
    const rangeHeader = request.headers.get('range');

    // No Range header — return the full file. Common path for first-load.
    if (!rangeHeader) {
      const buffer = await fs.readFile(filePath);
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(totalBytes),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // Parse "bytes=START-END" — END is optional and clamps to totalBytes-1.
    const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (!match) {
      return new Response('Invalid Range', { status: 416 });
    }
    const start = Number(match[1]);
    const endRaw = match[2] ? Number(match[2]) : totalBytes - 1;
    const end = Math.min(endRaw, totalBytes - 1);
    if (Number.isNaN(start) || start > end) {
      return new Response('Invalid Range', { status: 416 });
    }
    const chunkSize = end - start + 1;
    // Read just the range. For multi-MB files we could stream — Knowra
    // narration tops out at ~1MB per article so a single read is fine.
    const fd = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(chunkSize);
      await fd.read(buffer, 0, chunkSize, start);
      return new Response(new Uint8Array(buffer), {
        status: 206,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(chunkSize),
          'Content-Range': `bytes ${start}-${end}/${totalBytes}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } finally {
      await fd.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: { code: 'audio_file_unhandled', message } },
      { status: 502 },
    );
  }
}
