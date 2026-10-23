export interface Business {
  id: string; name: string; slug: string; business_type: string; services: string[];
  phone: string | null; whatsapp: string | null; email: string | null; location: string | null;
  description: string | null; welcome_message: string | null; primary_color: string; secondary_color: string;
  logo_url: string | null; cover_url: string | null; onboarded: boolean;
}
export interface Customer {
  id: string; business_id: string; name: string; phone: string | null; whatsapp: string | null; email: string | null;
  address: string | null; preferred_contact: string; notes: string | null; created_at: string;
}
export interface EventRow {
  id: string; business_id: string; customer_id: string; booking_number: string | null; name: string; event_type: string;
  event_date: string; start_time: string | null; end_time: string | null; venue: string | null; venue_address: string | null;
  guest_count: number; description: string | null; special_instructions: string | null; services: string[]; status: string;
  discount: number; additional_charges: number; delivery_fee: number; service_fee: number; deposit_required: number;
  payment_due_date: string | null; allow_overpayment: boolean; internal_notes: string | null; customer_notes: string | null;
  next_step: string | null; next_step_due: string | null;
  show_event_details: boolean; show_services: boolean; show_progress: boolean; show_payment: boolean; show_venue: boolean; show_notes: boolean;
  cover_image_url: string | null; created_at: string; updated_at?: string;
}
export interface Financials { event_id: string; business_id: string; subtotal: number; total: number; paid: number; balance: number; payment_status: string }
export interface Payment { id: string; event_id: string; amount: number; paid_on: string; method: string; reference: string | null; note: string | null; created_at: string }
export interface BookingItem { id?: string; service: string; description: string | null; quantity: number; unit_price: number; sort?: number }
export interface Task { id: string; event_id: string | null; title: string; due_date: string | null; priority: string; status: string; notes: string | null }
export interface Portal { id: string; event_id: string; customer_id: string; created_at: string; expires_at: string; revoked_at: string | null; last_accessed_at: string | null; access_count: number }
