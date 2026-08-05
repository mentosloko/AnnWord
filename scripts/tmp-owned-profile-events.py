from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}; needle={old[:180]!r}')
    file.write_text(text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    file = Path(path)
    updated, count = re.subn(pattern, replacement, file.read_text(), count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{path}: expected one regex match, found {count}')
    file.write_text(updated)


Path('services/profileUpdateEvent.ts').write_text("""import type { UserProfile } from '../types';
import { profileCache } from './profileCache';

export interface OwnedProfileUpdateEvent {
  userId: string;
  profile: UserProfile;
}

export const getCurrentProfileOwnerId = (): string | null => profileCache.readSnapshot()?.userId || null;

export const dispatchOwnedProfileUpdate = (userId: string | null, profile: UserProfile): boolean => {
  if (typeof window === 'undefined' || !userId || getCurrentProfileOwnerId() !== userId) return false;
  window.dispatchEvent(new CustomEvent<OwnedProfileUpdateEvent>('annword:profile-updated', { detail: { userId, profile } }));
  return true;
};

export const readOwnedProfileUpdateEvent = (value: unknown): OwnedProfileUpdateEvent | null => {
  if (!value || typeof value !== 'object') return null;
  const detail = value as Partial<OwnedProfileUpdateEvent>;
  if (typeof detail.userId !== 'string' || !detail.userId || !detail.profile || typeof detail.profile !== 'object') return null;
  return { userId: detail.userId, profile: detail.profile as UserProfile };
};
""")

replace_once(
    'hooks/useAuthProfile.ts',
    "import { clearRegistrationIntent, readRegistrationIntent } from '../services/registrationIntent';",
    "import { clearRegistrationIntent, readRegistrationIntent } from '../services/registrationIntent';\nimport { readOwnedProfileUpdateEvent } from '../services/profileUpdateEvent';",
)
regex_once(
    'hooks/useAuthProfile.ts',
    r"  useEffect\(\(\) => \{ if \(typeof window === 'undefined'\) return; const handle = \(event: Event\) => \{.*?window\.removeEventListener\('annword:profile-updated', handle as EventListener\); \}, \[setUserProfile\]\);",
    """  useEffect(() => { if (typeof window === 'undefined') return; const handle = (event: Event) => { const update = readOwnedProfileUpdateEvent((event as CustomEvent<unknown>).detail); if (!update || !isUserProfile(update.profile) || !isCurrentProfileOwner(update.userId)) return; setUserProfileForUser(update.userId, update.profile); setSettings(previous => ({ ...previous, username: update.profile.username })); }; window.addEventListener('annword:profile-updated', handle as EventListener); return () => window.removeEventListener('annword:profile-updated', handle as EventListener); }, [isCurrentProfileOwner, setUserProfileForUser]);""",
)

replace_once(
    'services/premiumDictionaryService.ts',
    "import { backendApiRequest, isBackendApiConfigured } from './backendApiClient';",
    "import { backendApiRequest, isBackendApiConfigured } from './backendApiClient';\nimport { dispatchOwnedProfileUpdate, getCurrentProfileOwnerId } from './profileUpdateEvent';",
)
replace_once(
    'services/premiumDictionaryService.ts',
    "  async saveCollection(draft: PremiumDictionaryDraft): Promise<CustomDictionaryCollection> {\n    const words = normalizeWords(draft.words);",
    "  async saveCollection(draft: PremiumDictionaryDraft): Promise<CustomDictionaryCollection> {\n    const ownerUserId = getCurrentProfileOwnerId();\n    const words = normalizeWords(draft.words);",
)
replace_once(
    'services/premiumDictionaryService.ts',
    "      if (data.profile && typeof window !== 'undefined') {\n        window.dispatchEvent(new CustomEvent('annword:profile-updated', { detail: data.profile }));\n      }",
    "      if (data.profile) dispatchOwnedProfileUpdate(ownerUserId, data.profile);",
)

replace_once(
    'components/WeeklyReportSettingsCard.tsx',
    "import { useProfileFreshness } from '../hooks/useProfileFreshness';",
    "import { useProfileFreshness } from '../hooks/useProfileFreshness';\nimport { dispatchOwnedProfileUpdate, getCurrentProfileOwnerId } from '../services/profileUpdateEvent';",
)
replace_once(
    'components/WeeklyReportSettingsCard.tsx',
    "  const loadStatus = async () => {\n    if (!premiumActive) { setStatus(null); return; }\n    setStatusLoading(true);\n    try {\n      const next = await profileApiService.getWeeklyReportEmailStatus();\n      setStatus(next);\n      setEnabled(next.enabled);\n    } catch {\n      setStatus(null);\n    } finally {\n      setStatusLoading(false);\n    }\n  };",
    """  const loadStatus = async () => {
    if (!premiumActive) { setStatus(null); return; }
    const ownerUserId = getCurrentProfileOwnerId();
    setStatusLoading(true);
    try {
      const next = await profileApiService.getWeeklyReportEmailStatus();
      if (!ownerUserId || getCurrentProfileOwnerId() !== ownerUserId) return;
      setStatus(next);
      setEnabled(next.enabled);
    } catch {
      if (ownerUserId && getCurrentProfileOwnerId() === ownerUserId) setStatus(null);
    } finally {
      if (ownerUserId && getCurrentProfileOwnerId() === ownerUserId) setStatusLoading(false);
    }
  };""",
)
replace_once(
    'components/WeeklyReportSettingsCard.tsx',
    "  const toggleReport = async (nextEnabled: boolean) => {\n    const accountEmail = status?.accountEmail?.trim() || '';",
    "  const toggleReport = async (nextEnabled: boolean) => {\n    const ownerUserId = getCurrentProfileOwnerId();\n    const accountEmail = status?.accountEmail?.trim() || '';",
)
replace_once(
    'components/WeeklyReportSettingsCard.tsx',
    "      const profile = await profileApiService.updateWeeklyReportEmail(nextEnabled ? accountEmail : '');\n      setEnabled(nextEnabled);\n      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('annword:profile-updated', { detail: profile }));",
    "      const profile = await profileApiService.updateWeeklyReportEmail(nextEnabled ? accountEmail : '');\n      if (!ownerUserId || getCurrentProfileOwnerId() !== ownerUserId) return;\n      setEnabled(nextEnabled);\n      dispatchOwnedProfileUpdate(ownerUserId, profile);",
)

replace_once(
    'components/screens/PremiumSuccessScreen.tsx',
    "import { ScreenContainer } from '../layout/ScreenContainer';",
    "import { ScreenContainer } from '../layout/ScreenContainer';\nimport { dispatchOwnedProfileUpdate, getCurrentProfileOwnerId } from '../../services/profileUpdateEvent';",
)
replace_once(
    'components/screens/PremiumSuccessScreen.tsx',
    "export const PremiumSuccessScreen: React.FC<PremiumSuccessScreenProps> = ({ userProfile, onPrimaryAction, onBackHome }) => {\n  const [orderId, setOrderId]",
    "export const PremiumSuccessScreen: React.FC<PremiumSuccessScreenProps> = ({ userProfile, onPrimaryAction, onBackHome }) => {\n  const ownerUserId = getCurrentProfileOwnerId();\n  const [orderId, setOrderId]",
)
replace_once(
    'components/screens/PremiumSuccessScreen.tsx',
    "  const syncProfileAfterActivation = async (): Promise<boolean> => {\n    const profile = await profileApiService.getCurrentProfile();\n    if (isPremiumActive(profile)) {",
    "  const syncProfileAfterActivation = async (): Promise<boolean> => {\n    const profile = await profileApiService.getCurrentProfile();\n    if (!ownerUserId || getCurrentProfileOwnerId() !== ownerUserId) return false;\n    if (isPremiumActive(profile)) {",
)
replace_once(
    'components/screens/PremiumSuccessScreen.tsx',
    "      window.dispatchEvent(new CustomEvent('annword:profile-updated', { detail: profile }));",
    "      dispatchOwnedProfileUpdate(ownerUserId, profile);",
)
replace_once(
    'components/screens/PremiumSuccessScreen.tsx',
    "    const status = await prodamusPaymentService.getPaymentStatus(id);\n    setPaymentStatus(status);",
    "    const status = await prodamusPaymentService.getPaymentStatus(id);\n    if (!ownerUserId || getCurrentProfileOwnerId() !== ownerUserId) return false;\n    setPaymentStatus(status);",
)
replace_once(
    'components/screens/PremiumSuccessScreen.tsx',
    "  }, [confirmed, orderId]);",
    "  }, [confirmed, orderId, ownerUserId]);",
)

path = Path('tests/deepRecentRegressionAudit.test.ts')
text = path.read_text()
text = text.replace(
    "import { resolveOwnedProfileUpdate } from '../services/profileAccessState';",
    "import { resolveOwnedProfileUpdate } from '../services/profileAccessState';\nimport { readOwnedProfileUpdateEvent } from '../services/profileUpdateEvent';",
)
text = text.replace(
    "    it('uses the documented thresholds for the five-games quest', () => {",
    """    it('requires owner metadata on cross-component profile updates', () => {
      const current = profile('current', 4);
      expect(readOwnedProfileUpdateEvent(current)).toBeNull();
      expect(readOwnedProfileUpdateEvent({ userId: 'current-id', profile: current })).toEqual({ userId: 'current-id', profile: current });
      const auth = read('hooks/useAuthProfile.ts');
      expect(auth).toContain('readOwnedProfileUpdateEvent');
      expect(auth).toContain('isCurrentProfileOwner(update.userId)');
      for (const file of ['services/premiumDictionaryService.ts', 'components/WeeklyReportSettingsCard.tsx', 'components/screens/PremiumSuccessScreen.tsx']) {
        expect(read(file)).toContain('dispatchOwnedProfileUpdate');
        expect(read(file)).not.toContain("new CustomEvent('annword:profile-updated'");
      }
    });

    it('uses the documented thresholds for the five-games quest', () => {""",
)
path.write_text(text)
