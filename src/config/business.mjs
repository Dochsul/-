// Business facts used across the site, legal pages and checkout.
// RULE: a value is `null` until the owner confirms it in docs/ANKETA.md.
// `npm run build:prod` refuses to build while any required field is null (see src/build.mjs).
// Never fill these from guesses or from other businesses.

export const business = {
  brand: 'AINA Évidence',
  siteUrl: process.env.SITE_URL || null,            // e.g. https://aina-evidence.example (confirm domain)
  contactEmail: 'globalainanutrition@gmail.com',    // known from the previous site; confirm it is the business mailbox
  contactPhone: '+33 6 67 65 03 84',               // known from the previous site; confirm
  messenger: { whatsapp: 'https://wa.me/33667650384', telegram: 'https://t.me/global_aina_nutrition' },
  owner: {
    displayName: 'Айна Мусхаджиева',               // name as used on the site; confirm spelling for legal documents
    // Owner's own statement of qualification, per language. Diploma details (school, year) are to be confirmed (docs/ANKETA.md).
    qualification: {
      ru: 'Дипломированный консультант-диетолог и нутрициолог',
      fr: 'Conseil en diététique et nutrition, diplômé(e)',
      en: 'Qualified dietitian-nutritionist',
    },
    country: 'FR',
  },
  // ---- Required legal / registration data (all must be filled before production) ----
  legal: {
    legalName: null,          // Raison sociale / nom de l'entreprise individuelle
    legalForm: null,          // e.g. micro-entrepreneur, EI, SAS
    siren: null,
    rcsOrRm: null,            // RCS / RM / not applicable
    vatNumber: null,          // null if VAT-exempt (franchise en base) - confirm
    address: null,            // registered business address
    publicationDirector: null,// Directeur de la publication
    hostProvider: null,       // name, address, contact of the hosting provider
    mediator: null,           // consumer mediator (médiateur de la consommation), required in France
    supervisoryAuthority: 'CNIL', // data protection authority (France)
  },
  // Policy values that the owner must choose (proposals are NOT applied until confirmed in docs/ANKETA.md).
  policy: {
    retentionMonths: null,      // how long contact requests and orders are kept
    refundWindowHours: null,    // consultation cancellation deadline, e.g. 24
    refundDays: null,           // days to refund after a valid cancellation, e.g. 14
    governingLaw: null,         // applicable law for consumer terms (French law for an EU-based seller)
    courtLocation: null,        // competent court for disputes
    transfers: null,            // non-EU providers used, or 'none'
    lateCancellation: null,     // what applies to late cancellation or no-show
  },
  download: { validityDays: 7, maxDownloads: 5 }, // proposed defaults, to be confirmed by the owner
  paymentMethods: null,         // payment methods actually enabled, e.g. 'Stripe (cartes, Apple Pay, Google Pay)'
  pricesConfirmed: false,     // owner confirms the service prices in src/config/services.mjs
  legalReviewed: false,       // lawyer has reviewed legal documents (set true only after review)
  payments: {
    // All providers are OFF until the owner explicitly approves going live (see docs/PAYMENTS.md).
    enabled: process.env.PAYMENTS_ENABLED === 'true',
    stripe: { enabled: false },
    paypal: { enabled: false },
    bankTransfer: { enabled: false, iban: null, bic: null },
  },
  // Sanctions: billing countries for which digital sales are refused. The list is a placeholder
  // that MUST be confirmed by a lawyer against current EU / French sanctions rules (see docs/PAYMENTS.md).
  blockedCountries: ['RU', 'BY'],
};
