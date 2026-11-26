# 11. Сообщество «Мамы и дети»

**Статус:** Можно публиковать (после проверки блоков магазина и юридических ссылок).

**Адреса:** RU `/ru/community/` · FR `/fr/community/` · EN `/en/community/` (если Tilda не допускает «/» в адресе страницы, использовать `community-<lang>` и так же исправить hreflang).


---

## Русский (ru)

### SEO

- Title (40): Сообщество «Мамы и дети» — AINA Évidence

- Description (101): Сообщество для родителей: вопросы о питании и развитии детей, поддержка. Запуск и правила уточняются.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/ru/community/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/community/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/community/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/community/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/community/">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Сообщество
- H1: Мамы и дети
- Подзаголовок: Пространство для родителей: вопросы о питании и развитии, поддержка и полезные материалы.

**Блок: текст**
#### Как это будет работать
Формат, площадка и правила сообщества уточняются. Оставьте email, и я сообщу о запуске.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
#### Хочу узнать о запуске
- Поля: Имя *, Email *, Телефон или мессенджер (необязательно), Что вас интересует * (по умолчанию: community), Коротко о вашем запросе (необязательно) (до 500 знаков)
- Подсказка к сообщению: Не указывайте медицинские анализы, диагнозы и другие сведения о здоровье. Их обсудим на консультации.
- Обязательный чекбокс: Я согласен(на) на обработку указанных данных, чтобы ответить на мою заявку. Политика конфиденциальности: → Политика конфиденциальности
- Кнопка: Отправить заявку
- Успех (показывать только после фактической отправки): Спасибо! Заявка получена. Я отвечу вам по указанному email в ближайшее время.
- Ошибка: Не удалось отправить заявку. Попробуйте ещё раз или напишите мне напрямую.

**Блок: заметка (компонент `tilda/components/03-notice.html` или текстовый блок на лавандовом фоне)**
> Сообщество не является медицинской службой. Экстренные вопросы — к врачу или в службу экстренной помощи.


---

## Français (fr)

### SEO

- Title (48): Communauté « Mamans et enfants » — AINA Évidence

- Description (120): Communauté pour parents : questions sur l’alimentation et le développement de l’enfant. Lancement et règles à confirmer.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/fr/community/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/community/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/community/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/community/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/community/">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Communauté
- H1: Mamans et enfants
- Подзаголовок: Un espace pour les parents : questions sur l’alimentation et le développement, soutien et ressources utiles.

**Блок: текст**
#### Fonctionnement
La plateforme, le format et les règles de la communauté sont en cours de définition. Laissez votre e-mail et je vous préviendrai du lancement.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
#### Être informée du lancement
- Поля: Prénom et nom *, E-mail *, Téléphone ou messagerie (facultatif), Votre demande * (по умолчанию: community), Quelques mots sur votre demande (facultatif) (до 500 знаков)
- Подсказка к сообщению: Ne joignez pas d’analyses médicales, de diagnostics ni d’informations de santé détaillées. Nous en parlerons pendant la consultation.
- Обязательный чекбокс: J’accepte le traitement des données indiquées pour répondre à ma demande. Politique de confidentialité : → Politique de confidentialité
- Кнопка: Envoyer la demande
- Успех (показывать только после фактической отправки): Merci ! Votre demande est bien reçue. Je vous répondrai à l’adresse indiquée.
- Ошибка: La demande n’a pas pu être envoyée. Réessayez ou écrivez-moi directement.

**Блок: заметка (компонент `tilda/components/03-notice.html` или текстовый блок на лавандовом фоне)**
> La communauté n’est pas un service médical. Pour les questions urgentes, adressez-vous à un médecin ou aux services d’urgence.


---

## English (en)

### SEO

- Title (37): Mums & Kids community — AINA Évidence

- Description (104): A community for parents: questions on nutrition and child development. Launch and rules to be confirmed.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/en/community/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/community/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/community/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/community/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/community/">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Community
- H1: Mums & Kids
- Подзаголовок: A space for parents: questions on nutrition and development, support and useful resources.

**Блок: текст**
#### How it will work
The platform, format and community rules are still being defined. Leave your email and I will let you know when it launches.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
#### Tell me when it launches
- Поля: Name *, Email *, Phone or messenger (optional), What are you interested in? * (по умолчанию: community), A few words about your request (optional) (до 500 знаков)
- Подсказка к сообщению: Please do not include medical test results, diagnoses or detailed health information here. We will discuss them during a consultation.
- Обязательный чекбокс: I agree to the processing of the data above so that my request can be answered. Privacy policy: → Privacy policy
- Кнопка: Send request
- Успех (показывать только после фактической отправки): Thank you! Your request has been received. I will reply to the email address you gave.
- Ошибка: Your request could not be sent. Please try again or write to me directly.

**Блок: заметка (компонент `tilda/components/03-notice.html` или текстовый блок на лавандовом фоне)**
> The community is not a medical service. For urgent matters, contact a doctor or emergency services.
