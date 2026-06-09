import { NextRequest, NextResponse } from 'next/server';
import { generateInvoicePDF } from '@/lib/invoice/pdf';
import type { InvoiceData } from '@/lib/invoice/types';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
