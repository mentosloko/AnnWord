from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text()
    if old not in text:
        raise RuntimeError(f'Expected snippet not found in {path}: {old[:140]!r}')
    target.write_text(text.replace(old, new, 1))


replace_once(
    'server/routes/magicLinkRoutes.ts',
    "    const input = validateNewUserInput(rawEmail, readText(body[field]), readText(body.name));\n",
    "    const input = validateNewUserInput(rawEmail, randomBytes(24).toString('base64url'), readText(body.name));\n",
)
replace_once(
    'server/routes/magicLinkRoutes.ts',
    """        `insert into app_users (id, email, password_hash, full_name, provider, email_confirmed_at)
         values ($1, $2, $3, $4, 'email', null)
         returning id, email, full_name, password_reset_required`,
""",
    """        `insert into app_users (id, email, password_hash, full_name, provider, email_confirmed_at, password_reset_required)
         values ($1, $2, $3, $4, 'email', null, true)
         returning id, email, full_name, password_reset_required`,
""",
)

replace_once(
    'components/auth/AuthModal.tsx',
    """              <div>
                <label htmlFor="auth-password" className="mb-1 block text-xs font-bold uppercase text-gray-500">Пароль</label>
                <input id="auth-password" required type="password" minLength={mode === 'register' ? 8 : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder={mode === 'login' ? 'ваш пароль' : 'минимум 8 символов'} className="w-full rounded-lg border-2 border-gray-200 p-3 transition focus:border-indigo-500 focus:outline-none" />
                {mode === 'login' && <button type="button" disabled={isLoading} onClick={() => { setRecoveryMode(true); setRecoveryError(null); setRecoveryMessage(null); }} className="mt-2 text-sm font-bold text-indigo-600 hover:text-indigo-800">Забыли пароль?</button>}
              </div>
""",
    """              {mode === 'login' && <div>
                <label htmlFor="auth-password" className="mb-1 block text-xs font-bold uppercase text-gray-500">Пароль</label>
                <input id="auth-password" required type="password" autoComplete="current-password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="ваш пароль" className="w-full rounded-lg border-2 border-gray-200 p-3 transition focus:border-indigo-500 focus:outline-none" />
                <button type="button" disabled={isLoading} onClick={() => { setRecoveryMode(true); setRecoveryError(null); setRecoveryMessage(null); }} className="mt-2 text-sm font-bold text-indigo-600 hover:text-indigo-800">Забыли пароль?</button>
              </div>}
""",
)
replace_once(
    'components/auth/AuthModal.tsx',
    "Для регистрации используйте адрес в зоне <b>.ru</b> или <b>.рф</b>. После создания аккаунта потребуется открыть обязательный magic link из письма.",
    "Для регистрации используйте адрес в зоне <b>.ru</b> или <b>.рф</b>. Пароль не нужен: аккаунт создаётся только после подтверждения обязательного magic link из письма.",
)

replace_once(
    'hooks/useAuthProfile.ts',
    "    if (!tempUsername.trim() || !tempPassword.trim()) { setAuthError('Заполните все поля'); return false; }\n",
    "    if (!tempUsername.trim() || (authMode === 'login' && !tempPassword.trim())) { setAuthError(authMode === 'login' ? 'Заполните email и пароль' : 'Введите email'); return false; }\n",
)

replace_once(
    'server/routes/authRoutes.ts',
    """            set password_hash = $2,
                password_reset_required = false,
                updated_at = now()
""",
    """            set password_hash = $2,
                password_reset_required = false,
                email_confirmed_at = coalesce(email_confirmed_at, now()),
                updated_at = now()
""",
)

replace_once(
    'tests/accountRecoveryAndLayout.test.ts',
    "    expect(router).toContain(\"code: 'email_not_confirmed'\");\n",
    "    expect(router).toContain(\"code: 'email_not_confirmed'\");\n    expect(router).toContain(\"email_confirmed_at, password_reset_required\");\n    expect(router).toContain(\"null, true\");\n",
)
replace_once(
    'tests/accountRecoveryAndLayout.test.ts',
    "    expect(authModal).toContain('Войти по magic link');\n",
    "    expect(authModal).toContain('Войти по magic link');\n    expect(authModal).toContain(\"mode === 'login' && <div>\");\n    expect(authModal).toContain('Пароль не нужен');\n",
)

print('Hardened magic-link-first registration.')
