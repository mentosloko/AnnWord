# AnnWord — development handoff

Дата фиксации: после pre-UX architecture/testing работ и перед переходом к UX/gamification ветке.

Репозиторий:

```text
mentosloko/AnnWord
```

## 1. Текущий статус

### Production

Production Vercel был зелёным после PR #12:

```text
production commit: 2f04bfd9fa00dd266189b07ec14335d31a8dab8b
production deployment: dpl_Ce7SDgBWZiPtguW9NX134Ns3mV3L
production url: https://ann-word.vercel.app
```

### Открытый PR перед UX

Открыт PR #13:

```text
PR #13: Add pre-UX game scenario test suite
branch: game-scenario-tests
```

В PR #13 уже был успешный Vercel preview на коммите:

```text
384ce10028d101ca95d326e4999c3adb4a7bc509
Fix Vitest hoisted mode game mocks

deployment: dpl_437tu8YQ4TcUDgqgDRDeAnXQJ5gL
state: READY
```

После этого был добавлен технический trigger-коммит для нового preview:

```text
2fc56085da26ed580268e752185fba84ac6e6bc5
Trigger Vercel preview after scenario test fix
```

Затем была исправлена mock-hoisting ошибка в `gameModeScenario.test.tsx`:

```text
384ce10028d101ca95d326e4999c3adb4a7bc509
Fix Vitest hoisted mode game mocks
```

Если текущая ветка содержит более свежие trigger-коммиты, их нужно проверять по PR #13 и Vercel previews.

## 2. Главная архитектурная цель завершённого этапа

Цель этапа была подготовить проект к UX/gamification-работам без риска снова получить неуправляемый монолит.

В результате проект переведён из состояния:

```text
монолитный App / legacy bridge / слабые тесты
```

в состояние:

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

## 3. Что сделано по архитектуре

### 3.1. Удалён legacy слой

Удалены старые архитектурные элементы:

```text
App.tsx
components/AppProviders.tsx
components/LegacyAppBridge.tsx
providers/AuthProvider.tsx
providers/ProfileProvider.tsx
providers/NavigationProvider.tsx
utils/navigationBridge.ts
components/ScreenFallbackHomeButton.tsx
```

Ключевой принцип новой архитектуры:

```text
AppV2 держит route state.
Дочерние компоненты получают callbacks сверху.
Глобальный navigationBridge больше не используется.
```

### 3.2. AppV2 split

`AppV2` разбит на:

```text
AppV2
  ├── AppShell
  └── AppScreens
```

Файлы:

```text
components/AppShell.tsx
components/AppScreens.tsx
```

`AppShell` отвечает за:

```text
AppHeader
AppModals
PetWidget
общий layout
```

`AppScreens` отвечает за:

```text
route → screen mapping
LandingScreen
SetupScreen
ClassicGameScreen
ProfileScreen
AnagramsScreen
SprintScreen
MemoryScreen
HangmanScreen
Shop
PetRoom
```

`AppV2` теперь является orchestration root: хуки, bootstrap, route state, composition.

### 3.3. Вынесенные хуки и сервисы

Основные хуки:

```text
hooks/useAuthProfile.ts
hooks/useClassicGameController.ts
hooks/useDictionaryPools.ts
hooks/useDictionaryUpload.ts
hooks/useProfileEconomy.ts
```

Основные сервисы:

```text
services/dictionaryEngine.ts
services/gameDictionaryAdapter.ts
services/dictionaryUpload.ts
services/economyEngine.ts
services/petEngine.ts
services/profileMapper.ts
```

Импорт пользовательского словаря вынесен из `AppV2`:

```text
services/dictionaryUpload.ts
hooks/useDictionaryUpload.ts
```

Там реализованы:

```text
normalization
deduplication
diagnostics
warnings
no silent truncation на больших словарях
```

## 4. Что сделано по тестированию

### 4.1. Vitest + React Testing Library

Добавлены:

```text
vitest.config.ts
tests/setupTests.ts
@testing-library/react
@testing-library/jest-dom
jsdom
```

Команды:

```text
npm run test
npm run test:run
npm run test:coverage
```

### 4.2. Scripts structure

`package.json` приведён к структуре:

```text
check:unit
check:smoke
check
build
```

Логика:

```text
check = lint + unit tests + smoke
build = check + vite build
```

### 4.3. GitHub Actions CI

Добавлен workflow:

```text
.github/workflows/ci.yml
```

CI делает:

```text
install dependencies
npm run lint
npm run check:unit
npm run check:smoke
vite build
```

Добавлены защита от зависших прогонов:

```yaml
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

timeout-minutes: 10
```

CI сейчас использует:

```text
npm ci если есть package-lock.json
npm install если package-lock.json нет
```

Важно: старый `package-lock.json` был устаревшим и ломал `npm ci`, поэтому был удалён в PR #13. Корректный lockfile нужно сгенерировать отдельно через реальный `npm install`.

## 5. Тестовое покрытие

### 5.1. Unit tests

Есть тесты:

```text
tests/dictionaryUpload.test.ts
tests/dictionaryEngine.test.ts
tests/economyEngine.test.ts
tests/petEngine.test.ts
tests/profileMapper.test.ts
tests/routeContract.test.ts
tests/petProgressionEngine.test.ts
tests/islandProgressEngine.test.ts
tests/petReactionEngine.test.ts
tests/rewardEngine.test.ts
```

Покрыто:

```text
dictionary normalization
custom dictionary parsing
large dictionary without silent truncation
dictionary pools
game dictionary adapter
economy purchases
item use
pet mood / decay / inventory
profile DB normalization
route contracts
world-domain foundation
egg progression
island sticker progress
pet reactions
reward outcomes
```

### 5.2. Component contract tests

Файл:

```text
tests/components.contracts.test.tsx
```

Покрыты:

```text
LandingScreen
SetupScreen
Shop
PetRoom
PetWidget
```

Проверяются callback contracts:

```text
onStartClassic
onOpenShop
onOpenProfile
onFileUpload
onStartGame
onClose
onNavigateToPetRoom
```

### 5.3. Pre-UX game scenario tests

PR #13 добавляет:

```text
tests/classicGameScenario.test.tsx
tests/gameModeScenario.test.tsx
```

#### Classic game scenarios

Покрыто:

```text
safe initial game state
duplicate-letter scoring
keyboard status precedence
start classic game from setup
block start when selected dictionary has no words of selected length
short guess validation without consuming attempt
unknown word validation without consuming attempt
win scenario
loss after MAX_GUESSES
keyboard input only inside route=game
```

#### Mini-game route/contracts

Покрыто:

```text
AnagramsScreen
SprintScreen
MemoryScreen
HangmanScreen
```

Важно: `gameModeScenario.test.tsx` не рендерит реальные mini-game компоненты, потому что у них есть таймеры/интервалы/анимации. Вместо этого mini-games замоканы, а тест проверяет контракт обвязки:

```text
ModeScreens → mini-game gets userProfile
ModeScreens → mini-game gets customDictionaryEn = words
ModeScreens → mini-game gets onWinCoins
ModeScreens → mini-game gets onAddXP
ModeScreens → mini-game gets onBack
```

## 6. Важные найденные и исправленные баги

### 6.1. Runtime-риск в ModeScreens

Был найден реальный риск: `ModeScreens` передавал mini-game компонентам неправильный prop-contract.

Раньше wrappers по смыслу давали:

```text
words
onWin
onBack
```

А реальные компоненты ожидали:

```text
userProfile
onWinCoins
onAddXP
onBack
```

Исправлено:

```text
ModeScreens теперь принимает userProfile.
AppScreens передаёт userProfile в Anagrams/Sprint/Memory/Hangman.
ModeScreens строит profile с customDictionaryEn = words.
Mini-games получают userProfile, onWinCoins, onAddXP, onBack.
```

Файлы:

```text
components/screens/ModeScreens.tsx
components/AppScreens.tsx
```

### 6.2. Duplicate-letter test expectation

Была ошибка теста:

```text
PAPER vs APPLE
```

Тест ожидал:

```text
P = present
```

Но правильно:

```text
P = correct
```

Потому что `P` на позиции 3 совпадает с `APPLE`.

Исправлено в коммите:

```text
c8875bb4aa25a955f654ba63b4921e214429eac1
Fix keyboard status expectation for duplicate letters
```

### 6.3. Vitest hoisting mocks

Была ошибка:

```text
ReferenceError: Cannot access 'makeModeGameMock' before initialization
```

Причина: `vi.mock` hoisted, а helper был top-level.

Исправлено через:

```ts
const { createModeGameMock } = vi.hoisted(() => ({ ... }))
```

Коммит:

```text
384ce10028d101ca95d326e4999c3adb4a7bc509
Fix Vitest hoisted mode game mocks
```

## 7. World-domain foundation для будущей геймификации

На основе концепции «Мир ANNWORD» добавлен чистый доменный каркас без UI.

Файлы:

```text
services/worldTypes.ts
services/worldCatalog.ts
services/petProgressionEngine.ts
services/petReactionEngine.ts
services/islandProgressEngine.ts
services/rewardEngine.ts
```

Заложены сущности:

```text
egg
owl
fox
dino
baby
teen
master
island
sticker
game event
reward outcome
pet reaction
```

### 7.1. Pet progression

```text
egg → starter pet после N guessed words
starter pets: owl / fox / dino
level 1–5 → baby
level 6–12 → teen
level 13+ → master
```

### 7.2. Islands

```text
forest_a1 → Лес A1
jungle_a2 → Джунгли A2
mountain_b1 → Горный пик B1
10 guessed words → sticker unlock
```

### 7.3. Pet reactions

```text
heart
phrase
sound
```

Фразы:

```text
I love learning!
You are a star!
Give me more words!
Great job!
More words, please!
```

### 7.4. Rewards

События:

```text
WORD_GUESSED
GAME_WON
GAME_LOST
PET_TAPPED
ITEM_PURCHASED
ITEM_USED
```

Reward outcome:

```text
coinsDelta
xpDelta
petReaction
progressionEvent
```

Важно: world-domain слой пока не подключен к runtime UI/игре. Это foundation для будущей UX/gamification фазы.

## 8. Что осталось сделать перед переходом в UX branch

### 8.1. Проверить финальный статус PR #13

Нужно проверить последний Vercel preview и GitHub Actions по PR #13.

Уже точно был зелёный preview на:

```text
384ce10028d101ca95d326e4999c3adb4a7bc509
state: READY
```

Если последний head PR #13 тоже зелёный, PR можно мержить.

### 8.2. Смержить PR #13

После merge PR #13 дождаться production deployment на `main`.

### 8.3. Сгенерировать корректный package-lock.json

Сейчас корректного lockfile нет.

Нужно отдельно сделать:

```bash
npm install
git add package-lock.json
```

После этого CI автоматически будет использовать:

```bash
npm ci
```

## 9. Supabase notes

В текущем цикле Supabase schema не менялась:

```text
нет migrations
нет edge functions
нет schema changes
```

`server.ts` был ранее поправлен только типизационно для Yandex/Supabase user lookup.

## 10. Vercel notes

Доступный Vercel MCP tool `deploy_to_vercel` не запускает реальный API-deploy. Он возвращает инструкцию `vercel deploy`.

Рабочий способ триггерить Vercel в этой среде:

```text
push/commit в GitHub branch → Vercel Git integration запускает preview/production
```

## 11. Рекомендуемый следующий UX этап

После merge PR #13 создать новую ветку, например:

```text
ux-world-annword-home
```

И начинать UX с концепции:

```text
home как Мир ANNWORD
egg onboarding
pet room v2
island map
sticker collection
reward feedback
pet reactions
```

Использовать уже созданный foundation:

```text
worldTypes
worldCatalog
petProgressionEngine
islandProgressEngine
petReactionEngine
rewardEngine
```

Не внедрять всё сразу. Лучше идти итерациями:

```text
1. Новый home / landing structure
2. Pet widget / pet room visual state
3. Egg onboarding UI
4. Reward feedback UI
5. Island map UI
6. Sticker collection UI
```

## 12. Короткий handoff

```text
main production green на PR #12
PR #13 открыт и содержит pre-UX game scenario tests
ключевой зелёный preview PR #13: 384ce100 READY
ModeScreens contract bug исправлен
classic game scenarios добавлены
game mode wrappers проверяются через mocked contract tests
world-domain foundation готов
architecture готова к UX
package-lock требует корректной регенерации
```
