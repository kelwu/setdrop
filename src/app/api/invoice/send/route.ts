import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { generateInvoicePDF } from '@/lib/invoice/pdf';
import type { InvoiceData } from '@/lib/invoice/types';

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { invoiceData, recipientEmail }: { invoiceData: InvoiceData; recipientEmail: string } = await req.json();

    const buffer = await generateInvoicePDF(invoiceData);

    const resend = new Resend(apiKey);
    // Set RESEND_FROM_EMAIL to a verified domain address for production.
    // For testing, use onboarding@resend.dev (only sends to your Resend account email).
    const from = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';

    const { error } = await resend.emails.send({
      from,
      to: recipientEmail,
      subject: `Invoice ${invoiceData.invoiceNumber} from ${invoiceData.djName}`,
      html: `
        <p>Hi ${invoiceData.clientName},</p>
        <p>Please find your invoice attached from <strong>${invoiceData.djName}</strong>${invoiceData.company ? ` / ${invoiceData.company}` : ''}.</p>
        ${invoiceData.eventName ? `<p><strong>Event:</strong> ${invoiceData.eventName}${invoiceData.eventDate ? ` — ${invoiceData.eventDate}` : ''}</p>` : ''}
        <p>Thank you!</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="color:#9CA3AF;font-size:12px">Sent via <a href="https://setdrop.app" style="color:#F5A623">SetDrop</a></p>
      `,
      attachments: [{
        filename: `invoice-${invoiceData.invoiceNumber}.pdf`,
        content: Buffer.from(buffer).toString('base64'),
      }],
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[invoice/send]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
