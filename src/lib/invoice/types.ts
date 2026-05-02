export interface LineItem {
  id: string;
  description: string;
  qty: number;
  rate: number;
}

export interface InvoiceData {
  djName: string;
  company: string;
  djEmail: string;
  djPhone: string;
  logo: string;
  clientName: string;
  clientEmail: string;
  eventName: string;
  eventDate: string;
  venue: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  lineItems: LineItem[];
  notes: string;
}
