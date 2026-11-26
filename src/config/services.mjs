// Service catalogue (owner's list, ноябрь 2026). Every service stays in the catalogue; none is deleted.
//   rub: approved RUB price from the owner's list (null = not approved; shown as "to confirm").
//   eur: European tariff. null = NOT active. Set only after the owner approves a European tariff.
//   regulated: consultations, menus and support are regulated or require legal confirmation.
//            They stay drafts (not published) until a lawyer confirms in writing (docs/LEGAL_PLAN.md).
//   legacy: earlier items from the previous site. Their 15 € price is NOT used (owner decision).
// The guides (PDF) are in src/config/catalog.mjs, not here.

export const services = [
  // ---- consultations: owner's list ----
  { id: 'consult-written', group: 'consultations', rub: 500, eur: null, regulated: true, topic: 'consultation-written' },
  { id: 'consult-short', group: 'consultations', rub: 1500, eur: null, regulated: true, topic: 'consultation-short' },
  { id: 'consult-full', group: 'consultations', rub: 3000, eur: null, regulated: true, topic: 'consultation-full' },
  { id: 'consult-repeat', group: 'consultations', rub: 1500, eur: null, regulated: true, topic: 'consultation-repeat' },
  { id: 'consult-labs', group: 'consultations', rub: 2000, eur: null, regulated: true, topic: 'consultation-labs' },
  { id: 'consult-extended', group: 'consultations', rub: 4000, eur: null, regulated: true, topic: 'consultation-extended' },
  // ---- menus: owner's list ----
  { id: 'menu-7', group: 'menus', rub: 1500, eur: null, regulated: true, topic: 'menu' },
  { id: 'menu-14', group: 'menus', rub: 2500, eur: null, regulated: true, topic: 'menu' },
  { id: 'menu-constructor', group: 'menus', rub: 3500, eur: null, regulated: true, topic: 'menu' },
  { id: 'menu-child', group: 'menus', rub: 3500, eur: null, regulated: true, topic: 'menu' },
  { id: 'menu-breastfeeding', group: 'menus', rub: 3500, eur: null, regulated: true, topic: 'menu' },
  { id: 'menu-pregnancy', group: 'menus', rub: 4000, eur: null, regulated: true, topic: 'menu' },
  { id: 'menu-restrictions', group: 'menus', rub: 5000, eur: null, regulated: true, topic: 'menu' },
  { id: 'menu-couple', group: 'menus', rub: 6000, eur: null, regulated: true, topic: 'menu' },
  { id: 'menu-family', group: 'menus', rub: 7000, eur: null, regulated: true, topic: 'menu' },
  // ---- support: owner's list ----
  { id: 'support-7', group: 'support', rub: 2500, eur: null, regulated: true, topic: 'support' },
  { id: 'support-14', group: 'support', rub: 4500, eur: null, regulated: true, topic: 'support' },
  { id: 'support-month', group: 'support', rub: 8000, eur: null, regulated: true, topic: 'support' },
  { id: 'support-month-extended', group: 'support', rub: 12000, eur: null, regulated: true, topic: 'support' },
  { id: 'support-3-months', group: 'support', rub: 22000, eur: null, regulated: true, topic: 'support' },
  // ---- earlier items kept in the catalogue; price not approved ----
  { id: 'adult-consultation', group: 'consultations', rub: null, eur: null, regulated: true, legacy: true, topic: 'consultation-adult' },
  { id: 'child-consultation', group: 'consultations', rub: null, eur: null, regulated: true, legacy: true, topic: 'consultation-child' },
  { id: 'nutrition-correction', group: 'consultations', rub: null, eur: null, regulated: true, legacy: true, topic: 'correction' },
  { id: 'individual-menu', group: 'menus', rub: null, eur: null, regulated: true, legacy: true, topic: 'menu' },
  { id: 'whatsapp-support', group: 'support', rub: null, eur: null, regulated: true, legacy: true, topic: 'support' },
  { id: 'premium-support', group: 'support', rub: null, eur: null, regulated: true, legacy: true, topic: 'support-premium' },
];
