// Free community section and the service catalogue split (RUB approved / EUR pending). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { services } from '../src/config/services.mjs';
import { business } from '../src/config/business.mjs';
import ru from '../src/content/ru.mjs';
import fr from '../src/content/fr.mjs';
import en from '../src/content/en.mjs';

const LANGS = { ru, fr, en };
const TELEGRAM = 'https://t.me/+kTsVIJ15dAM5YzY0';

test('community: two free buttons per language, Telegram link is the owner’s, no form, no purchase', () => {
  for (const [lang, c] of Object.entries(LANGS)) {
    const sec = c.pages.community.sections;
    const links = sec.find((s) => s.type === 'communityLinks');
    assert.ok(links, `${lang}: communityLinks block exists`);
    assert.equal(links.items.length, 2, `${lang}: exactly two groups`);
    assert.deepEqual(links.items.map((i) => i.platform), ['whatsapp', 'telegram']);
    for (const it of links.items) {
      assert.ok(it.button && it.button.length > 5, `${lang}: button label for ${it.platform}`);
      assert.ok(it.items.length >= 3, `${lang}: topics listed for ${it.platform}`);
    }
    assert.ok(!sec.some((s) => s.type === 'lead'), `${lang}: no launch-signup form left in the community section`);
    const text = JSON.stringify(sec);
    assert.doesNotMatch(text, /€|₽|EUR|RUB|корзин|panier|cart/i, `${lang}: no prices or cart wording in the free section`);
    assert.ok(/без подписки.*платного вступления|sans abonnement.*inscription payante|no subscription.*paid entry/.test(sec.find((x) => x.type === 'notice')?.p ?? sec.filter((x) => x.type === 'notice').map((x) => x.p).join(' ')), `${lang}: states that there is no subscription and no paid entry`);
    assert.ok(/бесплатн|gratuit|free/i.test(text), `${lang}: free status stated`);
  }
  assert.equal(business.community.telegramGroup, TELEGRAM);
});

test('community: the WhatsApp group is an invite link, never the owner’s personal phone', () => {
  const wa = business.community.whatsappGroup;
  if (wa !== null) {
    assert.match(wa, /^https:\/\/(chat\.whatsapp\.com\/|whatsapp\.com\/channel\/)/, 'group invite link');
  }
  assert.notEqual(wa, business.messenger.whatsapp, 'the personal WhatsApp number is not the group');
});

test('community: the Russian topics match the owner’s list', () => {
  const tg = ru.pages.community.sections.find((s) => s.type === 'communityLinks').items.find((i) => i.platform === 'telegram');
  for (const topic of ['Детское питание и прикорм', 'АБКМ и лактазная недостаточность', 'Грудное вскармливание и молочные смеси', 'Сон и развитие детей', 'Психология и материнство', 'Здоровье и благополучие мам']) {
    assert.ok(tg.items.includes(topic), topic);
  }
});

test('services: every item from the owner’s list is present with its approved RUB price', () => {
  const owner = {
    'consult-written': 500, 'consult-short': 1500, 'consult-full': 3000, 'consult-repeat': 1500, 'consult-labs': 2000, 'consult-extended': 4000,
    'menu-7': 1500, 'menu-14': 2500, 'menu-constructor': 3500, 'menu-child': 3500, 'menu-breastfeeding': 3500, 'menu-pregnancy': 4000,
    'menu-restrictions': 5000, 'menu-couple': 6000, 'menu-family': 7000,
    'support-7': 2500, 'support-14': 4500, 'support-month': 8000, 'support-month-extended': 12000, 'support-3-months': 22000,
  };
  const byId = Object.fromEntries(services.map((s) => [s.id, s]));
  for (const [id, rub] of Object.entries(owner)) {
    assert.ok(byId[id], `${id} is in the catalogue`);
    assert.equal(byId[id].rub, rub, `${id} RUB price`);
  }
});

test('services: no EUR price is active; the old 15 € price is not used anywhere', () => {
  for (const s of services) {
    assert.equal(s.eur, null, `${s.id}: EUR tariff stays inactive until the owner approves it`);
    assert.ok(s.price === undefined, `${s.id}: the single shared price field is gone`);
  }
});

test('services: earlier items are kept, not deleted, and carry no approved price', () => {
  for (const id of ['adult-consultation', 'child-consultation', 'nutrition-correction', 'individual-menu', 'whatsapp-support', 'premium-support']) {
    const s = services.find((x) => x.id === id);
    assert.ok(s, `${id} kept`);
    assert.equal(s.rub, null, `${id} has no approved price`);
    assert.equal(s.legacy, true);
  }
});

test('services: every consultation, menu and support item is marked regulated (draft until legal confirmation)', () => {
  for (const s of services) assert.equal(s.regulated, true, `${s.id} regulated flag`);
});

test('services: each service has text in all three languages', () => {
  for (const [lang, c] of Object.entries(LANGS)) {
    for (const s of services) assert.ok(c.services[s.id] && c.services[s.id].t && c.services[s.id].p, `${lang}: ${s.id}`);
  }
});
