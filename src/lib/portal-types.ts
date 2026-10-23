// Shape returned by the get_portal() SQL function. This is the ONLY data the portal ever sees.
export interface PortalData {
  state: 'ok';
  business: { name: string; logo_url: string | null; cover_url: string | null; primary_color: string; secondary_color: string; welcome_message: string | null; phone: string | null; whatsapp: string | null; email: string | null; location: string | null; business_type: string };
  customer_first_name: string;
  event: {
    name: string; event_type: string; event_date: string; status: string; cover_image_url: string | null;
    guest_count: number | null; start_time: string | null; end_time: string | null; venue: string | null; venue_address: string | null;
    services: string[] | null; booked_items: string[] | null; customer_notes: string | null; next_step: string | null; next_step_due: string | null;
    show_progress: boolean; show_payment: boolean; deposit_received: boolean; menu_confirmed: boolean; guest_count_confirmed: boolean; fully_paid: boolean;
  };
  payment: { total: number; paid: number; balance: number; due_date: string | null } | null;
  appointments: { title: string; starts_at: string; location: string | null }[];
  expires_at: string;
}
export type PortalResult = PortalData | { state: 'invalid' | 'revoked' | 'expired' };
