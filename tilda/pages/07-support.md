# 07. Персональное сопровождение

**Статус:** ЧЕРНОВИК: не публиковать, пока не подтверждено законное право оказывать эти услуги во Франции.

**Адреса:** RU `/ru/support/` · FR `/fr/support/` · EN `/en/support/` (если Tilda не допускает «/» в адресе страницы, использовать `support-<lang>` и так же исправить hreflang).


---

## Русский (ru)

### SEO

- Title (42): Персональное сопровождение — AINA Évidence

- Description (68): Персональное сопровождение питания: WhatsApp-поддержка и VIP-формат.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/ru/support/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/support/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/support/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/support/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/support/">
<meta name="robots" content="noindex, nofollow">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Сопровождение
- H1: Поддержка на всём пути
- Подзаголовок: Регулярный контакт, корректировки и ответы на вопросы, когда они возникают.

**Блок: карточки услуг** — цены НЕ переносить из этого пакета: в Tilda действует утверждённый прайс.
#### Форматы
- **WhatsApp-сопровождение** — Поддержка и обратная связь в чате, ответы на вопросы и помощь с корректировками в процессе.
- **Премиальное VIP-сопровождение** — Персональный формат с постоянным контактом и контролем прогресса в комфортном для вас темпе.

**Блок: заметка (компонент `tilda/components/03-notice.html` или текстовый блок на лавандовом фоне)**
> Сопровождение не заменяет медицинское наблюдение. При ухудшении самочувствия обращайтесь к врачу.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
#### Выбрать формат
- Поля: Имя *, Email *, Телефон или мессенджер (необязательно), Что вас интересует * (по умолчанию: support), Коротко о вашем запросе (необязательно) (до 500 знаков)
- Подсказка к сообщению: Не указывайте медицинские анализы, диагнозы и другие сведения о здоровье. Их обсудим на консультации.
- Обязательный чекбокс: Я согласен(на) на обработку указанных данных, чтобы ответить на мою заявку. Политика конфиденциальности: → Политика конфиденциальности
- Кнопка: Отправить заявку
- Успех (показывать только после фактической отправки): Спасибо! Заявка получена. Я отвечу вам по указанному email в ближайшее время.
- Ошибка: Не удалось отправить заявку. Попробуйте ещё раз или напишите мне напрямую.


---

## Français (fr)

### SEO

- Title (43): Accompagnement personnalisé — AINA Évidence

- Description (73): Accompagnement nutritionnel personnalisé : suivi WhatsApp et formule VIP.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/fr/support/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/support/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/support/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/support/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/support/">
<meta name="robots" content="noindex, nofollow">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Accompagnement
- H1: Un soutien tout au long du chemin
- Подзаголовок: Un contact régulier, des ajustements et des réponses à vos questions au moment où elles se posent.

**Блок: карточки услуг** — цены НЕ переносить из этого пакета: в Tilda действует утверждённый прайс.
#### Formules
- **Accompagnement par WhatsApp** — Échanges et soutien dans la messagerie, réponses à vos questions et aide aux ajustements au fil du temps.
- **Accompagnement VIP** — Un format personnalisé, avec un contact régulier et un suivi de vos progrès, à un rythme confortable pour vous.

**Блок: заметка (компонент `tilda/components/03-notice.html` или текстовый блок на лавандовом фоне)**
> L’accompagnement ne remplace pas un suivi médical. En cas de dégradation de votre état de santé, consultez un médecin.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
#### Choisir une formule
- Поля: Prénom et nom *, E-mail *, Téléphone ou messagerie (facultatif), Votre demande * (по умолчанию: support), Quelques mots sur votre demande (facultatif) (до 500 знаков)
- Подсказка к сообщению: Ne joignez pas d’analyses médicales, de diagnostics ni d’informations de santé détaillées. Nous en parlerons pendant la consultation.
- Обязательный чекбокс: J’accepte le traitement des données indiquées pour répondre à ma demande. Politique de confidentialité : → Politique de confidentialité
- Кнопка: Envoyer la demande
- Успех (показывать только после фактической отправки): Merci ! Votre demande est bien reçue. Je vous répondrai à l’adresse indiquée.
- Ошибка: La demande n’a pas pu être envoyée. Réessayez ou écrivez-moi directement.


---

## English (en)

### SEO

- Title (31): Ongoing support — AINA Évidence

- Description (68): Personalised nutrition support: WhatsApp follow-up and a VIP format.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/en/support/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/support/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/support/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/support/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/support/">
<meta name="robots" content="noindex, nofollow">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Support
- H1: Support along the way
- Подзаголовок: Regular contact, adjustments and answers to your questions when they come up.

**Блок: карточки услуг** — цены НЕ переносить из этого пакета: в Tilda действует утверждённый прайс.
#### Formats
- **WhatsApp support** — Chat-based follow-up, answers to your questions and help with adjustments along the way.
- **VIP support** — A personal format with regular contact and progress follow-up, at a pace that suits you.

**Блок: заметка (компонент `tilda/components/03-notice.html` или текстовый блок на лавандовом фоне)**
> Support does not replace medical supervision. If your health gets worse, please see a doctor.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
#### Choose a format
- Поля: Name *, Email *, Phone or messenger (optional), What are you interested in? * (по умолчанию: support), A few words about your request (optional) (до 500 знаков)
- Подсказка к сообщению: Please do not include medical test results, diagnoses or detailed health information here. We will discuss them during a consultation.
- Обязательный чекбокс: I agree to the processing of the data above so that my request can be answered. Privacy policy: → Privacy policy
- Кнопка: Send request
- Успех (показывать только после фактической отправки): Thank you! Your request has been received. I will reply to the email address you gave.
- Ошибка: Your request could not be sent. Please try again or write to me directly.
