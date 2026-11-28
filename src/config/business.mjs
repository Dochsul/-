import { loadRegistration } from './registration.mjs';

// Business facts used across the site, legal pages and checkout.
// RULE: a value is `null` until the owner confirms it in docs/ANKETA.md.
// `npm run build:prod` refuses to build while any required field is null (see src/build.mjs).
// Never fill these from guesses or from other businesses.

export const business = {
  brand: 'AINA Évidence',
  siteUrl: process.env.SITE_URL || null,            // e.g. https://aina-evidence.example (confirm domain)
  contactEmail: 'globalainanutrition@gmail.com',    // known from the previous site; confirm it is the business mailbox
  contactPhone: '+33 6 67 65 03 84',               // known from the previous site; confirm
  // Channels as given by the owner (ноябрь 2026). TikTok is a handle only: the profile URL is not confirmed.
  messenger: { whatsapp: 'https://wa.me/33667650384', telegram: 'https://t.me/+kTsVIJ15dAM5YzY0' },
  // Free community groups. WhatsApp: the group INVITE link (not the personal phone). null until the owner provides it.
  community: { whatsappGroup: null, telegramGroup: 'https://t.me/+kTsVIJ15dAM5YzY0' },
  social: { instagram: 'https://www.instagram.com/aina_evidence/', tiktok: 'AinaEvidence' },
  owner: {
    displayName: 'Айна Мусхаджиева',               // name as used on the site; confirm spelling for legal documents
    // Owner's own statement of qualification, per language. Diploma details (school, year) are to be confirmed (docs/ANKETA.md).
    qualification: {
      ru: 'Консультант по питанию и нутрициологии',
      fr: 'Conseil en nutrition et bien-être',
      en: 'Nutrition and wellness consultant',
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
    refundWindowHours: 24,      // owner decision: consultation cancellation deadline (hours); free rescheduling or full refund
    refundDays: 14,             // owner decision: refund delay after a valid cancellation (days)
    governingLaw: 'droit français, sous réserve des règles impératives de protection du consommateur', // owner decision
    courtLocation: 'tribunaux français compétents selon le droit applicable, notamment le tribunal du domicile du consommateur', // owner decision
    transfers: null,            // non-EU providers used, or 'none'
    lateCancellation: null,     // what applies to late cancellation or no-show
  },
  download: { validityDays: 7, maxDownloads: 5 }, // proposed defaults, to be confirmed by the owner
  paymentMethods: null,         // payment methods actually enabled in Revolut, e.g. 'cartes bancaires, Apple Pay, Google Pay' (confirm in the Revolut dashboard)
  paymentProviderEntity: null,  // legal entity of Revolut that contracts with the merchant (shown in the legal texts; confirm in the merchant agreement)
  pricesConfirmed: false,     // owner confirms the service prices in src/config/services.mjs
  legalReviewed: false,       // lawyer has reviewed legal documents (set true only after review)
  payments: {
    // All providers are OFF until the owner explicitly approves going live (see docs/PAYMENTS.md).
    enabled: process.env.PAYMENTS_ENABLED === 'true',
    revolut: { enabled: true, primary: true, mode: 'api-orders' }, // Merchant API orders; pay-by-link is NOT used for automatic sales (docs/REVOLUT.md)
    stripe: { enabled: false, fallbackOnly: true },                 // kept as a disabled fallback module
    paypal: { enabled: false },
    bankTransfer: { enabled: false, iban: null, bic: null },
  },
  // Sanctions: billing countries for which digital sales are refused. The list is a placeholder
  // that MUST be confirmed by a lawyer against current EU / French sanctions rules (see docs/PAYMENTS.md).
  blockedCountries: ['RU', 'BY'],
};

// Registration data (SIREN, legal name, etc.) comes from the PRIVATE file, never from this repository.
// See src/config/registration.mjs and docs/ANKETA.md, section L. Without the file these stay null.
const registration = loadRegistration();
business.legal = { ...business.legal, ...registration.legal };
business.registration = { loaded: registration.loaded, ...registration.meta };
