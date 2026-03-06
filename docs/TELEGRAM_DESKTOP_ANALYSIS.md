# Анализ проблем Telegram Desktop (ПК) — удаление сообщений и создание чата

## Контекст

Проблемы проявляются **только** в Telegram-приложении на ПК (tdesktop / macos). На мобильных и в браузере всё работает.

---

## 1. Архитектура Telegram Mini Apps на десктопе

### WebView

- **Telegram Desktop** (Windows/macOS/Linux) использует **Qt WebEngine** (Chromium).
- События обрабатываются иначе, чем в мобильных клиентах:
  - Web: `window.postMessage`
  - Desktop: `window.TelegramGameProxy.receiveEvent`
  - iOS/Android: `window.Telegram.WebView.receiveEvent`

### Контекстное меню (критично)

В Qt WebEngine при правом клике:

1. Платформа может показать **нативное** контекстное меню (Copy, Paste, Inspect и т.д.).
2. Событие `contextmenu` может прийти в JS **после** или **параллельно** с показом нативного меню.
3. Нативное меню часто перехватывает следующий клик для своего закрытия.

**Следствие:** наш кастомный портал с меню может оказаться под нативным меню. Клик по «Удалить» тогда уходит в нативное меню, а не в наш обработчик.

---

## 2. Сценарий «Удаление сообщения»

### Текущий поток

1. Правый клик по сообщению → `contextmenu`
2. `openMenuAtEvent` → меню рендерится через `createPortal` в `document.body`
3. Левый клик по «Delete» → `onMouseDown` (в tg-desktop) → `handleAction` → `closeMenu()` + `setTimeout(cb)`

### Возможные причины поломки в tg-desktop

| # | Гипотеза | Обоснование |
|---|----------|-------------|
| 1 | **Нативное контекстное меню перехватывает клики** | Qt WebEngine может показывать своё меню поверх нашего. Следующий клик закрывает его, а не попадает в наше. |
| 2 | **`platform` искажён или другой** | `isTelegramDesktop()` проверяет `tdesktop` и `macos`. На Windows может быть `win`, в веб-версии — `weba` / `webk`. Тогда наши tg-desktop–патчи не применяются. |
| 3 | **Порядок событий** | На десктопе возможно другое поведение `mousedown` / `mouseup` / `click`, из‑за чего наш обработчик не вызывается или вызывается в некорректном состоянии. |
| 4 | **Stale closure в `handleDelete`** | При вызове через `setTimeout` `handleDelete` может использовать устаревший `activeConversation`, если до этого был ререндер. |
| 5 | **Удаление меню до срабатывания callback** | `closeMenu()` сразу unmount-ит меню. В Qt WebEngine это может повлиять на обработку оставшихся событий. |

---

## 3. Сценарий «Создание чата»

### Текущий поток

1. `createChat(agentId)` → API → `setConversations` + `setActiveConversation`
2. Задержка 120 мс для tg-desktop
3. `return` → вызывающий код делает `selectConversation` и `onChatSelect`

### Возможные причины поломки

| # | Гипотеза | Обоснование |
|---|----------|-------------|
| 1 | **Разный event loop** | В Qt WebEngine `setTimeout` / микротаски могут обрабатываться иначе. 120 мс может быть недостаточно для завершения React batch. |
| 2 | **initData / cookies** | В [issue #28303](https://github.com/telegramdesktop/tdesktop/issues/28303) описано кеширование initData. Проблемы с cookies в WebView могут ломать API-запросы. |
| 3 | **Таймаут / порядок ответов** | Запрос `createChat` или `selectConversation` может завершаться с ошибкой или позже, чем ожидается. |
| 4 | **`platform` и срабатывание задержки** | Если `tg-desktop` определяется неверно, задержка не включается, и поведение остаётся «как на других платформах». |

---

## 4. Что проверить в первую очередь

### A. Логирование на устройстве пользователя

Добавить временный код для диагностики:

```javascript
// В Actions.jsx handleAction
console.log('[TG-DEBUG]', {
  platform: window.Telegram?.WebApp?.platform,
  isTgDesktop: isTelegramDesktop(),
  eventType: event.type,
  messageId,
  timestamp: Date.now()
});
```

```javascript
// В ChatsContext deleteMessage
console.log('[TG-DEBUG deleteMessage]', {
  platform: document.documentElement?.classList?.contains('tg-desktop'),
  messageId,
  conversationId,
  hasActiveConv: !!activeConversation
});
```

Нужно зафиксировать:

- доходит ли `handleAction` вообще;
- какой `platform`;
- есть ли `conversationId` в момент удаления.

### B. Проверка нативного контекстного меню

- В tdesktop при правом клике внутри Mini App: показывается ли **ещё** нативное системное меню?
- Если да — оно может перекрывать наше и забирать клики.

### C. Альтернативный способ удаления

- Добавить «Удалить» в хедер чата или отдельную кнопку, чтобы не зависеть от контекстного меню.
- Если это работает, а контекстное меню — нет, вероятно, проблема в обработке правого клика / нативном меню.

---

## 5. Рекомендуемые шаги

### Краткосрочно (диагностика)

1. Расширить логирование, как в п. 4A.
2. Расширить определение «desktop»:
   ```javascript
   const platform = window.Telegram?.WebApp?.platform || "";
   return /^(tdesktop|macos|win|weba|webk)$/i.test(platform) 
     || (platform && window.innerWidth >= 768);
   ```
3. Пользователю проверить в консоли (DevTools в tdesktop, если доступны) или через `console.log` в продакшене: приходит ли `handleAction`, какой `platform`.

### Среднесрочно (исправления)

1. **Блокировка нативного контекстного меню** в WebView — через Telegram Web App API, если есть соответствующий метод (в документации может не быть; стоит поискать).
2. **Дополнительная точка удаления** — пункт «Удалить» в хедере чата / в меню сообщения, не привязанный к правому клику.
3. **Более надёжная фиксация `conversationId`** — сохранять `conversationId` и `messageId` в ref при открытии меню и передавать их явно в `deleteMessage`, чтобы не зависеть от `activeConversation` в closure.
4. **Увеличение задержки для createChat** — попробовать 200–300 мс вместо 120 мс и смотреть на стабильность.

### Долгосрочно

1. Изучить [@tma.js/sdk](https://github.com/Telegram-Mini-Apps/tma.js) — как там обрабатываются платформенные различия.
2. Следить за issues в [telegramdesktop/tdesktop](https://github.com/telegramdesktop/tdesktop) по WebView и Mini Apps.
3. При необходимости — использовать другой UI для критичных действий (например, swipe-to-delete или отдельная кнопка) вместо контекстного меню на десктопе.

---

## 6. Итог

С высокой вероятностью причина в **взаимодействии кастомного контекстного меню с нативным Qt-меню** и/или в **неполной поддержке нашего сценария в WebView Telegram Desktop**.

Для подтверждения нужны логи и проверка поведения нативного меню и альтернативного UI удаления.
