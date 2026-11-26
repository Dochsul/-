// Consultation services. Prices come from the previous site and are NOT yet confirmed by the owner.
// Until business.pricesConfirmed === true the production build is blocked, and price labels show "to confirm".
// Services are booked through the lead form (no online payment in this stage).

export const services = [
  { id: 'adult-consultation', price: 15, currency: 'EUR', group: 'consultations', topic: 'consultation-adult' },
  { id: 'child-consultation', price: 15, currency: 'EUR', group: 'consultations', topic: 'consultation-child' },
  { id: 'nutrition-correction', price: 15, currency: 'EUR', group: 'consultations', topic: 'correction' },
  { id: 'individual-menu', price: 15, priceFrom: true, currency: 'EUR', group: 'menus', topic: 'menu' },
  { id: 'whatsapp-support', price: 15, priceFrom: true, currency: 'EUR', group: 'support', topic: 'support' },
  { id: 'premium-support', price: 80, currency: 'EUR', group: 'support', topic: 'support-premium' },
];
