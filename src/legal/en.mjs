// English courtesy translation of the legal documents. The French version (src/legal/fr.mjs) is the binding text.
// DRAFTS: must be reviewed by a lawyer before publication. Tokens are replaced at build time (see fr.mjs).

export default {
  mentions: {
    title: 'Legal notice',
    description: 'Legal notice for the AINA Évidence website: publisher, publication director and host.',
    notice: 'Courtesy translation. The French version prevails.',
    sections: [
      { h: 'Publisher', items: [
        'Name: {{legal.legalName|name}}',
        'Legal form: {{legal.legalForm|legal form}}',
        'SIREN number: {{legal.siren|SIREN}}',
        'Registration: National business register (Répertoire national des entreprises, RNE)',
        'VAT: {{legal.vatNumber|VAT number or VAT-exemption statement}}',
        'Address: {{legal.address|address}}',
        'Contact: {{contact.email|email}} — {{contact.phone|phone}}',
        'Practitioner: {{owner.displayName|name}}, {{owner.qualification|qualification}}',
      ] },
      { h: 'Publication director', paras: ['{{legal.publicationDirector|publication director}}'] },
      { h: 'Hosting', paras: ['{{legal.hostProvider|name, address and contact of the host}}'] },
      { h: 'Intellectual property', paras: ['The texts, guides, visuals and structure of this site are protected by copyright. Reproduction without written permission is prohibited. Downloaded guides are for personal use only and may not be resold or distributed.'] },
      { h: 'Consumer mediation', paras: ['Under French consumer law, consumers may use a mediator free of charge: {{legal.mediator|mediator, address and website}}.'] },
      { h: 'Nature of the services', paras: ['The services are educational and advisory. They are not a medical diagnosis, treatment or prescription. If you have a medical condition, consult a healthcare professional.'] },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    description: 'How AINA Évidence collects and processes personal data, in line with the GDPR.',
    notice: 'Courtesy translation. The French version prevails.',
    sections: [
      { h: 'Controller', paras: ['{{legal.legalName|name}}, {{legal.address|address}}. Contact: {{contact.email|email}}.'] },
      { h: 'Data we collect', paras: ['Contact form: name, email, phone or messenger (optional), topic, message (optional, max 500 characters). Shop: email, order details and billing information transmitted by the payment provider.', 'The form is not meant for health data. Do not send test results or diagnoses. If such data is sent, it will be deleted as soon as possible.'] },
      { h: 'Purposes and legal bases', items: [
        'Answering your request and arranging a consultation: your consent (GDPR Art. 6(1)(a)).',
        'Delivering a digital product you bought and issuing the invoice: performance of a contract (Art. 6(1)(b)).',
        'Meeting accounting and tax obligations: legal obligation (Art. 6(1)(c)).',
      ] },
      { h: 'Recipients', paras: ['Data is accessible to the controller. It may be shared with the site host, the email service used to reply to requests and, for payments, the payment provider Revolut ({{business.paymentProviderEntity|Revolut contracting entity}}), which processes payment data under its own responsibility. Data is not sold.'] },
      { h: 'Transfers outside the EU', paras: ['Where a provider is located outside the EU, safeguards in line with the GDPR apply. {{policy.transfers|list non-EU providers or state none}}.'] },
      { h: 'Retention', paras: ['Contact requests are kept for {{policy.retentionMonths|number}} months after the last exchange.', 'Accounting documents and invoices are kept for 10 years (Article L123-22 of the French Commercial Code).', 'Data used for marketing is kept for 3 years after the last contact (CNIL recommendations).'] },
      { h: 'Your rights', paras: ['You have the right of access, rectification, erasure, restriction, objection and portability, and you may withdraw consent at any time without affecting earlier processing. To exercise your rights: {{contact.email|email}}.', 'You may lodge a complaint with the CNIL (www.cnil.fr), the French data protection authority.'] },
      { h: 'Security', paras: ['The site uses HTTPS. Data is stored on a server with restricted access. Digital files are reachable only through a personal, time-limited link.'] },
      { h: 'Minors', paras: ['Consultations on child nutrition are requested by a parent or legal guardian, who provides the information about the child.'] },
      { h: 'Cookies', paras: ['See the Cookies page.'] },
      { h: 'Changes', paras: ['This policy may be updated. The version published on this page applies.'] },
    ],
  },
  terms: {
    title: 'Terms of sale',
    description: 'Terms of sale for AINA Évidence consultations and digital products.',
    notice: 'Courtesy translation. The French version prevails.',
    sections: [
      { h: '1. Scope', paras: ['These terms govern online sales of consultations and digital products offered by {{legal.legalName|name}} (the "Seller"). Placing an order means accepting these terms.'] },
      { h: '2. Pre-contract information', paras: ['The main features of each service and product are described on the site before ordering. Prices are in euros, including all applicable taxes.'] },
      { h: '3. Consultations', paras: ['Consultations are delivered online at the agreed time, once confirmed by email. A form request is not a booking. Content is educational and does not replace medical advice.'] },
      { h: '4. Digital products', paras: ['Digital products (PDF guides) are delivered by download after payment is confirmed, via a personal link valid for {{download.validityDays|number}} days, with at most {{download.maxDownloads|number}} downloads.'] },
      { h: '5. Payment', paras: ['Payment is made online on the secure page of the payment provider Revolut ({{business.paymentProviderEntity|Revolut contracting entity}}). Payment methods: {{business.paymentMethods|payment methods}}. An order is validated only once the provider confirms the payment. The amount paid is the amount shown at checkout.'] },
      { h: '6. Right of withdrawal', paras: ['For distance contracts, consumers generally have 14 days to withdraw without giving a reason (Article L221-18 of the French Consumer Code).', 'For digital content not supplied on a tangible medium, the right of withdrawal cannot be exercised once performance has begun with the consumer’s prior express consent and express acknowledgement of losing the right (Article L221-28). This acknowledgement is collected at checkout by a tick box.', 'For consultations, if you ask for the service to start before the withdrawal period ends, you must request it expressly; if you withdraw, you pay only for the part already provided (Article L221-25).'] },
      { h: '7. Legal guarantee of conformity', paras: ['The Seller is bound by the legal guarantee of conformity (Articles L217-1 et seq. of the Consumer Code) and the guarantee against hidden defects. A non-conforming or inaccessible file will be replaced or refunded.'] },
      { h: '8. Liability', paras: ['The advice given is educational. The Seller is not liable for consequences of applying it without regard to your health or of decisions taken without medical advice. This limitation does not apply to damage that the law does not allow to be excluded.'] },
      { h: '9. Mediation', paras: ['In case of dispute you may use this mediator free of charge: {{legal.mediator|mediator, address and website}}.'] },
      { h: '10. Governing law and jurisdiction', paras: ['These terms are governed by {{policy.governingLaw|governing law}}. Mandatory consumer rules of your country of residence remain applicable. Competent court: {{policy.courtLocation|court}}.'] },
      { h: '11. Contact', paras: ['{{contact.email|email}} — {{contact.phone|phone}}'] },
    ],
  },
  refunds: {
    title: 'Refund policy',
    description: 'Cancellation, rescheduling and refund conditions for consultations and digital products.',
    notice: 'Courtesy translation. The French version prevails.',
    sections: [
      { h: 'Consultations', items: [
        'Cancellation or rescheduling: write to {{contact.email|email}} at least {{policy.refundWindowHours|number}} hours before the appointment. Within that period we offer a free rescheduling or a full refund, at your choice; this does not limit your legal rights.',
        'Cancellation within that period: full refund within {{policy.refundDays|number}} days, by the original payment method.',
        'Late cancellation or no-show: {{policy.lateCancellation|rule applied}}.',
      ] },
      { h: 'Digital products', paras: ['A guide not yet downloaded may be refunded under the right-of-withdrawal section of the terms of sale. Once the file has been supplied and the acknowledgement accepted, no refund is due, unless the file is non-conforming or inaccessible through the Seller’s fault; in that case we offer a new link or a refund.'] },
      { h: 'Technical refunds', paras: ['In case of double payment or a technical error, a full refund is made without conditions.'] },
    ],
  },
  digital: {
    title: 'Digital products rules',
    description: 'Access, download and use conditions for digital guides.',
    notice: 'Courtesy translation. The French version prevails.',
    sections: [
      { h: 'Nature of the product', paras: ['Guides are educational PDF files. They do not replace a medical consultation and do not contain prescriptions.'] },
      { h: 'Access and download', items: [
        'The download link is sent by email after payment is confirmed.',
        'Link validity: {{download.validityDays|number}} days. Maximum downloads: {{download.maxDownloads|number}}.',
        'If you did not receive the link, check your spam folder and then write to us. A new link can be issued.',
      ] },
      { h: 'Use', paras: ['For personal use only. The file may not be resold, shared, published or translated for public distribution without written permission.'] },
      { h: 'Right of withdrawal', paras: ['See the terms of sale, section 6: once the content is supplied after your express consent and acknowledgement, the right of withdrawal does not apply.'] },
      { h: 'Conformity', paras: ['If the file is defective or unreadable, report it within 14 days: it will be replaced or refunded.'] },
    ],
  },
  cookies: {
    title: 'Cookies',
    description: 'Cookies and local storage used by the AINA Évidence website.',
    notice: 'Courtesy translation. The French version prevails.',
    sections: [
      { h: 'What we use', paras: ['The site uses no advertising cookies and no audience-measurement cookies. It only stores what is strictly necessary to operate: the contents of your basket in your browser’s local storage.'] },
      { h: 'Consent', paras: ['Items strictly necessary for the service you request do not require prior consent (CNIL guidance). If audience-measurement or advertising tools are added, a consent banner will be shown before anything is stored.'] },
      { h: 'Managing your choices', paras: ['You can clear the basket and the site data at any time in your browser settings.'] },
    ],
  },
};
