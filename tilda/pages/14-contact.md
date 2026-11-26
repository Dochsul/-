# 14. Контакты

**Статус:** Можно публиковать (после проверки блоков магазина и юридических ссылок).

**Адреса:** RU `/ru/contact/` · FR `/fr/contact/` · EN `/en/contact/` (если Tilda не допускает «/» в адресе страницы, использовать `contact-<lang>` и так же исправить hreflang).


---

## Русский (ru)

### SEO

- Title (24): Контакты — AINA Évidence

- Description (75): Контакты AINA Évidence: заявка на консультацию, email, WhatsApp и Telegram.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/ru/contact/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/contact/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/contact/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/contact/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/contact/">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Контакты
- H1: Свяжитесь со мной
- Подзаголовок: Напишите коротко, о чём вы хотите узнать. Ответ придёт по email.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
- Поля: Имя *, Email *, Телефон или мессенджер (необязательно), Что вас интересует * (по умолчанию: general), Коротко о вашем запросе (необязательно) (до 500 знаков)
- Подсказка к сообщению: Не указывайте медицинские анализы, диагнозы и другие сведения о здоровье. Их обсудим на консультации.
- Обязательный чекбокс: Я согласен(на) на обработку указанных данных, чтобы ответить на мою заявку. Политика конфиденциальности: → Политика конфиденциальности
- Кнопка: Отправить заявку
- Успех (показывать только после фактической отправки): Спасибо! Заявка получена. Я отвечу вам по указанному email в ближайшее время.
- Ошибка: Не удалось отправить заявку. Попробуйте ещё раз или напишите мне напрямую.


---

## Français (fr)

### SEO

- Title (23): Contact — AINA Évidence

- Description (79): Contacts AINA Évidence : demande de consultation, e-mail, WhatsApp et Telegram.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/fr/contact/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/contact/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/contact/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/contact/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/contact/">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Contact
- H1: Contactez-moi
- Подзаголовок: Décrivez brièvement votre demande. Je vous réponds par e-mail.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
- Поля: Prénom et nom *, E-mail *, Téléphone ou messagerie (facultatif), Votre demande * (по умолчанию: general), Quelques mots sur votre demande (facultatif) (до 500 знаков)
- Подсказка к сообщению: Ne joignez pas d’analyses médicales, de diagnostics ni d’informations de santé détaillées. Nous en parlerons pendant la consultation.
- Обязательный чекбокс: J’accepte le traitement des données indiquées pour répondre à ma demande. Politique de confidentialité : → Politique de confidentialité
- Кнопка: Envoyer la demande
- Успех (показывать только после фактической отправки): Merci ! Votre demande est bien reçue. Je vous répondrai à l’adresse indiquée.
- Ошибка: La demande n’a pas pu être envoyée. Réessayez ou écrivez-moi directement.


---

## English (en)

### SEO

- Title (23): Contact — AINA Évidence

- Description (74): Contact AINA Évidence: consultation request, email, WhatsApp and Telegram.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/en/contact/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/contact/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/contact/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/contact/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/contact/">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Contact
- H1: Get in touch
- Подзаголовок: Briefly describe what you would like to know. I reply by email.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
- Поля: Name *, Email *, Phone or messenger (optional), What are you interested in? * (по умолчанию: general), A few words about your request (optional) (до 500 знаков)
- Подсказка к сообщению: Please do not include medical test results, diagnoses or detailed health information here. We will discuss them during a consultation.
- Обязательный чекбокс: I agree to the processing of the data above so that my request can be answered. Privacy policy: → Privacy policy
- Кнопка: Send request
- Успех (показывать только после фактической отправки): Thank you! Your request has been received. I will reply to the email address you gave.
- Ошибка: Your request could not be sent. Please try again or write to me directly.
