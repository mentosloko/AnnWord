import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('account recovery and stable transient UI', () => {
  it('requires email confirmation and exposes magic-link login', () => {
    const router = read('server/routes/magicLinkRoutes.ts');
    const authModal = read('components/auth/AuthModal.tsx');
    expect(router).toContain('pending_email_registrations');
    expect(router).toContain("code: 'email_not_confirmed'");
    expect(router).toContain("email_confirmed_at, password_reset_required");
    expect(router).toContain("'email', now(), false");
    expect(authModal).toContain('Войти по magic link');
    expect(authModal).toContain("minLength={mode === 'register' ? 8 : undefined}");
    expect(authModal).toContain('подтвердите адрес');
  });

  it('supports email-based parent PIN recovery', () => {
    const router = read('server/routes/parentPinRecoveryRoutes.ts');
    const adultRoom = read('components/screens/AdultRoomScreen.tsx');
    expect(router).toContain("purpose = 'parent_pin_reset'");
    expect(adultRoom).toContain('Забыли PIN? Восстановить по email');
  });

  it('does not render duplicate petting labels or inline transient setup banners', () => {
    const petRoom = read('components/PetRoom.tsx');
    const setup = read('components/screens/SetupScreenSafe.tsx');
    expect(petRoom).not.toContain('Питомец доволен');
    expect(petRoom).not.toContain('feedback.title');
    expect(petRoom).toContain('aria-live="polite"');
    expect(setup).toContain('FloatingNotice');
  });

  it('reserves form feedback space instead of inserting rows', () => {
    expect(read('components/auth/AuthModal.tsx')).toContain('StableStatusSlot');
    expect(read('components/auth/PasswordResetOverlay.tsx')).toContain('StableStatusSlot');
    expect(read('components/screens/FamilySetupScreen.tsx')).toContain('StableStatusSlot');
    expect(read('components/screens/AdultRoomScreen.tsx')).toContain('StableStatusSlot');
  });
});
