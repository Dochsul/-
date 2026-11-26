// Input validation. Everything from the client is untrusted. Prices are never read from the client.

import { products } from '../src/config/catalog.mjs';
import { business } from '../src/config/business.mjs';

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
  const email = str(body.email, 'email', { max: 200, required: true }).toLowerCase();
  if (!EMAIL.test(email)) throw new ValidationError('email', 'email is invalid');
  if (body.acceptTerms !== true) throw new ValidationError('acceptTerms', 'terms must be accepted');
  if (body.acceptDigital !== true) throw new ValidationError('acceptDigital', 'digital waiver must be accepted');
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 10) {
    throw new ValidationError('items', 'between 1 and 10 items expected');
  }
  const seen = new Set();
  const items = body.items.map((it) => {
    if (!it || typeof it.sku !== 'string' || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > 10) {
      throw new ValidationError('items', 'invalid item');
    }
    if (seen.has(it.sku)) throw new ValidationError('items', 'duplicate item');
    seen.add(it.sku);
    return { sku: it.sku, qty: it.qty };
  });
  return { locale, email, items };
}

// Server-side pricing from the catalog. Unpublished products or unconfirmed prices cannot be bought.
export function priceOrder(items, catalog = products, pricesConfirmed = business.pricesConfirmed) {
  if (!pricesConfirmed) return { error: 'prices_not_confirmed' };
  const lines = [];
  for (const it of items) {
    const p = catalog.find((x) => x.sku === it.sku);
    if (!p || !p.published || p.priceCents == null || !p.contentConfirmed) return { error: 'product_unavailable', sku: it.sku };
    lines.push({ sku: p.sku, qty: it.qty, unitCents: p.priceCents, currency: p.currency, titles: p.i18n });
  }
  const currencies = new Set(lines.map((l) => l.currency));
  if (currencies.size !== 1) return { error: 'mixed_currency' };
  const amountCents = lines.reduce((s, l) => s + l.unitCents * l.qty, 0);
  return { lines, amountCents, currency: lines[0].currency };
}
