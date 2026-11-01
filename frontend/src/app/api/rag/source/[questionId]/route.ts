import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error: 'SOURCE_VIEWER_DISABLED',
      message: 'Source Viewer has been removed from this frontend extension.',
    },
    { status: 410 },
  );
}
