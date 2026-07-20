from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text()
    if old not in text:
        raise RuntimeError(f"Expected snippet not found in {path}: {old[:120]!r}")
    target.write_text(text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    target = ROOT / path
    text = target.read_text()
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Expected regex once in {path}: {pattern[:120]!r}, found {count}")
    target.write_text(updated)


# Mount the strict auth and PIN recovery routers before legacy routers.
replace_once(
    'server/yandex-api.ts',
    'import { authRouter } from "./routes/authRoutes";\n',
    'import { magicLinkRouter } from "./routes/magicLinkRoutes";\nimport { authRouter } from "./routes/authRoutes";\n',
)
replace_once(
    'server/yandex-api.ts',
    'import { familyRouter } from "./routes/familyRoutes";\n',
    'import { parentPinRecoveryRouter } from "./routes/parentPinRecoveryRoutes";\nimport { familyRouter } from "./routes/familyRoutes";\n',
)
replace_once(
    'server/yandex-api.ts',
    'app.use("/api/auth", authRouter);\n',
    'app.use("/api/auth", magicLinkRouter);\napp.use("/api/auth", authRouter);\n',
)
replace_once(
    'server/yandex-api.ts',
    'app.use("/api/family", familyRouter);\n',
    'app.use("/api/family", parentPinRecoveryRouter);\napp.use("/api/family", familyRouter);\n',
)

# Render action-token overlays globally.
replace_once(
    'index.tsx',
    "import { PasswordResetOverlay } from './components/auth/PasswordResetOverlay';\n",
    "import { PasswordResetOverlay } from './components/auth/PasswordResetOverlay';\nimport { MagicLinkOverlay } from './components/auth/MagicLinkOverlay';\nimport { ParentPinResetOverlay } from './components/auth/ParentPinResetOverlay';\n",
)
replace_once(
    'index.tsx',
    "{window.location.pathname.startsWith('/api/') ? <FrontendApiFallback /> : <><App /><PasswordResetOverlay /></>}\n",
    "{window.location.pathname.startsWith('/api/') ? <FrontendApiFallback /> : <><App /><PasswordResetOverlay /><MagicLinkOverlay /><ParentPinResetOverlay /></>}\n",
)

# Registration now expects a pending account and never emits SIGNED_IN before magic-link confirmation.
replace_once(
    'services/authService.ts',
    "type BackendBootstrapPayload = {\n",
    "type BackendRegistrationPayload = BackendSessionPayload & {\n  ok?: boolean;\n  needsEmailConfirmation?: boolean;\n  message?: string;\n};\n\ntype BackendBootstrapPayload = {\n",
)
replace_once(
    'services/authService.ts',
    """    if (isBackendApiConfigured) {
      const payload = await withTransientRetry(() => backendApiRequest<BackendSessionPayload>('/api/auth/email/account', {
        method: 'POST',
        body: { email, credential: password, name: email.split('@')[0], consents },
      }));
      writeExplicitLogout(false);
      primeBackendPayload(payload);
      currentBackendAuth = toAuthBootstrap(payload);
      emitBackendAuth('SIGNED_IN', currentBackendAuth);
      return { needsEmailConfirmation: false };
    }
""",
    """    if (isBackendApiConfigured) {
      const payload = await withTransientRetry(() => backendApiRequest<BackendRegistrationPayload>('/api/auth/email/account', {
        method: 'POST',
        body: { email, credential: password, name: email.split('@')[0], consents },
      }));
      writeExplicitLogout(false);
      if (payload.needsEmailConfirmation !== false || !payload.user) {
        clearPrimedBootstrap();
        currentBackendAuth = { session: null, user: null };
        return { needsEmailConfirmation: true };
      }
      primeBackendPayload(payload);
      currentBackendAuth = toAuthBootstrap(payload);
      emitBackendAuth('SIGNED_IN', currentBackendAuth);
      return { needsEmailConfirmation: false };
    }
""",
)

# Auth modal: stable message slot and explicit magic-link button.
replace_once(
    'components/auth/AuthModal.tsx',
    "import { passwordResetService } from '../../services/passwordResetService';\n",
    "import { passwordResetService } from '../../services/passwordResetService';\nimport { magicLinkService } from '../../services/magicLinkService';\nimport { StableStatusSlot } from '../ui/StatusNotice';\n",
)
replace_once(
    'components/auth/AuthModal.tsx',
    "  const requiredConsentsMissing = mode === 'register' && (!termsAccepted || !personalDataAccepted);\n",
    "  const requiredConsentsMissing = mode === 'register' && (!termsAccepted || !personalDataAccepted);\n  const authMessageIsInfo = Boolean(error && /magic link|отправлено письмо|подтверд/i.test(error));\n  const visibleMessage = recoveryError || recoveryMessage || (!recoveryMode ? error : null);\n  const visibleTone = recoveryError ? 'error' : recoveryMessage || authMessageIsInfo ? 'info' : 'error';\n",
)
replace_once(
    'components/auth/AuthModal.tsx',
    """  const requestRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    setRecoveryError(null);
    setRecoveryMessage(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setRecoveryError('Введите корректную электронную почту.');
      return;
    }
    setRecoveryBusy(true);
    try {
      setRecoveryMessage(await passwordResetService.request(email));
    } catch (problem) {
      setRecoveryError(problem instanceof Error ? problem.message : 'Не удалось отправить письмо.');
    } finally {
      setRecoveryBusy(false);
    }
  };
""",
    """  const requestRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    setRecoveryError(null);
    setRecoveryMessage(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setRecoveryError('Введите корректную электронную почту.');
      return;
    }
    setRecoveryBusy(true);
    try {
      setRecoveryMessage(await passwordResetService.request(email));
    } catch (problem) {
      setRecoveryError(problem instanceof Error ? problem.message : 'Не удалось отправить письмо.');
    } finally {
      setRecoveryBusy(false);
    }
  };

  const requestMagicLogin = async () => {
    setRecoveryError(null);
    setRecoveryMessage(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setRecoveryError('Введите email, чтобы получить magic link.');
      return;
    }
    setRecoveryBusy(true);
    try {
      setRecoveryMessage(await magicLinkService.request(email));
    } catch (problem) {
      setRecoveryError(problem instanceof Error ? problem.message : 'Не удалось отправить magic link.');
    } finally {
      setRecoveryBusy(false);
    }
  };
""",
)
replace_once(
    'components/auth/AuthModal.tsx',
    "        {(recoveryError || (!recoveryMode && error)) && <div id=\"auth-modal-error\" className=\"mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-600\" role=\"alert\">⚠️ {recoveryError || error}</div>}\n",
    "        <StableStatusSlot message={visibleMessage} tone={visibleTone} role={visibleTone === 'error' ? 'alert' : 'status'} className=\"mb-1\" />\n",
)
replace_once(
    'components/auth/AuthModal.tsx',
    "            {recoveryMessage && <p role=\"status\" className=\"rounded-2xl bg-green-50 p-3 text-sm font-bold leading-relaxed text-green-800\">{recoveryMessage}</p>}\n",
    "",
)
replace_once(
    'components/auth/AuthModal.tsx',
    "            {mode === 'login' && <button type=\"button\" disabled={isLoading} onClick={onYandexLogin} className=\"mt-3 w-full rounded-xl border-2 border-indigo-100 bg-white p-3 font-bold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-70\">Войти через Яндекс</button>}\n",
    "            {mode === 'login' && <><button type=\"button\" disabled={isLoading || recoveryBusy} onClick={() => void requestMagicLogin()} className=\"mt-3 w-full rounded-xl border-2 border-purple-100 bg-purple-50 p-3 font-bold text-purple-700 transition hover:bg-purple-100 disabled:cursor-wait disabled:opacity-70\">{recoveryBusy ? 'Отправляю ссылку…' : 'Войти по magic link'}</button><button type=\"button\" disabled={isLoading} onClick={onYandexLogin} className=\"mt-3 w-full rounded-xl border-2 border-indigo-100 bg-white p-3 font-bold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-70\">Войти через Яндекс</button></>}\n",
)
replace_once(
    'components/auth/AuthModal.tsx',
    "                 {mode === 'register' && <p id=\"registration-domain-hint\" className={`mt-2 text-xs font-bold leading-relaxed ${invalidRegistrationDomain ? 'text-rose-600' : 'text-gray-500'}`}>Для регистрации используйте адрес в зоне <b>.ru</b> или <b>.рф</b>. Ограничение связано с требованиями к хранению и обработке данных пользователей в России.</p>}\n",
    "                 {mode === 'register' && <p id=\"registration-domain-hint\" className={`mt-2 text-xs font-bold leading-relaxed ${invalidRegistrationDomain ? 'text-rose-600' : 'text-gray-500'}`}>Для регистрации используйте адрес в зоне <b>.ru</b> или <b>.рф</b>. После создания аккаунта потребуется открыть обязательный magic link из письма.</p>}\n",
)

# Password reset form reserves its error area.
replace_once(
    'components/auth/PasswordResetOverlay.tsx',
    "import { passwordResetService } from '../../services/passwordResetService';\n",
    "import { passwordResetService } from '../../services/passwordResetService';\nimport { StableStatusSlot } from '../ui/StatusNotice';\n",
)
replace_once(
    'components/auth/PasswordResetOverlay.tsx',
    "            {error && <p role=\"alert\" className=\"rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700\">{error}</p>}\n",
    "            <StableStatusSlot message={error} tone=\"error\" role=\"alert\" />\n",
)

# Family setup validation no longer inserts/removes layout rows.
replace_once(
    'components/screens/FamilySetupScreen.tsx',
    "import { ScreenContainer } from '../layout/ScreenContainer';\n",
    "import { ScreenContainer } from '../layout/ScreenContainer';\nimport { StableStatusSlot } from '../ui/StatusNotice';\n",
)
replace_once(
    'components/screens/FamilySetupScreen.tsx',
    "          {pinHint && <div id=\"pin-format-hint\" role=\"status\" aria-live=\"polite\" className=\"rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800\">{pinHint}</div>}\n          {error && <div id=\"family-setup-error\" role=\"alert\" aria-live=\"assertive\" className=\"rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700\">{error}</div>}\n",
    "          <div id={error ? 'family-setup-error' : pinHint ? 'pin-format-hint' : undefined}><StableStatusSlot message={error || pinHint} tone={error ? 'error' : 'warning'} role={error ? 'alert' : 'status'} /></div>\n",
)

# Setup errors float above the screen instead of pushing controls down.
replace_once(
    'components/screens/SetupScreenSafe.tsx',
    "import { ScreenContainer } from '../layout/ScreenContainer';\n",
    "import { ScreenContainer } from '../layout/ScreenContainer';\nimport { FloatingNotice } from '../ui/StatusNotice';\n",
)
replace_once(
    'components/screens/SetupScreenSafe.tsx',
    "  return <ScreenContainer className=\"max-w-3xl px-3 pb-20 pt-3 sm:px-4\">\n",
    "  const visibleError = setupError || (dictionaryRuntime.error ? 'Не удалось загрузить словарь. Проверьте соединение и повторите.' : null);\n\n  return <ScreenContainer className=\"max-w-3xl px-3 pb-20 pt-3 sm:px-4\">\n    <FloatingNotice message={visibleError} tone=\"error\" role=\"alert\" />\n",
)
replace_once(
    'components/screens/SetupScreenSafe.tsx',
    "      {setupError && <div role=\"alert\" aria-live=\"assertive\" className=\"mb-4 rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700\">{setupError}</div>}\n      {dictionaryRuntime.error && <div role=\"alert\" aria-live=\"assertive\" className=\"mb-4 rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700\">Не удалось загрузить словарь. Проверьте соединение и повторите.</div>}\n\n",
    "",
)

# Petting has only the upper-right speech bubble; transient errors float.
replace_once(
    'components/PetRoom.tsx',
    "import { CoinIcon } from './CoinIcon';\n",
    "import { CoinIcon } from './CoinIcon';\nimport { FloatingNotice } from './ui/StatusNotice';\n",
)
replace_once('components/PetRoom.tsx', "  const [feedback, setFeedback] = useState<{ title: string; detail: string; itemId?: string } | null>(null);\n", "")
replace_once('components/PetRoom.tsx', "  useEffect(() => { if (!feedback) return; const timer = window.setTimeout(() => setFeedback(null), 2600); return () => window.clearTimeout(timer); }, [feedback]);\n", "")
replace_once('components/PetRoom.tsx', "    setFeedback({ title: 'Питомец доволен', detail: `${pet.name}: «${phrase}»` });\n", "")
replace_once('components/PetRoom.tsx', "    setFeedback({ title: currentItem?.type === 'accessory' ? 'Наряд обновлён' : wantedTreat?.id === id ? 'Желание выполнено' : 'Лакомство использовано', detail: currentItem?.type === 'accessory' ? `${currentItem.name} теперь на питомце.` : `${currentItem?.name || 'Лакомство'} · +${moodDelta} к настроению`, itemId: id });\n", "")
replace_once('components/PetRoom.tsx', "    setFeedback({ title: wasWanted ? 'Желание выполнено' : 'Покупка добавлена', detail: `${item.name} уже в предметах питомца.`, itemId: item.id });\n", "")
replace_once(
    'components/PetRoom.tsx',
    "    {error && <div role=\"alert\" className=\"mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700\">{error}</div>}\n    <AnimatePresence>{feedback && <motion.div role=\"status\" aria-live=\"polite\" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className=\"mb-4 rounded-3xl border-2 border-green-100 bg-green-50 px-4 py-3 text-sm font-bold text-green-800\"><div className=\"text-base font-black\">{feedback.title}</div><div>{feedback.detail}</div></motion.div>}</AnimatePresence>\n",
    "    <FloatingNotice message={error} tone=\"error\" role=\"alert\" />\n",
)
replace_once(
    'components/PetRoom.tsx',
    '<div className="absolute right-4 top-4 max-w-[16rem] rounded-3xl bg-white/90 px-4 py-3 text-sm font-bold text-indigo-900">“{speech}”</div>{feedback && <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute bottom-72 left-1/2 -translate-x-1/2 rounded-full bg-green-500 px-4 py-2 text-sm font-black text-white shadow-lg">{feedback.title}</motion.div>',
    '<div role="status" aria-live="polite" className="absolute right-4 top-4 max-w-[16rem] rounded-3xl bg-white/90 px-4 py-3 text-sm font-bold text-indigo-900">“{speech}”</div>',
)

# Adult room: recover PIN by email and keep validation/notice geometry stable.
replace_once(
    'components/screens/AdultRoomScreen.tsx',
    "import { familyAccountService } from '../../services/familyAccountService';\n",
    "import { familyAccountService } from '../../services/familyAccountService';\nimport { parentPinResetService } from '../../services/parentPinResetService';\n",
)
replace_once(
    'components/screens/AdultRoomScreen.tsx',
    "import { ScreenContainer } from '../layout/ScreenContainer';\n",
    "import { ScreenContainer } from '../layout/ScreenContainer';\nimport { FloatingNotice, StableStatusSlot } from '../ui/StatusNotice';\n",
)
replace_once('components/screens/AdultRoomScreen.tsx', "type BusyAction = 'unlock' | 'connect' | 'assign' | null;\n", "type BusyAction = 'unlock' | 'pin-reset' | 'connect' | 'assign' | null;\n")
replace_once(
    'components/screens/AdultRoomScreen.tsx',
    "  const normalizedCode = code.trim().toUpperCase();\n",
    "  const normalizedCode = code.trim().toUpperCase();\n  const transientMessage = learnersError || notice;\n",
)
replace_once(
    'components/screens/AdultRoomScreen.tsx',
    """  const connect = async () => {
""",
    """  const requestPinReset = async () => {
    setPinError(null);
    setNotice(null);
    setBusyAction('pin-reset');
    try {
      setNotice(await parentPinResetService.request());
    } catch (error: unknown) {
      setPinError(error instanceof Error ? error.message : 'Не удалось отправить письмо для восстановления PIN.');
    } finally {
      setBusyAction(null);
    }
  };

  const connect = async () => {
""",
)
replace_once(
    'components/screens/AdultRoomScreen.tsx',
    "      {pinError && <p id=\"parent-pin-error\" role=\"alert\" className=\"mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700\">{pinError}</p>}\n",
    "      <div className=\"mt-4\"><StableStatusSlot message={pinError} tone=\"error\" role=\"alert\" /></div>\n",
)
replace_once(
    'components/screens/AdultRoomScreen.tsx',
    "      <button type=\"button\" disabled={busyAction === 'unlock'} onClick={() => void unlock()} className=\"mt-4 w-full rounded-xl bg-indigo-600 p-3 font-black text-white disabled:bg-gray-200 disabled:text-gray-400\">{busyAction === 'unlock' ? 'Открываю кабинет...' : 'Открыть'}</button>\n",
    "      <button type=\"button\" disabled={busyAction === 'unlock' || busyAction === 'pin-reset'} onClick={() => void unlock()} className=\"mt-4 w-full rounded-xl bg-indigo-600 p-3 font-black text-white disabled:bg-gray-200 disabled:text-gray-400\">{busyAction === 'unlock' ? 'Открываю кабинет...' : 'Открыть'}</button>\n      <button type=\"button\" disabled={busyAction === 'unlock' || busyAction === 'pin-reset'} onClick={() => void requestPinReset()} className=\"mt-3 w-full rounded-xl border-2 border-purple-100 bg-purple-50 p-3 font-black text-purple-700 disabled:opacity-60\">{busyAction === 'pin-reset' ? 'Отправляю письмо…' : 'Забыли PIN? Восстановить по email'}</button>\n",
)
replace_once(
    'components/screens/AdultRoomScreen.tsx',
    "    {notice && <p role=\"status\" aria-live=\"polite\" className=\"mb-4 rounded-xl bg-indigo-50 p-3 text-sm font-bold text-indigo-700\">{notice}</p>}\n    {learnersError && <div role=\"alert\" className=\"mb-4 flex flex-col gap-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 sm:flex-row sm:items-center sm:justify-between\"><span>{learnersError}</span><button type=\"button\" onClick={() => void load(true)} className=\"rounded-xl bg-white px-3 py-2 text-rose-700\">Повторить</button></div>}\n",
    "    <FloatingNotice message={transientMessage} tone={learnersError ? 'error' : 'info'} role={learnersError ? 'alert' : 'status'} actionLabel={learnersError ? 'Повторить' : undefined} onAction={learnersError ? () => void load(true) : undefined} />\n",
)
replace_once(
    'components/screens/AdultRoomScreen.tsx',
    "</div>{codeError && <p id=\"teacher-code-error\" role=\"alert\" className=\"mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700\">{codeError}</p>}</section>}\n",
    "</div><div id=\"teacher-code-error\" className=\"mt-3\"><StableStatusSlot message={codeError} tone=\"error\" role=\"alert\" /></div></section>}\n",
)

# Source-level regressions for security and layout stability.
(ROOT / 'tests/accountRecoveryAndLayout.test.ts').write_text("""import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('account recovery and stable transient UI', () => {
  it('requires email confirmation and exposes magic-link login', () => {
    const router = read('server/routes/magicLinkRoutes.ts');
    const authModal = read('components/auth/AuthModal.tsx');
    expect(router).toContain("email_confirmed_at = coalesce(email_confirmed_at, now())");
    expect(router).toContain("code: 'email_not_confirmed'");
    expect(authModal).toContain('Войти по magic link');
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
""")

print('Applied magic-link, recovery, and stable-notice patches.')
