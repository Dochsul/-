// Customer emails. Each message is localised (ru, fr, en). Download links are personal and limited; PDFs are never attached
// (an attachment cannot be revoked after a refund and would expose the file to anyone who gets the mailbox).

const T = {
  ru: {
    subject: (n) => `AINA Évidence: ваши гайды (${n})`,
    hello: 'Здравствуйте!',
    paid: 'Оплата подтверждена. Спасибо за покупку.',
    links: 'Ваши персональные ссылки для скачивания:',
    rules: (days, max) => `Каждая ссылка действует ${days} дн. и позволяет скачать файл не более ${max} раз.`,
    privacy: 'Не пересылайте это письмо: ссылки персональные.',
    help: (mail) => `Если ссылка не открывается, ответьте на это письмо или напишите на ${mail}: мы выдадим новую.`,
    order: 'Номер заказа',
    note: 'Гайды носят образовательный характер и не заменяют консультацию врача.',
    sign: 'AINA Évidence',
  },
  fr: {
    subject: (n) => `AINA Évidence : vos guides (${n})`,
    hello: 'Bonjour,',
    paid: 'Votre paiement est confirmé. Merci pour votre achat.',
    links: 'Vos liens de téléchargement personnels :',
    rules: (days, max) => `Chaque lien est valable ${days} jours et permet ${max} téléchargements au maximum.`,
    privacy: 'Ne transférez pas cet e-mail : les liens sont personnels.',
    help: (mail) => `Si un lien ne s’ouvre pas, répondez à cet e-mail ou écrivez à ${mail} : nous vous enverrons un nouveau lien.`,
    order: 'Numéro de commande',
    note: 'Les guides ont une vocation éducative et ne remplacent pas une consultation médicale.',
    sign: 'AINA Évidence',
  },
  en: {
    subject: (n) => `AINA Évidence: your guides (${n})`,
    hello: 'Hello,',
    paid: 'Your payment is confirmed. Thank you for your purchase.',
    links: 'Your personal download links:',
    rules: (days, max) => `Each link is valid for ${days} days and allows up to ${max} downloads.`,
    privacy: 'Please do not forward this email: the links are personal.',
    help: (mail) => `If a link does not open, reply to this email or write to ${mail} and we will send a new one.`,
    order: 'Order number',
    note: 'The guides are educational and do not replace a medical consultation.',
    sign: 'AINA Évidence',
  },
};

export function deliveryEmail({ locale, links, validityDays, maxDownloads, supportEmail, orderId }) {
  const t = T[locale] || T.en;
  const body = [
    t.hello, '', t.paid, '', t.links, '',
    ...links.map((l) => `• ${l.title}\n  ${l.url}`), '',
    t.rules(validityDays, maxDownloads), t.privacy, '',
    t.help(supportEmail), '',
    `${t.order}: ${orderId}`, '', t.note, '', t.sign,
  ].join('\n');
  return { subject: t.subject(links.length), body };
}
