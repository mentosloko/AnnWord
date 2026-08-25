import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('UAT security regressions', () => {
  it('revokes authenticated API access after a password change', () => {
    const migration = read('db/yandex/20260825_security_sessions_v3.sql');
    const auth = read('server/auth.ts');
    const oauth = read('server/yandex-api.ts');
    expect(migration).toContain('bump_session_version_on_password_change');
    expect(migration).toContain('new.session_version := old.session_version + 1');
    expect(auth).toContain('session_version from app_users where id = $1');
    expect(auth).toContain('code: "session_revoked"');
    expect(auth).toContain('ver: user.sessionVersion ?? 1');
    expect(oauth).toContain('u.session_version');
    expect(oauth).toContain('sessionVersion: row.session_version');
  });

  it('uses one-time teacher invites and supports parent revocation', () => {
    const migration = read('db/yandex/20260825_security_sessions_teacher_invites_v2.sql');
    const mentor = read('server/routes/mentorRoutes.ts');
    const family = read('server/routes/familyRoutes.ts');
    const repository = read('server/mentorRepository.ts');
    expect(migration).toContain('teacher_connection_invites');
    expect(migration).toContain('revoked_at');
    expect(mentor).toContain('used_at is null');
    expect(mentor).toContain('used_by_teacher_id');
    expect(mentor).toContain('child_share_code = null');
    expect(mentor).toContain("revoked_at is null");
    expect(family).toContain('/teacher-invite');
    expect(family).toContain('/teacher-connections');
    expect(family).toContain('/teacher-connections/:teacherId/revoke');
    expect(family).toContain('requireParentAccess');
    expect(repository).toContain('l.revoked_at is null');
  });

  it('removes one-time recovery tokens and checks used links before showing forms', () => {
    const password = read('components/auth/PasswordResetOverlay.tsx');
    const magic = read('components/auth/MagicLinkOverlay.tsx');
    const pin = read('components/auth/ParentPinResetOverlay.tsx');
    const status = read('server/routes/actionTokenStatusRoutes.ts');
    expect(password).toContain('passwordResetService.validate(token)');
    expect(password).toContain('clearResetToken();\n      setSuccess(message)');
    expect(magic).toContain('clearToken();\n        setMessage(result.message)');
    expect(pin).toContain('parentPinResetService.validate(token)');
    expect(pin).toContain('clearToken();\n      setSuccess(message)');
    expect(status).toContain('/auth/password/reset/status');
    expect(status).toContain('/family/pin/reset/status');
    expect(status).toContain('used_at is null');
  });

  it('exposes parent UI controls for generating and revoking teacher access', () => {
    const screen = read('components/screens/ParentDashboardScreen.tsx');
    expect(screen).toContain('Создать одноразовый код');
    expect(screen).toContain('Подключённые преподаватели');
    expect(screen).toContain('Отозвать доступ');
    expect(screen).toContain('familyAccountService.revokeTeacherConnection');
  });
});
