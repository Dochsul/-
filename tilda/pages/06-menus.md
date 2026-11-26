# 06. Индивидуальные меню

**Статус:** ЧЕРНОВИК: не публиковать, пока не подтверждено законное право оказывать эти услуги во Франции.

**Адреса:** RU `/ru/menus/` · FR `/fr/menus/` · EN `/en/menus/` (если Tilda не допускает «/» в адресе страницы, использовать `menus-<lang>` и так же исправить hreflang).


---

## Русский (ru)

### SEO

- Title (35): Индивидуальные меню — AINA Évidence

- Description (56): Индивидуальные меню под ваши цели, предпочтения и режим.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/ru/menus/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/menus/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/menus/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/menus/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/menus/">
<meta name="robots" content="noindex, nofollow">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Меню
- H1: Индивидуальные меню
- Подзаголовок: Меню создаётся под ваши цели, предпочтения, ограничения и режим дня.

**Блок: текст**
#### Как это устроено
Сначала мы обсуждаем цели и контекст. Затем составляю меню. Состав, объём и формат согласуются с вами до начала.

**Блок: карточки услуг** — цены НЕ переносить из этого пакета: в Tilda действует утверждённый прайс.
#### Стоимость
- **Меню на 7 дней** — Меню на 7 дней с расчётом КБЖУ, рецептами и списком покупок.
- **Меню на 14 дней** — Меню на 14 дней с расчётом КБЖУ, рецептами и списком покупок.
- **Меню-конструктор на месяц** — Месячный набор блюд, из которого вы собираете меню. Состав согласуется до оплаты.
- **Детское индивидуальное меню** — Меню для ребёнка с учётом возраста и согласованных пищевых ограничений. Не заменяет консультацию врача.
- **Меню кормящей мамы** — Меню для кормящей мамы с учётом режима и согласованных ограничений.
- **Меню беременной** — Меню для беременной с учётом срока и согласованных ограничений. Решения о лечении принимает только врач.
- **Меню с учётом подтверждённых врачом ограничений** — Меню с учётом ограничений, подтверждённых вашим врачом. Документ врача нужен до начала работы.
- **Меню для пары** — Меню на двоих с учётом индивидуальных целей каждого.
- **Семейное меню** — Меню для семьи с учётом возраста и предпочтений каждого участника.
- **Индивидуальное меню** — Меню, составленное под ваши цели, предпочтения и режим. Итоговый состав и объём согласуются с вами.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
#### Заказать меню
- Поля: Имя *, Email *, Телефон или мессенджер (необязательно), Что вас интересует * (по умолчанию: menu), Коротко о вашем запросе (необязательно) (до 500 знаков)
- Подсказка к сообщению: Не указывайте медицинские анализы, диагнозы и другие сведения о здоровье. Их обсудим на консультации.
- Обязательный чекбокс: Я согласен(на) на обработку указанных данных, чтобы ответить на мою заявку. Политика конфиденциальности: → Политика конфиденциальности
- Кнопка: Отправить заявку
- Успех (показывать только после фактической отправки): Спасибо! Заявка получена. Я отвечу вам по указанному email в ближайшее время.
- Ошибка: Не удалось отправить заявку. Попробуйте ещё раз или напишите мне напрямую.


---

## Français (fr)

### SEO

- Title (35): Menus personnalisés — AINA Évidence

- Description (73): Menus personnalisés selon vos objectifs, vos préférences et votre rythme.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/fr/menus/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/menus/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/menus/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/menus/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/menus/">
<meta name="robots" content="noindex, nofollow">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Menus
- H1: Menus personnalisés
- Подзаголовок: Un menu établi selon vos objectifs, vos préférences, vos contraintes et votre rythme.

**Блок: текст**
#### Fonctionnement
Nous commençons par vos objectifs et votre contexte. Je prépare ensuite le menu. Le contenu, le volume et le format sont validés avec vous avant le début.

**Блок: карточки услуг** — цены НЕ переносить из этого пакета: в Tilda действует утверждённый прайс.
#### Tarifs
- **Menu de 7 jours** — Menu de 7 jours avec calcul des apports, recettes et liste de courses.
- **Menu de 14 jours** — Menu de 14 jours avec calcul des apports, recettes et liste de courses.
- **Menu-constructeur sur un mois** — Un ensemble de plats pour un mois, à partir duquel vous composez vos menus. Le contenu est convenu avant le paiement.
- **Menu individuel pour enfant** — Menu pour un enfant selon son âge et les restrictions alimentaires convenues. Ne remplace pas l’avis d’un médecin.
- **Menu pour maman qui allaite** — Menu pour une maman qui allaite, selon son rythme et les restrictions convenues.
- **Menu pour femme enceinte** — Menu pour une femme enceinte selon le stade de la grossesse et les restrictions convenues. Les décisions médicales relèvent du médecin.
- **Menu avec restrictions confirmées par un médecin** — Menu tenant compte de restrictions confirmées par votre médecin. Le document du médecin est nécessaire avant le début du travail.
- **Menu pour un couple** — Menu pour deux personnes, selon les objectifs individuels de chacun.
- **Menu familial** — Menu pour la famille selon l’âge et les préférences de chaque membre.
- **Menu personnalisé** — Un menu établi selon vos objectifs, vos préférences et votre rythme. Le contenu et le volume sont convenus avec vous.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
#### Commander un menu
- Поля: Prénom et nom *, E-mail *, Téléphone ou messagerie (facultatif), Votre demande * (по умолчанию: menu), Quelques mots sur votre demande (facultatif) (до 500 знаков)
- Подсказка к сообщению: Ne joignez pas d’analyses médicales, de diagnostics ni d’informations de santé détaillées. Nous en parlerons pendant la consultation.
- Обязательный чекбокс: J’accepte le traitement des données indiquées pour répondre à ma demande. Politique de confidentialité : → Politique de confidentialité
- Кнопка: Envoyer la demande
- Успех (показывать только после фактической отправки): Merci ! Votre demande est bien reçue. Je vous répondrai à l’adresse indiquée.
- Ошибка: La demande n’a pas pu être envoyée. Réessayez ou écrivez-moi directement.


---

## English (en)

### SEO

- Title (34): Personalised menus — AINA Évidence

- Description (68): Personalised menus built around your goals, preferences and routine.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/en/menus/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/menus/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/menus/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/menus/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/menus/">
<meta name="robots" content="noindex, nofollow">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Menus
- H1: Personalised menus
- Подзаголовок: A menu built around your goals, preferences, constraints and daily routine.

**Блок: текст**
#### How it works
We start with your goals and context. I then prepare the menu. Content, portions and format are agreed with you before we begin.

**Блок: карточки услуг** — цены НЕ переносить из этого пакета: в Tilda действует утверждённый прайс.
#### Pricing
- **7-day menu** — A 7-day menu with nutrient calculations, recipes and a shopping list.
- **14-day menu** — A 14-day menu with nutrient calculations, recipes and a shopping list.
- **Monthly menu builder** — A monthly set of dishes from which you build your menus. The content is agreed before payment.
- **Individual menu for a child** — A menu for a child, taking into account age and agreed dietary restrictions. It does not replace a doctor’s advice.
- **Menu for breastfeeding mothers** — A menu for a breastfeeding mother, taking into account her routine and agreed restrictions.
- **Menu for pregnancy** — A menu for a pregnant woman, taking into account the stage of pregnancy and agreed restrictions. Medical decisions belong to a doctor.
- **Menu with restrictions confirmed by a doctor** — A menu taking into account restrictions confirmed by your doctor. The doctor’s document is needed before work starts.
- **Menu for two** — A menu for two people, taking into account each person’s goals.
- **Family menu** — A menu for the family, taking into account the age and preferences of each member.
- **Personalised menu** — A menu built around your goals, preferences and routine. Content and portions are agreed with you.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
#### Order a menu
- Поля: Name *, Email *, Phone or messenger (optional), What are you interested in? * (по умолчанию: menu), A few words about your request (optional) (до 500 знаков)
- Подсказка к сообщению: Please do not include medical test results, diagnoses or detailed health information here. We will discuss them during a consultation.
- Обязательный чекбокс: I agree to the processing of the data above so that my request can be answered. Privacy policy: → Privacy policy
- Кнопка: Send request
- Успех (показывать только после фактической отправки): Thank you! Your request has been received. I will reply to the email address you gave.
- Ошибка: Your request could not be sent. Please try again or write to me directly.
