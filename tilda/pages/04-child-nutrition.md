# 04. Детское питание

**Статус:** ЧЕРНОВИК: не публиковать, пока не подтверждено законное право оказывать эти услуги во Франции.

**Адреса:** RU `/ru/child-nutrition/` · FR `/fr/child-nutrition/` · EN `/en/child-nutrition/` (если Tilda не допускает «/» в адресе страницы, использовать `child-nutrition-<lang>` и так же исправить hreflang).


---

## Русский (ru)

### SEO

- Title (31): Детское питание — AINA Évidence

- Description (76): Консультации по детскому питанию, прикорм, режим и частые вопросы родителей.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/ru/child-nutrition/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/child-nutrition/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/child-nutrition/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/child-nutrition/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/child-nutrition/">
<meta name="robots" content="noindex, nofollow">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Детское питание
- H1: Питание ребёнка с заботой и опорой на данные
- Подзаголовок: Помогаю родителям разобраться в питании ребёнка по возрасту: прикорм, режим дня, привычки и вопросы, которые возникают на каждом этапе.

**Блок: карточки**
#### С чем обращаются родители
- **Прикорм** — Когда и как вводить первые блюда, консистенция, новые продукты.
- **Режим дня** — Ритм питания и сна, организация семейного стола.
- **Особенности** — Аллергии и непереносимость обсуждаем с врачом; я помогаю организовать питание.

**Блок: заметка (компонент `tilda/components/03-notice.html` или текстовый блок на лавандовом фоне)**
> Все рекомендации носят образовательный характер. При аллергии, болезнях и задержках развития обращайтесь к педиатру.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
#### Запрос по детскому питанию
- Поля: Имя *, Email *, Телефон или мессенджер (необязательно), Что вас интересует * (по умолчанию: consultation-child), Коротко о вашем запросе (необязательно) (до 500 знаков)
- Подсказка к сообщению: Не указывайте медицинские анализы, диагнозы и другие сведения о здоровье. Их обсудим на консультации.
- Обязательный чекбокс: Я согласен(на) на обработку указанных данных, чтобы ответить на мою заявку. Политика конфиденциальности: → Политика конфиденциальности
- Кнопка: Отправить заявку
- Успех (показывать только после фактической отправки): Спасибо! Заявка получена. Я отвечу вам по указанному email в ближайшее время.
- Ошибка: Не удалось отправить заявку. Попробуйте ещё раз или напишите мне напрямую.


---

## Français (fr)

### SEO

- Title (40): Alimentation de l’enfant — AINA Évidence

- Description (107): Consultations sur l’alimentation de l’enfant : diversification, rythme et questions fréquentes des parents.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/fr/child-nutrition/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/child-nutrition/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/child-nutrition/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/child-nutrition/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/child-nutrition/">
<meta name="robots" content="noindex, nofollow">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Alimentation de l’enfant
- H1: L’alimentation de votre enfant, avec des repères fiables
- Подзаголовок: J’aide les parents à s’y retrouver selon l’âge : diversification, rythme de la journée, habitudes et questions qui surviennent à chaque étape.

**Блок: карточки**
#### Les questions fréquentes
- **Diversification** — Quand et comment introduire les premiers aliments, les textures, les nouveaux produits.
- **Rythme de la journée** — Organisation des repas et du sommeil, repas en famille.
- **Situations particulières** — Allergies et intolérances se discutent aussi avec le pédiatre ; je vous aide à organiser l’alimentation.

**Блок: заметка (компонент `tilda/components/03-notice.html` или текстовый блок на лавандовом фоне)**
> Ces recommandations ont une vocation éducative. En cas d’allergie, de maladie ou de retard de développement, consultez un pédiatre.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
#### Demande pour l’alimentation de l’enfant
- Поля: Prénom et nom *, E-mail *, Téléphone ou messagerie (facultatif), Votre demande * (по умолчанию: consultation-child), Quelques mots sur votre demande (facultatif) (до 500 знаков)
- Подсказка к сообщению: Ne joignez pas d’analyses médicales, de diagnostics ni d’informations de santé détaillées. Nous en parlerons pendant la consultation.
- Обязательный чекбокс: J’accepte le traitement des données indiquées pour répondre à ma demande. Politique de confidentialité : → Politique de confidentialité
- Кнопка: Envoyer la demande
- Успех (показывать только после фактической отправки): Merci ! Votre demande est bien reçue. Je vous répondrai à l’adresse indiquée.
- Ошибка: La demande n’a pas pu être envoyée. Réessayez ou écrivez-moi directement.


---

## English (en)

### SEO

- Title (31): Child nutrition — AINA Évidence

- Description (100): Consultations on child nutrition: complementary feeding, routine and the questions parents ask most.

- OG title / description: как Title / Description. OG-изображение: фирменная обложка из библиотеки владельца (1200×630).

- HTML для «Настройки страницы → Дополнительно → HTML-код в head» (заменить `{DOMAIN}` на адрес сайта):

```html
<link rel="canonical" href="{DOMAIN}/en/child-nutrition/">
<link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/child-nutrition/">
<link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/child-nutrition/">
<link rel="alternate" hreflang="en" href="{DOMAIN}/en/child-nutrition/">
<link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/child-nutrition/">
<meta name="robots" content="noindex, nofollow">
```

### Тексты

**Блок: обложка (первый экран)**
- Надзаголовок: Child nutrition
- H1: Your child’s nutrition, with reliable guidance
- Подзаголовок: I help parents find their way by age: complementary feeding, daily routine, habits and the questions that come up at each stage.

**Блок: карточки**
#### Questions parents ask most
- **Complementary feeding** — When and how to introduce first foods, textures and new products.
- **Daily routine** — Organising meals and sleep, family meals.
- **Specific situations** — Allergies and intolerances are also discussed with your paediatrician; I help you organise the diet.

**Блок: заметка (компонент `tilda/components/03-notice.html` или текстовый блок на лавандовом фоне)**
> These recommendations are educational. For allergies, illness or developmental delay, please see a paediatrician.

**Блок: форма заявки** (нативная форма Tilda или `tilda/components/02-lead-form.html`)
#### Child nutrition request
- Поля: Name *, Email *, Phone or messenger (optional), What are you interested in? * (по умолчанию: consultation-child), A few words about your request (optional) (до 500 знаков)
- Подсказка к сообщению: Please do not include medical test results, diagnoses or detailed health information here. We will discuss them during a consultation.
- Обязательный чекбокс: I agree to the processing of the data above so that my request can be answered. Privacy policy: → Privacy policy
- Кнопка: Send request
- Успех (показывать только после фактической отправки): Thank you! Your request has been received. I will reply to the email address you gave.
- Ошибка: Your request could not be sent. Please try again or write to me directly.
