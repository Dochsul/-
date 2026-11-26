# 09. Гайды для родителей

**Статус:** Можно публиковать (после проверки блоков магазина и юридических ссылок).

**Адреса:** RU `/ru/guides/` · FR `/fr/guides/` · EN `/en/guides/` (если Tilda не допускает «/» в адресе страницы, использовать `guides-<lang>` и так же исправить hreflang).


---

## Русский (ru)

### SEO

- Title (35): Гайды для родителей — AINA Évidence

- Description (66): Образовательные гайды для родителей по питанию и развитию ребёнка.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/ru/guides/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/guides/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/guides/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/guides/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/guides/">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Гайды
- H1: Образовательные материалы для родителей
- Подзаголовок: Структурированные гайды, которые помогают разобраться в вопросе до консультации или между ними.

**Блок: магазин** — компонент `tilda/components/01-shop.html` (T123). Карточки и цены ниже — для проверки, источник цен: API `/api/catalog`.
- **Аллергия на белок коровьего молока** — Практический гайд для родителей: как организовать питание ребёнка и ориентироваться в продуктах. Не заменяет консультацию врача. Цена: 9,90 € · 1 000 ₽. Статус: скоро (не опубликован).
- **Прикорм: каши и пюре** — Гайд для родителей о введении прикорма: первые блюда, консистенция, режим и наблюдение за реакцией ребёнка. Цена: 7,90 € · 800 ₽. Статус: скоро (не опубликован).
- **Почему ребёнок не спит? Полный гайд для родителей детей от рождения до 18 лет** — Гайд о детском сне по возрастным этапам: ориентиры, режим дня и организация сна в семье. Цена: 9,90 € · 1 000 ₽. Статус: скоро (не опубликован).
- **Комплект из трёх гайдов для родителей** — Три гайда в одном заказе: аллергия на белок коровьего молока, прикорм (каши и пюре), сон ребёнка от рождения до 18 лет. Цена: 19,90 € · 2 000 ₽. Статус: скоро (не опубликован).


---

## Français (fr)

### SEO

- Title (35): Guides pour parents — AINA Évidence

- Description (81): Guides éducatifs pour parents sur l’alimentation et le développement de l’enfant.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/fr/guides/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/guides/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/guides/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/guides/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/guides/">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Guides
- H1: Supports pédagogiques pour parents
- Подзаголовок: Des guides structurés pour mieux comprendre un sujet avant une consultation ou entre deux consultations.

**Блок: магазин** — компонент `tilda/components/01-shop.html` (T123). Карточки и цены ниже — для проверки, источник цен: API `/api/catalog`.
- **Allergie aux protéines du lait de vache** — Guide pratique pour les parents : organiser l'alimentation de l'enfant et lire les étiquettes. Ne remplace pas l'avis d'un médecin. Цена: 9,90 €. Статус: скоро (не опубликован).
- **Première alimentation : bouillies et purées** — Guide pour les parents sur l'introduction de la première alimentation : premiers aliments, textures, rythme et observation de l'enfant. Цена: 7,90 €. Статус: скоро (не опубликован).
- **Pourquoi mon enfant ne dort-il pas ? Le guide complet pour les parents, de la naissance à 18 ans** — Guide sur le sommeil de l'enfant par âge : repères, rythme de la journée et organisation du sommeil en famille. Цена: 9,90 €. Статус: скоро (не опубликован).
- **Pack des trois guides pour parents** — Les trois guides en une seule commande : allergie aux protéines du lait de vache, première alimentation (bouillies et purées), sommeil de l'enfant de la naissance à 18 ans. Цена: 19,90 €. Статус: скоро (не опубликован).


---

## English (en)

### SEO

- Title (29): Parent guides — AINA Évidence

- Description (66): Educational guides for parents on nutrition and child development.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/en/guides/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/guides/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/guides/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/guides/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/guides/">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Guides
- H1: Educational materials for parents
- Подзаголовок: Structured guides to help you understand a topic before a consultation or between sessions.

**Блок: магазин** — компонент `tilda/components/01-shop.html` (T123). Карточки и цены ниже — для проверки, источник цен: API `/api/catalog`.
- **Cow's milk protein allergy** — A practical guide for parents on organising a child's diet and reading food labels. It does not replace medical advice. Цена: €9.90. Статус: скоро (не опубликован).
- **Complementary feeding: cereals and purées** — A parents' guide to introducing complementary foods: first foods, textures, routine and observing your child. Цена: €7.90. Статус: скоро (не опубликован).
- **Why Isn’t My Child Sleeping? A Complete Guide for Parents, from Birth to Age 18** — A guide to children's sleep by age stage: reference points, daily rhythm and organising sleep at home. Цена: €9.90. Статус: скоро (не опубликован).
- **Bundle of the three parent guides** — All three guides in one order: cow's milk protein allergy, complementary feeding (cereals and purées), child sleep from birth to 18 years. Цена: €19.90. Статус: скоро (не опубликован).
