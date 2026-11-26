# Быстрый старт — AINA Évidence

## 1. Посмотреть сайт локально

```bash
npm run build
npm run serve
```

Откройте http://localhost:8080. Выберите язык в шапке (RU / FR / EN).

## 2. Проверить, что всё работает

```bash
npm test          # 46 тестов: сервер и сайт
npm run check     # ссылки, sitemap, секреты
```

Браузерная проверка (нужен Playwright и Chromium, по желанию):

```bash
SMOKE_URL=http://localhost:8080 npm run smoke
```

## 3. Что заполнить до публикации

Откройте `docs/ANKETA.md` и ответьте на вопросы. Затем внесите данные в `src/config/business.mjs`. В документах недостающее подсвечено жёлтым: `[À COMPLÉTER: …]`.

Проверить, что всё заполнено: `npm run build:prod`. Пока есть пропуски, сборка не пройдёт и покажет список.

## 4. Цифровые гайды

- Положите PDF в `private/products/<sku>.pdf` (папка не в git).
- Внесите цену и подтвердите содержание в `src/config/catalog.mjs`.
- Поставьте `published: true` и `contentConfirmed: true` только после решения владельца.

## 5. Платежи

Выключены. См. `docs/PAYMENTS.md` (раздел 5), чеклист запуска.

## Контакты

globalainanutrition@gmail.com
