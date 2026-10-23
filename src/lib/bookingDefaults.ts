/**
 * Default checklist for every new booking. IMPORTANT: 'Menu confirmed' and
 * 'Guest count confirmed' are read by the portal SQL function (get_portal) by exact label
 * to drive the customer's Event Journey. Do not rename them without updating sql/003_portal.sql.
 */
export const DEFAULT_CHECKLIST = [
  'Customer confirmed', 'Deposit received', 'Guest count confirmed', 'Menu confirmed', 'Venue confirmed',
  'Vendors confirmed', 'Ingredients purchased', 'Equipment arranged', 'Staff assigned',
  'Final payment received', 'Event preparation complete',
];
export const MENU_LABEL = 'Menu confirmed';
export const GUESTS_LABEL = 'Guest count confirmed';
