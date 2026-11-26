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
- **Письменный ответ на один вопрос** — Письменный ответ на один конкретный вопрос о питании. Вопрос и объём ответа согласуются до оплаты.
- **Краткая консультация, 30 минут** — Онлайн-разговор на 30 минут по одному вопросу о питании. Время согласуется до оплаты.
- **Полная консультация, 60–90 минут** — Подробный онлайн-разбор питания и режима дня. Время согласуется до оплаты.
- **Повторная консультация, до 30 минут** — Короткая повторная онлайн-встреча после предыдущей консультации.
- **Обзор анализов в контексте питания** — Обзор результатов анализов только в контексте питания. Это не медицинская диагностика и не назначение лечения. Услуга в черновике до юридической проверки.
- **Расширенная консультация** — Расширенный онлайн-разбор с несколькими встречами по согласованному плану. Объём согласуется до оплаты.
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
- **Réponse écrite à une question** — Réponse écrite à une question précise sur l’alimentation. La question et l’étendue de la réponse sont convenues avant le paiement.
- **Consultation courte, 30 minutes** — Échange en ligne de 30 minutes sur une question d’alimentation. L’horaire est convenu avant le paiement.
- **Consultation complète, 60 à 90 minutes** — Analyse détaillée en ligne de l’alimentation et du rythme de la journée. L’horaire est convenu avant le paiement.
- **Consultation de suivi, jusqu’à 30 minutes** — Court rendez-vous en ligne de suivi après une consultation précédente.
- **Lecture d’analyses dans le contexte alimentaire** — Lecture des résultats d’analyses uniquement dans le contexte alimentaire. Ce n’est ni un diagnostic médical ni une prescription. Service en brouillon jusqu’à la vérification juridique.
- **Consultation approfondie** — Analyse en ligne approfondie avec plusieurs rendez-vous selon un plan convenu. L’étendue est convenue avant le paiement.
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
- **Written answer to one question** — A written answer to one specific nutrition question. The question and the scope of the answer are agreed before payment.
- **Short consultation, 30 minutes** — A 30-minute online call about one nutrition question. The time is agreed before payment.
- **Full consultation, 60–90 minutes** — A detailed online review of nutrition and daily routine. The time is agreed before payment.
- **Follow-up consultation, up to 30 minutes** — A short online follow-up after an earlier consultation.
- **Lab results review in a nutrition context** — A review of lab results only in a nutrition context. It is not a medical diagnosis or treatment. This service is a draft until legal review.
- **Extended consultation** — An extended online review with several sessions under an agreed plan. The scope is agreed before payment.
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
