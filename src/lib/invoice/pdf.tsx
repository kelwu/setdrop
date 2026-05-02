import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { InvoiceData } from './types';

const ORANGE = '#F5A623';
const DARK = '#111827';
const GRAY = '#6B7280';
const LIGHT = '#F9FAFB';
const BORDER = '#E5E7EB';

const s = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    paddingTop: 48,
    paddingBottom: 72,
    paddingLeft: 48,
    paddingRight: 48,
    fontSize: 10,
    color: DARK,
    fontFamily: 'Helvetica',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  logo: { width: 56, height: 56, marginBottom: 10 },
  djName: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: DARK, marginBottom: 3 },
  djInfo: { fontSize: 9, color: GRAY, marginBottom: 2 },
  invoiceTitle: { fontFamily: 'Helvetica-Bold', fontSize: 30, color: ORANGE, textAlign: 'right' },
  invoiceNum: { fontSize: 10, color: GRAY, textAlign: 'right', marginTop: 6 },
  hr: { height: 1, backgroundColor: BORDER, marginTop: 4, marginBottom: 24 },
  infoGrid: { flexDirection: 'row', marginBottom: 28 },
  infoCol: { flex: 1, paddingRight: 16 },
  infoColLast: { flex: 1 },
  sectionHead: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: ORANGE, letterSpacing: 1.5, marginBottom: 10 },
  fieldLbl: { fontSize: 7, color: '#9CA3AF', marginBottom: 2, letterSpacing: 0.5 },
  fieldVal: { fontSize: 10, color: DARK, marginBottom: 8 },
  tblHead: {
    flexDirection: 'row',
    backgroundColor: DARK,
    paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12,
    borderRadius: 2,
    marginBottom: 1,
  },
  tblHeadCell: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#FFFFFF', letterSpacing: 0.8 },
  tblRow: {
    flexDirection: 'row',
    paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tblRowAlt: { backgroundColor: LIGHT },
  tblCell: { fontSize: 10, color: DARK },
  cDesc: { flex: 3 },
  cQty: { flex: 1, textAlign: 'center' },
  cRate: { flex: 1, textAlign: 'right' },
  cAmt: { flex: 1, textAlign: 'right' },
  totals: { alignItems: 'flex-end', marginTop: 16, marginBottom: 28 },
  totalLine: {
    flexDirection: 'row',
    width: 200,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: ORANGE,
    justifyContent: 'space-between',
  },
  totalLbl: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: DARK },
  totalVal: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: ORANGE },
  notesHead: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: ORANGE, letterSpacing: 1.5, marginBottom: 6 },
  notesBody: { fontSize: 9, color: GRAY, lineHeight: 1.6 },
  footer: {
    position: 'absolute',
    bottom: 32, left: 48, right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 10,
  },
  footerTxt: { fontSize: 8, color: '#9CA3AF' },
});

function fmt(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function InvoicePDF({ data }: { data: InvoiceData }) {
  const total = data.lineItems.reduce((sum, i) => sum + i.qty * i.rate, 0);
  const hasEvent = data.eventName || data.eventDate || data.venue;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            {data.logo ? <Image src={data.logo} style={s.logo} /> : null}
            <Text style={s.djName}>{data.djName}</Text>
            {data.company ? <Text style={s.djInfo}>{data.company}</Text> : null}
            {data.djEmail ? <Text style={s.djInfo}>{data.djEmail}</Text> : null}
            {data.djPhone ? <Text style={s.djInfo}>{data.djPhone}</Text> : null}
          </View>
          <View>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            <Text style={s.invoiceNum}>#{data.invoiceNumber}</Text>
          </View>
        </View>

        <View style={s.hr} />

        <View style={s.infoGrid}>
          <View style={s.infoCol}>
            <Text style={s.sectionHead}>BILL TO</Text>
            <Text style={s.fieldVal}>{data.clientName}</Text>
            {data.clientEmail ? <Text style={s.djInfo}>{data.clientEmail}</Text> : null}
          </View>
          {hasEvent ? (
            <View style={s.infoCol}>
              <Text style={s.sectionHead}>EVENT</Text>
              {data.eventName ? (
                <View>
                  <Text style={s.fieldLbl}>NAME</Text>
                  <Text style={s.fieldVal}>{data.eventName}</Text>
                </View>
              ) : null}
              {data.eventDate ? (
                <View>
                  <Text style={s.fieldLbl}>DATE</Text>
                  <Text style={s.fieldVal}>{data.eventDate}</Text>
                </View>
              ) : null}
              {data.venue ? (
                <View>
                  <Text style={s.fieldLbl}>VENUE</Text>
                  <Text style={s.fieldVal}>{data.venue}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={s.infoColLast}>
            <Text style={s.sectionHead}>INVOICE DETAILS</Text>
            <Text style={s.fieldLbl}>INVOICE #</Text>
            <Text style={s.fieldVal}>{data.invoiceNumber}</Text>
            <Text style={s.fieldLbl}>ISSUED</Text>
            <Text style={s.fieldVal}>{data.issueDate}</Text>
            <Text style={s.fieldLbl}>DUE</Text>
            <Text style={s.fieldVal}>{data.dueDate}</Text>
          </View>
        </View>

        <View style={s.tblHead}>
          <Text style={[s.tblHeadCell, s.cDesc]}>DESCRIPTION</Text>
          <Text style={[s.tblHeadCell, s.cQty]}>QTY</Text>
          <Text style={[s.tblHeadCell, s.cRate]}>RATE</Text>
          <Text style={[s.tblHeadCell, s.cAmt]}>AMOUNT</Text>
        </View>
        {data.lineItems.map((item, i) => (
          <View key={item.id} style={[s.tblRow, i % 2 === 1 ? s.tblRowAlt : {}]}>
            <Text style={[s.tblCell, s.cDesc]}>{item.description}</Text>
            <Text style={[s.tblCell, s.cQty]}>{item.qty}</Text>
            <Text style={[s.tblCell, s.cRate]}>{fmt(item.rate, data.currency)}</Text>
            <Text style={[s.tblCell, s.cAmt]}>{fmt(item.qty * item.rate, data.currency)}</Text>
          </View>
        ))}

        <View style={s.totals}>
          <View style={s.totalLine}>
            <Text style={s.totalLbl}>TOTAL</Text>
            <Text style={s.totalVal}>{fmt(total, data.currency)}</Text>
          </View>
        </View>

        {data.notes ? (
          <View>
            <Text style={s.notesHead}>NOTES</Text>
            <Text style={s.notesBody}>{data.notes}</Text>
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>Thank you for your business.</Text>
          <Text style={s.footerTxt}>Generated with SetDrop</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(React.createElement(InvoicePDF, { data }) as any);
}
