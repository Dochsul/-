# 03. Консультации по питанию онлайн

**Статус:** ЧЕРНОВИК: не публиковать, пока не подтверждено законное право оказывать эти услуги во Франции.

**Адреса:** RU `/ru/consultations/` · FR `/fr/consultations/` · EN `/en/consultations/` (если Tilda не допускает «/» в адресе страницы, использовать `consultations-<lang>` и так же исправить hreflang).


---

## Русский (ru)

### SEO

- Title (46): Консультации по питанию онлайн — AINA Évidence

- Description (80): Онлайн-консультации по питанию для взрослых и детей. Формат, стоимость и запись.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/ru/consultations/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/consultations/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/consultations/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/consultations/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/consultations/">
<meta name="robots" content="noindex, nofollow">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Консультации
- H1: Консультации по питанию онлайн
- Подзаголовок: Индивидуальная работа по вашему запросу, на понятном языке и с объяснением причин рекомендаций.

**Блок: шаги (нумерация 01, 02…)**
#### Как проходит работа
1. **Заявка** — Вы оставляете короткий запрос.
2. **Знакомство** — Уточняю цели, режим и контекст.
3. **Консультация** — Разбираем ситуацию и даём рекомендации.
4. **Сопровождение** — При необходимости — поддержка и корректировки.

**Блок: карточки услуг** — цены НЕ переносить из этого пакета: в Tilda действует утверждённый прайс.
#### Услуги
- **Онлайн-консультация по питанию (взрослые)** — Разбираем цели, рацион, режим дня и привычки. Помогаю понять, с чего начать, без жёстких ограничений.
- **Онлайн-консультация по детскому питанию** — Разбираем питание ребёнка по возрасту, режим и вопросы, с которыми обращаются родители.
- **Коррекция текущего питания** — Вносим изменения в уже существующий рацион и режим, учитывая ваши цели и возможности.

**Блок: заметка (компонент `tilda/components/03-notice.html` или текстовый блок на лавандовом фоне)**
> Консультации носят образовательный характер и не заменяют медицинскую помощь.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
#### Записаться на консультацию
Заявка не означает записи. Запись подтверждается мной по email.
- Поля: Имя *, Email *, Телефон или мессенджер (необязательно), Что вас интересует * (по умолчанию: consultation-adult), Коротко о вашем запросе (необязательно) (до 500 знаков)
- Подсказка к сообщению: Не указывайте медицинские анализы, диагнозы и другие сведения о здоровье. Их обсудим на консультации.
- Обязательный чекбокс: Я согласен(на) на обработку указанных данных, чтобы ответить на мою заявку. Политика конфиденциальности: → Политика конфиденциальности
- Кнопка: Отправить заявку
- Успех (показывать только после фактической отправки): Спасибо! Заявка получена. Я отвечу вам по указанному email в ближайшее время.
- Ошибка: Не удалось отправить заявку. Попробуйте ещё раз или напишите мне напрямую.


---

## Français (fr)

### SEO

- Title (48): Consultations nutrition en ligne — AINA Évidence

- Description (88): Consultations nutrition en ligne pour adultes et enfants. Format, tarifs et réservation.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/fr/consultations/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/consultations/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/consultations/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/consultations/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/consultations/">
<meta name="robots" content="noindex, nofollow">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Consultations
- H1: Consultations nutrition en ligne
- Подзаголовок: Un accompagnement individuel selon votre demande, avec des explications claires sur chaque recommandation.

**Блок: шаги (нумерация 01, 02…)**
#### Déroulement
1. **Demande** — Vous envoyez une demande courte.
2. **Échange préalable** — Je précise vos objectifs, votre rythme et votre contexte.
3. **Consultation** — Nous analysons la situation et je fais mes recommandations.
4. **Suivi** — Si nécessaire, un accompagnement et des ajustements.

**Блок: карточки услуг** — цены НЕ переносить из этого пакета: в Tilda действует утверждённый прайс.
#### Services
- **Consultation nutrition en ligne (adulte)** — Nous examinons vos objectifs, votre alimentation, votre rythme de vie et vos habitudes. Je vous aide à savoir par où commencer, sans restrictions rigides.
- **Consultation en ligne alimentation de l’enfant** — Nous examinons l’alimentation de l’enfant selon son âge, son rythme et les questions les plus fréquentes des parents.
- **Ajustement de l’alimentation actuelle** — J’adapte votre alimentation et votre rythme existants, en tenant compte de vos objectifs et de vos possibilités.

**Блок: заметка (компонент `tilda/components/03-notice.html` или текстовый блок на лавандовом фоне)**
> Les consultations ont une vocation éducative et ne remplacent pas un avis médical.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
#### Prendre rendez-vous
Une demande ne constitue pas une réservation. Le rendez-vous est confirmé par e-mail.
- Поля: Prénom et nom *, E-mail *, Téléphone ou messagerie (facultatif), Votre demande * (по умолчанию: consultation-adult), Quelques mots sur votre demande (facultatif) (до 500 знаков)
- Подсказка к сообщению: Ne joignez pas d’analyses médicales, de diagnostics ni d’informations de santé détaillées. Nous en parlerons pendant la consultation.
- Обязательный чекбокс: J’accepte le traitement des données indiquées pour répondre à ma demande. Politique de confidentialité : → Politique de confidentialité
- Кнопка: Envoyer la demande
- Успех (показывать только после фактической отправки): Merci ! Votre demande est bien reçue. Je vous répondrai à l’adresse indiquée.
- Ошибка: La demande n’a pas pu être envoyée. Réessayez ou écrivez-moi directement.


---

## English (en)

### SEO

- Title (46): Online nutrition consultations — AINA Évidence

- Description (83): Online nutrition consultations for adults and children. Format, prices and booking.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/en/consultations/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/consultations/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/consultations/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/consultations/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/consultations/">
<meta name="robots" content="noindex, nofollow">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Consultations
- H1: Online nutrition consultations
- Подзаголовок: Personal work based on your request, in clear language, with the reasons behind each recommendation.

**Блок: шаги (нумерация 01, 02…)**
#### How it works
1. **Request** — You send a short request.
2. **Introduction** — I clarify your goals, routine and context.
3. **Consultation** — We review your situation and I give recommendations.
4. **Follow-up** — If needed, ongoing support and adjustments.

**Блок: карточки услуг** — цены НЕ переносить из этого пакета: в Tilda действует утверждённый прайс.
#### Services
- **Online nutrition consultation (adults)** — We look at your goals, diet, daily routine and habits. I help you understand where to start, without rigid restrictions.
- **Online child nutrition consultation** — We look at your child’s nutrition by age, routine and the questions parents most often ask.
- **Adjustment of current diet** — I adapt your existing diet and routine, taking into account your goals and what is realistic for you.

**Блок: заметка (компонент `tilda/components/03-notice.html` или текстовый блок на лавандовом фоне)**
> Consultations are educational and do not replace medical care.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
#### Book a consultation
A request is not a booking. Your appointment is confirmed by me by email.
- Поля: Name *, Email *, Phone or messenger (optional), What are you interested in? * (по умолчанию: consultation-adult), A few words about your request (optional) (до 500 знаков)
- Подсказка к сообщению: Please do not include medical test results, diagnoses or detailed health information here. We will discuss them during a consultation.
- Обязательный чекбокс: I agree to the processing of the data above so that my request can be answered. Privacy policy: → Privacy policy
- Кнопка: Send request
- Успех (показывать только после фактической отправки): Thank you! Your request has been received. I will reply to the email address you gave.
- Ошибка: Your request could not be sent. Please try again or write to me directly.
