import { NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import { ReportPDF } from '@/components/ReportPDF';

export async function POST(req: Request) {
  try {
    const reportModel = await req.json();

    if (!reportModel || !reportModel.metadata?.domain) {
      return NextResponse.json({ error: 'Valid ReportModel required for PDF generation.' }, { status: 400 });
    }

    const stream = await renderToStream(ReportPDF({ model: reportModel }));
    
    // Type casting needed because ReactDOMServer's stream output slightly differs from generic Web ReadableStream typings
    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="inboxshield-${reportModel.metadata.domain}-report.pdf"`,
      },
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
