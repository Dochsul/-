// Digital products. Prices are exactly as approved by the owner (never changed or rounded here).
// prices: minor units per currency (EUR cents, RUB kopecks). priceConfirmed: the owner approved these prices.
// RUB prices are stored and displayed, but RUB payments stay OFF (ENABLED_CURRENCIES) until a lawful working payment channel is confirmed.
// published:false keeps a product off the shop and out of checkout.
// contentConfirmed:false means the author has not yet confirmed the content outline.
// files: SKUs of the PDF files delivered for this product. Files live in private/products/<file-sku>.pdf
// (never committed, never served statically, delivered only through /api/download/<token>).

export const products = [
  {
    sku: 'cow-milk-protein-allergy-guide', // АБКМ: аллергия на белок коровьего молока
    prices: { EUR: 990, RUB: 100000 }, // approved by the owner
    priceConfirmed: true,
    published: false,
    contentConfirmed: false,
    files: ['cow-milk-protein-allergy-guide'],
    preview: null, // path to a public preview PDF, added only after the author approves it
    i18n: {
      ru: { title: 'Аллергия на белок коровьего молока', summary: 'Практический гайд для родителей: как организовать питание ребёнка и ориентироваться в продуктах. Не заменяет консультацию врача.', topics: ['Организация питания', 'Чтение состава продуктов', 'Вопросы для врача'] },
      fr: { title: 'Allergie aux protéines du lait de vache', summary: "Guide pratique pour les parents : organiser l'alimentation de l'enfant et lire les étiquettes. Ne remplace pas l'avis d'un médecin.", topics: ['Organisation des repas', 'Lecture des étiquettes', 'Questions pour le médecin'] },
      en: { title: "Cow's milk protein allergy", summary: 'A practical guide for parents on organising a child\'s diet and reading food labels. It does not replace medical advice.', topics: ['Organising meals', 'Reading food labels', 'Questions for your doctor'] },
    },
  },
  {
    sku: 'complementary-feeding-guide',
    prices: { EUR: 790, RUB: 80000 }, // approved by the owner
    priceConfirmed: true,
    published: false,
    contentConfirmed: false,
    files: ['complementary-feeding-guide'],
    preview: null,
    i18n: {
      ru: { title: 'Прикорм: каши и пюре', summary: 'Гайд для родителей о введении прикорма: первые блюда, консистенция, режим и наблюдение за реакцией ребёнка.', topics: ['Первые блюда', 'Консистенция и текстуры', 'Режим и наблюдение'] },
      fr: { title: "Première alimentation : bouillies et purées", summary: "Guide pour les parents sur l'introduction de la première alimentation : premiers aliments, textures, rythme et observation de l'enfant.", topics: ['Premiers aliments', 'Textures', 'Rythme et observation'] },
      en: { title: 'Complementary feeding: cereals and purées', summary: "A parents' guide to introducing complementary foods: first foods, textures, routine and observing your child.", topics: ['First foods', 'Textures', 'Routine and observation'] },
    },
  },
  {
    sku: 'child-sleep-guide-0-18',
    prices: { EUR: 990, RUB: 100000 }, // approved by the owner
    priceConfirmed: true,
    published: false,
    contentConfirmed: false,
    files: ['child-sleep-guide-0-18'],
    preview: null,
    i18n: {
      ru: { title: 'Почему ребёнок не спит? Полный гайд для родителей детей от рождения до 18 лет', summary: 'Гайд о детском сне по возрастным этапам: ориентиры, режим дня и организация сна в семье.', topics: ['Возрастные этапы', 'Режим дня', 'Организация сна в семье'] },
      fr: { title: "Pourquoi mon enfant ne dort-il pas ? Guide complet pour les parents d’enfants de la naissance à 18 ans", summary: "Guide sur le sommeil de l'enfant par âge : repères, rythme de la journée et organisation du sommeil en famille.", topics: ['Étapes par âge', 'Rythme de la journée', "Organisation du sommeil en famille"] },
      en: { title: 'Why Won’t My Child Sleep? A Complete Guide for Parents of Children from Birth to 18', summary: 'A guide to children\'s sleep by age stage: reference points, daily rhythm and organising sleep at home.', topics: ['Age stages', 'Daily rhythm', 'Organising sleep at home'] },
    },
  },
  {
    sku: 'parent-guides-bundle',
    // Approved by the owner: 19,90 € and 2 000 ₽ for the bundle of the three guides (cheaper than the three separately).
    prices: { EUR: 1990, RUB: 200000 },
    priceConfirmed: true,
    published: false,          // stays hidden until the three PDF files exist and their content is confirmed (owner)
    contentConfirmed: false,
    files: ['cow-milk-protein-allergy-guide', 'complementary-feeding-guide', 'child-sleep-guide-0-18'],
    preview: null,
    i18n: {
      ru: { title: 'Комплект из трёх гайдов для родителей', summary: 'Три гайда в одном заказе: аллергия на белок коровьего молока, прикорм (каши и пюре), сон ребёнка от рождения до 18 лет.', topics: ['Аллергия на белок коровьего молока', 'Прикорм: каши и пюре', 'гайд «Почему ребёнок не спит?»'] },
      fr: { title: 'Pack des trois guides pour parents', summary: "Les trois guides en une seule commande : allergie aux protéines du lait de vache, première alimentation (bouillies et purées), sommeil de l'enfant de la naissance à 18 ans.", topics: ['Allergie aux protéines du lait de vache', 'Première alimentation : bouillies et purées', "Sommeil de l'enfant, de la naissance à 18 ans"] },
      en: { title: 'Bundle of the three parent guides', summary: "All three guides in one order: cow's milk protein allergy, complementary feeding (cereals and purées), child sleep from birth to 18 years.", topics: ["Cow's milk protein allergy", 'Complementary feeding: cereals and purées', 'Child sleep from birth to 18 years'] },
    },
  },
];

export const CURRENCIES = ['EUR', 'RUB'];
export const fileSkus = () => [...new Set(products.flatMap((p) => p.files))];
