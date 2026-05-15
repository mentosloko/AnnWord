# AnnWord Gamification Spec

## Core principle

AnnWord gamification is based on characters, not only pets. A character can be an animal, robot, car, or any future companion. The user learns through games, earns small-count rewards, and sees the character grow or upgrade.

## Current MVP mechanics

- No energy.
- No hunger.
- No cleanliness.
- No daily goals.
- No sticker rewards.
- No XP penalties from mistakes.
- No achievements based on total learned words.
- Character mood and character growth are separate systems.

## Starter character onboarding

New authenticated users must choose and name a starter character before entering the main app flow. Guests use the default character and are not blocked by onboarding.

Starter characters:

| Type | UI name | Default name | Role |
|---|---|---|---|
| `Puppy` | Щенок | Бадди | Friendly classic companion |
| `Dragon` | Дракончик | Искорка | Adventure/magic character |
| `RoboCat` | Робокот | Байт | Tech-style character |

The onboarding result is stored in the existing `pet` JSON object with `characterOnboarded: true`, so no database migration is required for this step.

## Character state

Each user has one active character.

Character fields:

- `type`: e.g. `Puppy`, `Dragon`, `RoboCat`.
- `name`: user-defined character name.
- `xp`: total accumulated character XP.
- `level`: derived from total XP.
- `stage`: derived from level.
- `moodScore`: 0-100.
- `mood`: derived from moodScore.
- `characterOnboarded`: whether the user has selected and named the character.
- `equippedAccessories`: cosmetic item ids.
- `activeHomeItemId`: selected home/room item.

## Mood scale

Mood is a short-term state.

| Mood score | Mood |
|---:|---|
| 0-20 | sad |
| 21-45 | calm |
| 46-70 | happy |
| 71-90 | joyful |
| 91-100 | super_happy |

Game rewards can raise mood only up to 70. Treats can raise mood above 70.

## Character growth

Growth is long-term and never decays.

| Level | Total XP | Stage |
|---:|---:|---|
| 1 | 0 | stage_1 |
| 2 | 10 | stage_1 |
| 3 | 25 | stage_2 |
| 4 | 45 | stage_2 |
| 5 | 70 | stage_2 |
| 6 | 100 | stage_3 |
| 7 | 135 | stage_3 |
| 8 | 175 | stage_3 |
| 9 | 220 | stage_4 |
| 10 | 270 | stage_4 |

Character examples:

- Puppy: puppy -> bigger puppy -> adult dog -> hero dog.
- Dragon: baby dragon -> bigger wings -> flying dragon -> glowing dragon.
- RoboCat: basic body -> upgraded body -> neon details -> super RoboCat.
- Future car: small car -> new wheels -> sports version -> supercar.

## Game XP rules

XP uses small numbers so children can count rewards easily.

| Game | XP rule |
|---|---|
| Wordle | +5 XP only if the word is guessed |
| Sprint | +1 XP per guessed word, max +4 |
| Anagram | +1 XP per guessed word, max +4 per batch/rule calculation |
| Memo | XP depends on click count |
| Hangman | +4 XP only if the word is guessed |

Memo XP:

| Clicks | XP |
|---:|---:|
| 8 or fewer | 4 |
| 9-10 | 3 |
| 11-12 | 2 |
| 13-14 | 1 |
| 15+ | 0 |

Mistakes do not reduce XP. They can be used only for educational repetition logic.

## Coins

Coins are small-count currency for the shop.

Current rules:

| Game/event | Coins |
|---|---:|
| Wordle guessed | +3 |
| Wordle completed but not guessed | +1 |
| Sprint 1-2 guessed words | +1 |
| Sprint 3+ guessed words | +2 |
| Anagram 1-2 guessed words | +1 |
| Anagram 3+ guessed words | +2 |
| Memo 8-12 clicks | +2 |
| Memo 13-14 clicks | +1 |
| Hangman guessed | +2 |
| Hangman completed but not guessed | +1 |

Streak achievements should later give bonus coins only. They should not grant XP.

## Shop

Shop categories:

- Treats (`food` in current backward-compatible types).
- Accessories.
- Home items.

Treats:

| Item | Price | Effect |
|---|---:|---|
| Apple | 2 | +8 mood, cap 80 |
| Cookie | 3 | +10 mood, cap 85 |
| Berry | 5 | +15 mood, cap 90 |
| Ice cream | 7 | +20 mood, cap 95 |
| Star treat | 10 | +25 mood, cap 100 |

Accessories:

| Item | Price |
|---|---:|
| Bow | 5 |
| Glasses | 6 |
| Hat | 7 |
| Hero cape | 10 |
| Star collar | 12 |
| Crown | 15 |

Home items:

| Character | Item | Price |
|---|---|---:|
| Puppy | Dog house | 20 |
| Dragon | Dragon nest | 20 |
| RoboCat | Charging station | 20 |

## Post-game feedback

After each game the UI should show:

- XP gained.
- Coins gained.
- Character level/progress.
- Level-up if a new level is reached.
- Stage-up if the character grows/upgrades.

The current implementation uses a shared `CharacterProgressCard` in Wordle, Sprint, Memo, and Hangman result states. Anagram gives immediate per-word feedback because it is continuous rather than a finite round.

## Language guidelines

Use encouraging copy.

Good:

- “Почти получилось! Попробуй ещё раз — и персонаж получит XP.”
- “Персонаж получил опыт.”
- “Дракончик вырос!”
- “Робокот улучшился!”

Avoid:

- “Ты проиграл.”
- “Ты потерял награду.”
- “Питомец голоден.”
- “Ты его бросил.”
