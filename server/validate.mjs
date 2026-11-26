// Input validation. Everything from the client is untrusted. Prices are never read from the client.

import { products, CURRENCIES } from '../src/config/catalog.mjs';

export const LOCALES = ['ru', 'fr', 'en'];
export const TOPICS = ['consultation-adult', 'consultation-child', 'correction', 'menu', 'support', 'support-premium', 'community', 'general'];

const EMAIL = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/;
const PHONE = /^\+?[0-9 ()\-.]{6,30}$/;
const HEALTH_HINT = /(диагноз|анализ[ыа]? крови|гемоглобин|ферритин|ferritin|hémoglobine|analyses? sanguines?|diagnos[ie]s?|lab results?|résultats? d'analyses?|biopsy|биопс)/i;

export class ValidationError extends Error {
  constructor(field, message) { super(message); this.field = field; }
}

function str(v, field, { max, min = 0, required = false }) {
  if (v === undefined || v === null || v === '') {
    if (required) throw new ValidationError(field, `${field} is required`);
    return '';
  }
  if (typeof v !== 'string') throw new ValidationError(field, `${field} must be a string`);
  const t = v.trim();
  if (t.length < min) throw new ValidationError(field, `${field} is too short`);
  if (t.length > max) throw new ValidationError(field, `${field} is too long`);
  // reject control characters except newline/tab
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(t)) throw new ValidationError(field, `${field} has invalid characters`);
  return t;
}

export function validateLead(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('body', 'JSON object expected');
  const locale = LOCALES.includes(body.locale) ? body.locale : 'en';
  const name = str(body.name, 'name', { min: 2, max: 120, required: true });
  const email = str(body.email, 'email', { max: 200, required: true }).toLowerCase();
  if (!EMAIL.test(email)) throw new ValidationError('email', 'email is invalid');
  const phone = str(body.phone, 'phone', { max: 40 });
  if (phone && !PHONE.test(phone)) throw new ValidationError('phone', 'phone is invalid');
  const topic = str(body.topic, 'topic', { required: true, max: 40 });
  if (!TOPICS.includes(topic)) throw new ValidationError('topic', 'unknown topic');
  const message = str(body.message, 'message', { max: 500 });
  if (body.consent !== true) throw new ValidationError('consent', 'consent is required');
  // The contact form does not collect health data. Such requests are refused with an explanation, not stored.
  if (HEALTH_HINT.test(message)) throw new ValidationError('message', 'health_data_not_allowed');
  return { locale, name, email, phone, topic, message };
}

export function validateCheckout(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('body', 'JSON object expected');
  const locale = LOCALES.includes(body.locale) ? body.locale : 'en';
  const currency = body.currency === undefined ? 'EUR' : body.currency;
  if (!CURRENCIES.includes(currency)) throw new ValidationError('currency', 'unsupported currency');
  const email = str(body.email, 'email', { max: 200, required: true }).toLowerCase();
  if (!EMAIL.test(email)) throw new ValidationError('email', 'email is invalid');
  // Billing country (ISO 3166-1 alpha-2): needed for the sanctions control before any payment is created.
  const country = typeof body.country === 'string' ? body.country.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(country)) throw new ValidationError('country', 'country is required');
  if (body.acceptTerms !== true) throw new ValidationError('acceptTerms', 'terms must be accepted');
  if (body.acceptDigital !== true) throw new ValidationError('acceptDigital', 'digital waiver must be accepted');
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 10) {
    throw new ValidationError('items', 'between 1 and 10 items expected');
  }
  const seen = new Set();
  const items = body.items.map((it) => {
    // A digital product is bought once: quantity is always 1.
    if (!it || typeof it.sku !== 'string' || it.sku.length > 80 || (it.qty !== undefined && it.qty !== 1)) {
      throw new ValidationError('items', 'invalid item');
    }
    if (seen.has(it.sku)) throw new ValidationError('items', 'duplicate item');
    seen.add(it.sku);
    return { sku: it.sku, qty: 1 };
  });
  return { locale, email, items, currency, country };
}

// Server-side pricing from the catalog. A product can be sold only if it is published, its content is confirmed,
// the owner confirmed its price, and the price exists in the requested (and enabled) currency.
export function priceOrder(items, currency = 'EUR', catalog = products, enabledCurrencies = ['EUR']) {
  if (!enabledCurrencies.includes(currency)) return { error: 'currency_not_enabled' };
  const lines = [];
  for (const it of items) {
    const p = catalog.find((x) => x.sku === it.sku);
    const unit = p?.prices?.[currency];
    if (!p || !p.published || !p.contentConfirmed || !p.priceConfirmed || unit == null) {
      return { error: 'product_unavailable', sku: it.sku };
    }
    lines.push({ sku: p.sku, qty: 1, unitCents: unit, currency, titles: p.i18n, files: p.files });
  }
  // Buying a bundle together with a guide it already contains would sell the same file twice.
  const files = lines.flatMap((l) => l.files);
  if (new Set(files).size !== files.length) return { error: 'bundle_overlap' };
  const amountCents = lines.reduce((s, l) => s + l.unitCents, 0);
  return { lines, amountCents, currency };
}
