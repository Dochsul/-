// Digital products. Prices are NOT invented: `priceCents` stays null until the owner sets it.
// `published: false` keeps a product off the shop and out of checkout.
// `contentConfirmed: false` means the content outline has not yet been confirmed by the author.
// Files live in private/products/<sku>.pdf (never committed, never served statically).

export const products = [
  {
    sku: 'cow-milk-protein-allergy-guide',
    currency: 'EUR',
    priceCents: null,
    published: false,
    contentConfirmed: false,
    file: 'private/products/cow-milk-protein-allergy-guide.pdf',
    preview: null, // path to a public preview PDF, added only after the author approves it
    i18n: {
      ru: { title: 'Аллергия на белок коровьего молока', summary: 'Практический гайд для родителей: как организовать питание ребёнка и ориентироваться в продуктах. Не заменяет консультацию врача.', topics: ['Организация питания', 'Чтение состава продуктов', 'Вопросы для врача'] },
      fr: { title: 'Allergie aux protéines du lait de vache', summary: "Guide pratique pour les parents : organiser l'alimentation de l'enfant et lire les étiquettes. Ne remplace pas l'avis d'un médecin.", topics: ['Organisation des repas', 'Lecture des étiquettes', 'Questions pour le médecin'] },
      en: { title: "Cow's milk protein allergy", summary: 'A practical guide for parents on organising a child\'s diet and reading food labels. It does not replace medical advice.', topics: ['Organising meals', 'Reading food labels', 'Questions for your doctor'] },
    },
  },
  {
    sku: 'complementary-feeding-guide',
    currency: 'EUR',
    priceCents: null,
    published: false,
    contentConfirmed: false,
    file: 'private/products/complementary-feeding-guide.pdf',
    preview: null,
    i18n: {
      ru: { title: 'Прикорм: каши и пюре', summary: 'Гайд для родителей о введении прикорма: первые блюда, консистенция, режим и наблюдение за реакцией ребёнка.', topics: ['Первые блюда', 'Консистенция и текстуры', 'Режим и наблюдение'] },
      fr: { title: "Première alimentation : bouillies et purées", summary: "Guide pour les parents sur l'introduction de la première alimentation : premiers aliments, textures, rythme et observation de l'enfant.", topics: ['Premiers aliments', 'Textures', 'Rythme et observation'] },
      en: { title: 'Complementary feeding: cereals and purées', summary: "A parents' guide to introducing complementary foods: first foods, textures, routine and observing your child.", topics: ['First foods', 'Textures', 'Routine and observation'] },
    },
  },
  {
    sku: 'child-sleep-guide-0-18',
    currency: 'EUR',
    priceCents: null,
    published: false,
    contentConfirmed: false,
    file: 'private/products/child-sleep-guide-0-18.pdf',
    preview: null,
    i18n: {
      ru: { title: 'Сон ребёнка от рождения до 18 лет', summary: 'Гайд о детском сне по возрастным этапам: ориентиры, режим дня и организация сна в семье.', topics: ['Возрастные этапы', 'Режим дня', 'Организация сна в семье'] },
      fr: { title: "Sommeil de l'enfant, de la naissance à 18 ans", summary: "Guide sur le sommeil de l'enfant par âge : repères, rythme de la journée et organisation du sommeil en famille.", topics: ['Étapes par âge', 'Rythme de la journée', "Organisation du sommeil en famille"] },
      en: { title: 'Child sleep from birth to 18 years', summary: 'A guide to children\'s sleep by age stage: reference points, daily rhythm and organising sleep at home.', topics: ['Age stages', 'Daily rhythm', 'Organising sleep at home'] },
    },
  },
];
