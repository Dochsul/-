#!/usr/bin/env node
// Generates the Tilda handoff texts from the single source of truth (src/content, src/legal, src/config).
// Output: tilda/pages/NN-<slug>.md (16 pages, RU/FR/EN each; Tilda Free limit is 50) and tilda/seo.csv.
// Usage: node scripts/tilda-export.mjs
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { business } from '../src/config/business.mjs';
import { REGISTRATION_KEYS } from '../src/config/registration.mjs';
import { products } from '../src/config/catalog.mjs';
import { services } from '../src/config/services.mjs';
import { productPriceText } from '../src/render.mjs';
import ru from '../src/content/ru.mjs';
import fr from '../src/content/fr.mjs';
import en from '../src/content/en.mjs';
import legalRu from '../src/legal/ru.mjs';
import legalFr from '../src/legal/fr.mjs';
import legalEn from '../src/legal/en.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// TILDA_FILL=1 writes the registration values into the texts (for the owner's private copy only).
// TILDA_OUT=<dir> changes the output folder (the private copy goes to private/, which git ignores).
const FILL = process.env.TILDA_FILL === '1';
const out = process.env.TILDA_OUT ? resolve(process.env.TILDA_OUT) : join(root, 'tilda', 'pages');
const C = { ru, fr, en };
const LEGAL = { ru: legalRu, fr: legalFr, en: legalEn };
const LANGS = ['ru', 'fr', 'en'];
const LANG_NAME = { ru: 'Русский', fr: 'Français', en: 'English' };
const TODO = { ru: 'УКАЗАТЬ', fr: 'À COMPLÉTER', en: 'TO COMPLETE' };

// The 16 Tilda pages. Status: publish = ready to publish once the shop/legal gates allow it;
// draft = keep unpublished (owner: consultations, menus and support stay drafts until the legal right to provide them
// in France is confirmed); legal-draft = publish only after lawyer review and the questionnaire data is filled in.
export const PAGES = [
  { n: 1, id: 'home', slug: '', status: 'publish' },
  { n: 2, id: 'about', slug: 'about', status: 'publish' },
  { n: 3, id: 'consultations', slug: 'consultations', status: 'draft' },
  { n: 4, id: 'childNutrition', slug: 'child-nutrition', status: 'draft' },
  { n: 5, id: 'adultNutrition', slug: 'adult-nutrition', status: 'draft' },
  { n: 6, id: 'menus', slug: 'menus', status: 'draft' },
  { n: 7, id: 'support', slug: 'support', status: 'draft' },
  { n: 8, id: 'shop', slug: 'shop', status: 'publish' },
  { n: 9, id: 'guides', slug: 'guides', status: 'publish' },
  { n: 10, id: 'reviews', slug: 'reviews', status: 'publish' },
  { n: 11, id: 'community', slug: 'community', status: 'publish' },
  { n: 12, id: 'blog', slug: 'blog', status: 'publish' },
  { n: 13, id: 'faq', slug: 'faq', status: 'publish' },
  { n: 14, id: 'contact', slug: 'contact', status: 'publish' },
  // Tilda Free allows 50 pages per project. Legal documents share two pages (anchors inside a page):
  // privacy page = privacy + cookies + legal notice; terms page = terms of sale + refunds + digital products.
  { n: 15, legal: ['privacy', 'cookies', 'mentions'], seoDoc: 'privacy', slug: 'legal/privacy', status: 'legal-draft' },
  { n: 16, legal: ['terms', 'refunds', 'digital'], seoDoc: 'terms', slug: 'legal/terms-of-sale', status: 'legal-draft' },
];

const STATUS_TEXT = {
  publish: 'Можно публиковать (после проверки блоков магазина и юридических ссылок).',
  draft: 'ЧЕРНОВИК: не публиковать, пока не подтверждено законное право оказывать эти услуги во Франции.',
  'legal-draft': 'ЮРИДИЧЕСКИЙ ЧЕРНОВИК: не публиковать до заполнения анкеты (docs/ANKETA.md) и проверки юристом.',
};

const pagePath = (lang, slug) => `/${lang}/${slug ? slug + '/' : ''}`;

// Plain-text token resolution for legal documents (Markdown output, not HTML).
function lookup(path, lang) {
  const map = {
    'contact.email': business.contactEmail, 'contact.phone': business.contactPhone,
    'owner.displayName': business.owner.displayName, 'owner.qualification': business.owner.qualification[lang],
    'business.paymentMethods': business.paymentMethods,
    'business.paymentProviderEntity': business.paymentProviderEntity,
  };
  // Registration values are never written into the repository (it is public): the owner copies them from the private file.
  if (path.startsWith('legal.') && REGISTRATION_KEYS.includes(path.slice(6))) {
    if (!FILL) return `[из личного реестра: ${path}]`;
    return business.legal[path.slice(6)] ?? null;
  }
  if (path in map) return map[path];
  const [g, k] = path.split('.');
  return ({ legal: business.legal, policy: business.policy, download: business.download }[g] || {})[k];
}
export const missingTokens = new Set();
function tokens(text, lang) {
  return String(text).replace(/\{\{([^|}]+)\|?([^}]*)\}\}/g, (_, p, label) => {
    const v = lookup(p.trim(), lang);
    if (v === null || v === undefined || v === '') { missingTokens.add(p.trim()); return `**[${TODO[lang]}: ${label || p}]**`; }
    return String(v);
  });
}

function sectionMd(s, c, lang) {
  const L = [];
  const h = (t) => t && L.push(`#### ${t}`);
  const btn = (label, href) => `[${label}](${pagePath(lang, href.replace(/\/$/, ''))})`;
  switch (s.type) {
    case 'hero':
      L.push('**Блок: обложка (первый экран)**');
      if (s.eyebrow) L.push(`- Надзаголовок: ${s.eyebrow}`);
      L.push(`- H1: ${s.h1}`);
      if (s.lead) L.push(`- Подзаголовок: ${s.lead}`);
      for (const a of s.actions || []) L.push(`- Кнопка${a.primary ? ' (основная, золотая, тёмный текст)' : ' (контурная)'}: ${btn(a.label, a.href)}`);
      break;
    case 'text': L.push('**Блок: текст**'); h(s.h); L.push(...s.paras); break;
    case 'list': L.push('**Блок: список**'); h(s.h); L.push(...s.items.map((i) => `- ${i}`)); break;
    case 'cards': case 'steps':
      L.push(`**Блок: ${s.type === 'steps' ? 'шаги (нумерация 01, 02…)' : 'карточки'}**`); h(s.h);
      L.push(...s.items.map((i, k) => `${s.type === 'steps' ? `${k + 1}.` : '-'} **${i.t}** — ${i.p}`)); break;
    case 'cta': L.push('**Блок: призыв (фон: градиент пудра → лаванда)**'); h(s.h); if (s.p) L.push(s.p); L.push(`- Кнопка: ${btn(s.label, s.href)}`); break;
    case 'communityLinks':
      L.push('**Блок: два бесплатных вступления (две отдельные кнопки)**. Цена не указывается; платных условий участия нет.');
      for (const it of s.items) {
        const href = it.platform === 'whatsapp' ? (business.community?.whatsappGroup || `[${s.pendingWhatsapp}]`) : business.community?.telegramGroup;
        L.push(`- **${it.h}** — кнопка «${it.button}» → ${href}`);
        for (const x of it.items) L.push(`  - ${x}`);
      }
      break;
    case 'notice': L.push('**Блок: заметка (компонент `tilda/components/03-notice.html` или текстовый блок на лавандовом фоне)**'); L.push(...[].concat(s.p).map((p) => `> ${p}`)); break;
    case 'empty': L.push('**Блок: пустое состояние**'); h(s.h); L.push(s.p); if (s.cta) L.push(`- Кнопка: ${btn(s.cta.label, s.cta.href)}`); break;
    case 'services':
      L.push('**Блок: карточки услуг** — цены НЕ переносить из этого пакета: в Tilda действует утверждённый прайс.'); h(s.h);
      for (const svc of services.filter((x) => x.group === s.group)) L.push(`- **${c.services[svc.id].t}** — ${c.services[svc.id].p}`);
      break;
    case 'lead': {
      const f = c.forms.lead;
      L.push('**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)'); h(s.h); if (s.p) L.push(s.p);
      L.push(`- Поля: ${f.name} *, ${f.email} *, ${f.phone}, ${f.topic} * (по умолчанию: ${s.topic}), ${f.message} (до 500 знаков)`);
      L.push(`- Подсказка к сообщению: ${f.messageHint}`);
      L.push(`- Обязательный чекбокс: ${f.consent} → ${c.legalLinks.privacy}`);
      L.push(`- Кнопка: ${f.submit}`);
      L.push(`- Успех (показывать только после фактической отправки): ${f.success}`);
      L.push(`- Ошибка: ${f.error}`);
      break;
    }
    case 'faq': L.push('**Блок: вопросы и ответы**'); h(s.h); for (const i of s.items) L.push(`- **${i.q}**\n  ${i.a}`); break;
    case 'products':
      L.push('**Блок: магазин** — компонент `tilda/components/01-shop.html` (T123). Карточки и цены ниже — для проверки, источник цен: API `/api/catalog`.');
      for (const p of products) {
        const t = p.i18n[lang];
        const state = p.published ? 'в продаже' : 'скоро (не опубликован)';
        const priceTxt = p.priceConfirmed ? `Цена: ${productPriceText(p, lang, c)}` : `Цена: не утверждена (${c.ui.priceToConfirm})`;
        L.push(`- **${t.title}** — ${t.summary} ${priceTxt}. Статус: ${state}.`);
      }
      break;
    default: L.push(`_(служебный блок ${s.type})_`);
  }
  return L.join('\n');
}

function seoFor(page, lang) {
  if (page.legal) {
    const d = LEGAL[lang][page.seoDoc];
    return { title: `${d.title} — ${business.brand}`, description: d.description };
  }
  const p = C[lang].pages[page.id];
  return { title: p.title, description: p.description };
}

function headSnippet(page, lang) {
  const urls = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="{DOMAIN}${pagePath(l, page.slug)}">`);
  const robots = page.status === 'publish' ? '' : '\n<meta name="robots" content="noindex, nofollow">';
  const ld = [];
  if (page.id === 'home') ld.push({ '@context': 'https://schema.org', '@type': 'Organization', name: business.brand, url: `{DOMAIN}/${lang}/`, email: business.contactEmail, telephone: business.contactPhone });
  if (page.id === 'about') ld.push({ '@context': 'https://schema.org', '@type': 'Person', name: business.owner.displayName, jobTitle: business.owner.qualification[lang], worksFor: { '@type': 'Organization', name: business.brand } });
  if (page.id === 'faq') {
    const faq = C[lang].pages.faq.sections.find((s) => s.type === 'faq');
    ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })) });
  }
  return [
    `<link rel="canonical" href="{DOMAIN}${pagePath(lang, page.slug)}">`,
    ...urls,
    `<link rel="alternate" hreflang="x-default" href="{DOMAIN}${pagePath('en', page.slug)}">${robots}`,
    ...ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`),
  ].join('\n');
}

function legalMd(page, lang) {
  const docs = page.legal.map((key) => ({ key, ...LEGAL[lang][key] }));
  const L = [];
  if (lang !== 'fr') L.push(`> ${lang === 'ru' ? 'Краткое изложение на русском. Юридически обязательна французская версия.' : 'Courtesy translation. The French version prevails.'}`);
  L.push(`> ${{ ru: 'Черновик. Не публиковать до проверки юристом.', fr: 'Brouillon. Ne pas publier avant relecture par un juriste.', en: 'Draft. Do not publish before review by a lawyer.' }[lang]}`);
  docs.forEach((d) => {
    L.push(`### ${d.title}`);
    L.push(`Якорь блока (Tilda, «Настройки блока → Якорь»): \`${d.key}\``);
    for (const s of d.sections) {
      L.push(`#### ${s.h}`);
      for (const p of s.paras || []) L.push(tokens(p, lang));
      for (const it of s.items || []) L.push(`- ${tokens(it, lang)}`);
    }
  });
  return L.join('\n\n');
}

export function exportAll() {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const seoRows = [['n', 'page', 'lang', 'path', 'status', 'title', 'title_len', 'description', 'description_len', 'robots']];
  const files = [];
  for (const page of PAGES) {
    const name = `${String(page.n).padStart(2, '0')}-${(page.slug || 'home').replace(/\//g, '-')}`;
    const L = [];
    const titleRu = seoFor(page, 'ru').title.split(' — ')[0];
    L.push(`# ${String(page.n).padStart(2, '0')}. ${titleRu}`);
    L.push(`**Статус:** ${STATUS_TEXT[page.status]}`);
    L.push(`**Адреса:** ${LANGS.map((l) => `${l.toUpperCase()} \`${pagePath(l, page.slug)}\``).join(' · ')} (если Tilda не допускает «/» в адресе страницы, использовать \`${(page.slug || 'home').replace(/\//g, '-')}-<lang>\` и так же исправить hreflang).`);
    for (const lang of LANGS) {
      const seo = seoFor(page, lang);
      L.push(`\n---\n\n## ${LANG_NAME[lang]} (${lang})`);
      L.push(`### SEO`);
      L.push(`- Title (${seo.title.length}): ${seo.title}`);
      L.push(`- Description (${seo.description.length}): ${seo.description}`);
      L.push(`- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).`);
      L.push(`- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить \`{DOMAIN}\` на адрес сайта):\n\n\`\`\`html\n${headSnippet(page, lang)}\n\`\`\``);
      L.push(`### Тексты`);
      if (page.legal) L.push(legalMd(page, lang));
      else L.push(C[lang].pages[page.id].sections.map((s) => sectionMd(s, C[lang], lang)).join('\n\n'));
      seoRows.push([page.n, page.legal ? page.legal.join("+") : page.id, lang, pagePath(lang, page.slug), page.status, seo.title, seo.title.length, seo.description, seo.description.length, page.status === 'publish' ? 'index, follow' : 'noindex, nofollow']);
    }
    writeFileSync(join(out, `${name}.md`), L.join('\n\n') + '\n', 'utf8');
    files.push(name);
  }
  const csv = seoRows.map((r) => r.map((v) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n') + '\r\n';
  writeFileSync(join(out, '..', 'seo.csv'), csv, 'utf8');
  return { files, seoRows: seoRows.length - 1 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = exportAll();
  console.log(`Exported ${r.files.length} pages × 3 languages → tilda/pages/, ${r.seoRows} SEO rows → tilda/seo.csv`);
  if (missingTokens.size) console.log(`Legal placeholders to fill (docs/ANKETA.md): ${[...missingTokens].join(', ')}`);
}
