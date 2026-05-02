import { NextRequest, NextResponse } from 'next/server';
import { generateInvoicePDF } from '@/lib/invoice/pdf';
import type { InvoiceData } from '@/lib/invoice/types';

export async function POST(req: NextRequest) {
  try {
    const data: InvoiceData = await req.json();
    const buffer = await generateInvoicePDF(data);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${data.invoiceNumber}.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[invoice/generate]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
