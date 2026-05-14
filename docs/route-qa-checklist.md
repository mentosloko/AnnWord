# AnnWord Route QA Checklist

## Authentication
- [ ] Yandex login from clean incognito session.
- [ ] User profile appears after login.
- [ ] Logout returns to guest state.
- [ ] Session restored after page refresh.

## Home Navigation
- [ ] Home screen loads without infinite spinner.
- [ ] Navigation to Game works.
- [ ] Navigation to Shop works.
- [ ] Navigation to Pet works.
- [ ] Navigation to Settings works.

## Shop
- [ ] Shop screen opens.
- [ ] Home/back navigation always works.
- [ ] Coin balance updates after purchase.
- [ ] Insufficient funds handled gracefully.
- [ ] Inventory updates after purchase.

## Pet
- [ ] Pet screen opens.
- [ ] Feeding updates pet state.
- [ ] Accessory equip/unequip works.
- [ ] Return to Home works.

## Dictionary
- [ ] Custom dictionary upload works.
- [ ] Dictionary persists after refresh.
- [ ] Invalid symbols normalized correctly.
- [ ] Duplicate words removed.
- [ ] Word length filtering works.

## Game Flow
- [ ] Start new game.
- [ ] Guess validation works.
- [ ] Hints work.
- [ ] Win state works.
- [ ] Lose state works.
- [ ] Return Home after game works.

## Smoke / Stability
- [ ] Vercel build READY.
- [ ] Smoke tests pass.
- [ ] No blank screen after deploy.
- [ ] No console auth loop.
