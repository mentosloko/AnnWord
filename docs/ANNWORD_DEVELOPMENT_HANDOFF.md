# AnnWord — development handoff

Дата фиксации: после реализации первого UX/gamification MVP-куска и перед продолжением, когда восстановится Vercel deploy limit.

Репозиторий:

```text
mentosloko/AnnWord
```

## 1. Текущий статус на конец сессии

### Main branch

Работа велась прямо в `main`.

Последний зафиксированный коммит с правкой тестов под новую геймификацию:

```text
dd597dac3b1544e9353f8864abc407baed737458
Update economy tests for mood score model
```

Перед ним были важные коммиты UX/gamification MVP:

```text
2ce08f1baf730cf8f99623929fc20bb9b8893300
Document character onboarding flow

704dddc1d9568b8c0e7cab4cb9d36562289e8a21
Update component tests for character wording

a960fd2b1e07b9ddf1aa51e1564eae57065e0873
Update game mode tests for reward callback contract
```

### Production / Vercel

Последний доступный зелёный production deployment до серии gamification-коммитов:

```text
production deployment: dpl_H93bHMYCgKGJevFpzxRpbrUoexhE
commit: 5a22bed7a633eb4fac8eed64ce4cec4cb8173151
message: Add character gamification reward rules
state: READY
```

После этого Vercel deployments начали падать на тестах старого контракта. Эти тесты были обновлены в последних коммитах, но новый полноценный Vercel build не стартовал из-за лимита:

```text
Vercel status URL: https://vercel.com/mentosloko-1417s-projects?upgradeToPro=build-rate-limit
GitHub status: failure, причина — build-rate-limit
```

Важно: последний видимый Vercel failure до фикса тестов был не инфраструктурным — падали тесты, которые всё ещё ожидали старую модель `onWinCoins/onAddXP/hunger/energy`. После этого тесты были переписаны на новую модель `onGameReward/moodScore/character`.

## 2. Что реализовано в gamification MVP

### 2.1. Терминология и модель

Продуктово переходим от узкого понятия `pet` к широкой модели `character`.

В коде тип всё ещё называется `PetState` для обратной совместимости, но внутри он теперь хранит character-состояние:

```text
type
name
xp
level
stage
moodScore
mood
characterOnboarded
equippedAccessories
activeHomeItemId
```

Legacy-поля `hunger` и `energy` оставлены только для совместимости и не должны использоваться в новой логике.

### 2.2. Mood scale

Одна шкала состояния:

```text
moodScore: 0–100
```

Маппинг:

```text
0–20   sad
21–45  calm
46–70  happy
71–90  joyful
91–100 super_happy
```

Игры поднимают mood максимум до 70. Treats из магазина могут поднимать mood выше 70.

### 2.3. Character growth / levels

Рост персонажа отделён от mood.

XP не уменьшается. Уровень и стадия — долгосрочный прогресс.

Текущая таблица уровней:

```text
level 1  total XP 0    stage_1
level 2  total XP 10   stage_1
level 3  total XP 25   stage_2
level 4  total XP 45   stage_2
level 5  total XP 70   stage_2
level 6  total XP 100  stage_3
level 7  total XP 135  stage_3
level 8  total XP 175  stage_3
level 9  total XP 220  stage_4
level 10 total XP 270  stage_4
```

### 2.4. XP rules по играм

XP — маленькими числами, удобными для детского счёта.

```text
Wordle: +5 XP только если слово угадано
Sprint: +1 XP за каждое отгаданное слово, cap +4
Anagram: +1 XP за каждое отгаданное слово
Memo: XP зависит от кликов
Hangman: +4 XP только если слово угадано
```

Memo:

```text
<= 8 кликов: +4 XP
9–10 кликов: +3 XP
11–12 кликов: +2 XP
13–14 кликов: +1 XP
15+ кликов: 0 XP
```

Ошибки не уменьшают XP/монеты/mood. Ошибки можно использовать только для образовательной логики повторения.

### 2.5. Coins

Монеты — маленькими числами, нужны для магазина.

Текущая логика:

```text
Wordle guessed: +3 coins
Wordle completed but not guessed: +1 coin
Sprint 1–2 guessed words: +1 coin
Sprint 3+ guessed words: +2 coins
Anagram 1–2 guessed words: +1 coin
Anagram 3+ guessed words: +2 coins
Memo 8–12 clicks: +2 coins
Memo 13–14 clicks: +1 coin
Hangman guessed: +2 coins
Hangman completed but not guessed: +1 coin
```

Streak achievements ещё не реализованы. Когда делать — только coins, без XP.

### 2.6. Starter character onboarding

Добавлен onboarding выбора персонажа для авторизованных пользователей.

Файлы:

```text
services/characterCatalog.ts
components/screens/CharacterOnboardingScreen.tsx
```

Стартовые персонажи:

```text
Puppy   / Щенок      / default name: Бадди
Dragon  / Дракончик  / default name: Искорка
RoboCat / Робокот    / default name: Байт
```

Флаг:

```text
pet.characterOnboarded: boolean
```

Поведение:

```text
new authenticated user + characterOnboarded=false → route=character_onboarding
guest profile → characterOnboarded=true, onboarding не блокирует гостя
после выбора персонажа → updateUserPet → route=landing
```

### 2.7. Shop MVP

Магазин переработан на категории:

```text
Лакомства
Аксессуары
Домик
```

Файлы:

```text
services/shopCatalog.ts
services/economyEngine.ts
components/Shop.tsx
```

Treats:

```text
apple       price 2   mood +8  cap 80
cookie      price 3   mood +10 cap 85
berry       price 5   mood +15 cap 90
icecream    price 7   mood +20 cap 95
star_treat  price 10  mood +25 cap 100
```

Accessories:

```text
bow          5
glasses      6
hat          7
hero_cape    10
star_collar  12
crown        15
```

Home items:

```text
dog_house         Puppy only   20
dragon_nest       Dragon only  20
charging_station  RoboCat only 20
```

### 2.8. Character room

`components/PetRoom.tsx` обновлён под character/mood-модель.

Теперь показывает:

```text
одну шкалу Настроение
уровень
stage
XP до следующего уровня
активный home item
аксессуары
инвентарь treats/accessories/home
```

Убраны UI-шкалы голода/энергии.

### 2.9. Floating widget

`components/PetWidget.tsx` обновлён:

```text
aria-label: Открыть комнату персонажа
тексты: Я скучал / Готов к игре / Рад учиться / Супернастроение
moodScore vertical bar
```

Виджет скрыт на routes:

```text
pet_room
shop
character_onboarding
```

### 2.10. Post-game character progress

Добавлен общий компонент:

```text
components/CharacterProgressCard.tsx
```

Показывает:

```text
XP gained
coins gained
character emoji/name
level
XP progress bar
stage
```

Подключён к:

```text
Wordle / ClassicGameScreen
Sprint
Memo
Hangman
```

Anagram пока continuous-mode: даёт награду за каждое отгаданное слово и показывает immediate feedback, без отдельного финального post-game экрана.

## 3. Основные файлы, которые изменились

```text
types.ts
AppV2.tsx
components/AppShell.tsx
components/AppScreens.tsx
components/screens/LandingScreen.tsx
components/screens/ClassicGameScreen.tsx
components/screens/ModeScreens.tsx
components/screens/CharacterOnboardingScreen.tsx
components/CharacterProgressCard.tsx
components/PetWidget.tsx
components/PetRoom.tsx
components/Shop.tsx
components/SprintGame.tsx
components/AnagramGame.tsx
components/MemoryGame.tsx
components/HangmanGame.tsx
constants/profileDefaults.ts
services/gamificationRules.ts
services/characterCatalog.ts
services/shopCatalog.ts
services/profileMapper.ts
services/petEngine.ts
services/economyEngine.ts
services/userService.ts
docs/GAMIFICATION_SPEC.md
```

Тесты обновлены:

```text
tests/components.contracts.test.tsx
tests/gameModeScenario.test.tsx
tests/economyEngine.test.ts
scripts/pet-engine-smoke.ts
scripts/economy-smoke.ts
```

## 4. Что важно проверить завтра после восстановления Vercel лимита

### 4.1. Сначала не продолжать фичи, а проверить билд

Сделать новый маленький trigger commit или rerun deployment после сброса лимита.

Проверить:

```text
Vercel deployment state
GitHub commit status
Vercel build logs
```

Если снова ошибка — первым делом смотреть тесты и TypeScript/lint.

### 4.2. Локально / в CI

Нужно прогнать:

```bash
npm install
npm run check
npm run build
```

Важно: корректный `package-lock.json` всё ещё нужно сгенерировать через реальный `npm install` и закоммитить.

### 4.3. Supabase

Schema/migrations не менялись.

Всё новое хранится в существующих JSON-полях:

```text
profiles.pet
profiles.inventory
profiles.coins
```

Проверить руками:

```text
регистрация нового пользователя
создание profiles row
pet.characterOnboarded=false для нового auth user
redirect на character_onboarding
выбор Puppy/Dragon/RoboCat
сохранение pet.characterOnboarded=true
сохранение name/type
начисление XP/coins после игр
покупка treat
использование treat → moodScore растёт
покупка accessory/home item
применение accessory/home item
```

## 5. UX MVP checklist перед тестированием

Минимальные сценарии для ручного UX smoke:

```text
1. Новый пользователь регистрируется и попадает на выбор персонажа.
2. Выбирает Щенка/Дракончика/Робокота и задаёт имя.
3. Попадает на главный экран.
4. Играет Wordle: победа и поражение.
5. Видит CharacterProgressCard после Wordle.
6. Играет Sprint и видит XP/coins после окончания таймера.
7. Играет Memo и проверяет reward по количеству кликов.
8. Играет Hangman: победа и поражение.
9. Покупает treat в магазине.
10. Использует treat в комнате персонажа, moodScore растёт.
11. Покупает accessory, надевает/снимает.
12. Покупает home item для текущего character type.
13. Проверяет, что home item другого персонажа недоступен/не показывается.
```

Особо проверить mobile widths:

```text
iPhone-like narrow width
Android-like narrow width
tablet width
```

## 6. Известные ограничения текущего MVP

```text
Нет streak achievements.
Нет отдельной таблицы gamification_events.
Нет серверного reward transaction layer — награды синкаются через updateCoins/updateUserPet.
Нет отдельной миграции под character; всё в JSON.
Нет визуальных stage-assets; stage пока текст/логика.
Anagram continuous-mode без общего финального progress card.
Level-up/stage-up пока показываются как progress state, без отдельной celebration animation.
```

## 7. Что делать следующим крупным куском

Рекомендуемый следующий branch после восстановления Vercel лимита:

```text
ux-gamification-mvp-polish
```

Не начинать с новых механик. Сначала довести текущий MVP до UX-тестируемого состояния:

```text
1. Добиться зелёного Vercel build.
2. Сгенерировать package-lock.json.
3. Пройти ручной Supabase/auth smoke.
4. Улучшить CharacterProgressCard: level-up/stage-up celebration.
5. Скрыть техническое stage_1/stage_2 из UI или заменить на детские названия.
6. Добавить UX-copy в rules modal: как персонаж получает XP.
7. Подготовить тестовые аккаунты и короткий friendly dictionary.
8. Провести UX MVP testing.
```

Только после этого добавлять:

```text
streak achievements
server-side event log
gamification_events
seasonal/items expansion
реальные character/stage assets
```

## 8. Старый pre-UX handoff context

До gamification MVP проект был подготовлен архитектурно:

```text
AppV2 orchestration root
AppShell / AppScreens split
domain services
unit tests
component contract tests
scenario tests
smoke gates
CI
world-domain foundation
```

Старый world-domain foundation (`worldTypes`, `worldCatalog`, `petProgressionEngine`, `islandProgressEngine`, `petReactionEngine`, `rewardEngine`) пока не является runtime-источником новой MVP-геймификации. Текущая runtime-модель идёт через:

```text
gamificationRules
characterCatalog
shopCatalog
economyEngine
petEngine
profileMapper
useProfileEconomy
```

Не смешивать эти два слоя без отдельного рефакторинга.

## 9. Короткий handoff для следующей сессии

```text
Работали на main.
Последний важный commit: dd597dac3b1544e9353f8864abc407baed737458.
Vercel сейчас failure из-за build-rate-limit на последнем коммите, а не из-за нового build log.
Предыдущие Vercel ERROR были из-за старых тестов; тесты обновлены.
Нужно дождаться восстановления deploy limit и получить свежий build.
Schema Supabase не менялась.
Новый auth user должен попасть на character onboarding.
Гости onboarding не блокирует.
MVP loop: games → XP/coins → character level/stage/mood → shop → treats/accessories/home.
Следующий приоритет: green build + package-lock + ручной UX smoke, не новые фичи.
```
