import React from 'react';
import { AppRouter } from './AppRouter';
import { LandingMixScreen } from './screens/LandingMixScreen';
import { ClientEntryPath } from '../services/clientEntryPath';
import type { AccountMode, DailyQuestCompletionReward, DailyQuestState, GameSettings, GameState, CharStatus, PetState, ShopItem, UserProfile, ViewState, WordLength } from '../types';
import type { GameRewardInput } from '../services/gamificationRules';
import type { WordPracticeResult } from '../services/gameSessionEngine';
import type { ClassicGameSessionMeta } from '../hooks/useClassicGameController';
import type { PremiumDictionaryDraft } from '../services/premiumDictionaryService';
import type { ChildSetupResult } from '../services/familyAccountService';
import { activeWordSourceFromSettings, activeWordSourceKey, applyActiveWordSourceToSettings } from '../services/activeWordSource';
import { resolveActiveDictionaryDescriptor } from '../services/activeDictionaryDescriptor';
import { profileApiService } from '../services/profileApiService';
import { dispatchOwnedProfileUpdate, getCurrentProfileOwnerId } from '../services/profileUpdateEvent';
import { getDailyQuestPrimaryMode, getDailyQuestTargetModes } from '../services/dailyQuest';
import { clearSavedAnagramSession, hasSavedAnagramSession } from '../services/anagramSessionStatus';
import { clearPersistedGameSession, readPersistedGameSession, routeForPersistedGame, type PersistedGameType } from '../services/gameSessionStore';
import { resolveAccessibleRoute } from '../services/routeAccess';
import { DailyQuestRewardModal } from './DailyQuestCard';
import { clearPremiumIntent, getPremiumSuccessRoute, readPremiumIntent, rememberPremiumIntent, type PremiumIntentKind } from '../services/premiumIntent';

const PracticeHomeScreen = React.lazy(() => import('./screens/PracticeHomeScreenWithLetterSquare').then(module => ({ default: module.PracticeHomeScreenWithLetterSquare })));
const PremiumScreen = React.lazy(() => import('./screens/PremiumScreen').then(module => ({ default: module.PremiumScreen })));
const PremiumSuccessScreen = React.lazy(() => import('./screens/PremiumSuccessScreen').then(module => ({ default: module.PremiumSuccessScreen })));
const KidsHomeScreen = React.lazy(() => import('./screens/KidsHomeScreen').then(module => ({ default: module.KidsHomeScreen })));
const TeacherDashboardScreen = React.lazy(() => import('./screens/TeacherDashboardScreen').then(module => ({ default: module.TeacherDashboardScreen })));
const SetupScreen = React.lazy(() => import('./screens/SetupScreen').then(module => ({ default: module.SetupScreen })));
const ClassicGameScreen = React.lazy(() => import('./screens/ClassicGameScreen').then(module => ({ default: module.ClassicGameScreen })));
const ProfileScreen = React.lazy(() => import('./screens/ProfileScreen').then(module => ({ default: module.ProfileScreen })));
const AccountModeSetupScreen = React.lazy(() => import('./screens/AccountModeSetupScreen').then(module => ({ default: module.AccountModeSetupScreen })));
const CharacterOnboardingScreen = React.lazy(() => import('./screens/CharacterOnboardingScreen').then(module => ({ default: module.CharacterOnboardingScreen })));
const FamilySetupScreen = React.lazy(() => import('./screens/FamilySetupScreen').then(module => ({ default: module.FamilySetupScreen })));
const AdminControlCenterScreen = React.lazy(() => import('./screens/AdminControlCenterScreen').then(module => ({ default: module.AdminControlCenterScreen })));
const AdultRoomScreen = React.lazy(() => import('./screens/AdultRoomScreen').then(module => ({ default: module.AdultRoomScreen })));
const ParentDashboardScreen = React.lazy(() => import('./screens/ParentDashboardScreen').then(module => ({ default: module.ParentDashboardScreen })));
const DictionarySettingsScreen = React.lazy(() => import('./screens/DictionarySettingsScreen').then(module => ({ default: module.DictionarySettingsScreen })));
const DictionaryStudioScreen = React.lazy(() => import('./screens/DictionaryStudioScreen').then(module => ({ default: module.DictionaryStudioScreen })));
const AnagramsScreen = React.lazy(() => import('./screens/ModeScreens').then(module => ({ default: module.AnagramsScreen })));
const HangmanScreen = React.lazy(() => import('./screens/ModeScreens').then(module => ({ default: module.HangmanScreen })));
const MemoryScreen = React.lazy(() => import('./screens/ModeScreens').then(module => ({ default: module.MemoryScreen })));
const SprintScreen = React.lazy(() => import('./screens/ModeScreens').then(module => ({ default: module.SprintScreen })));
const TranslationChoiceScreen = React.lazy(() => import('./screens/ModeScreens').then(module => ({ default: module.TranslationChoiceScreen })));
const GameModeShell = React.lazy(() => import('./screens/GameModeShell').then(module => ({ default: module.GameModeShell })));
const LetterSquareGameV3 = React.lazy(() => import('./LetterSquareGameV3').then(module => ({ default: module.LetterSquareGameV3 })));
const Shop = React.lazy(() => import('./Shop').then(module => ({ default: module.Shop })));
const PetRoom = React.lazy(() => import('./PetRoom').then(module => ({ default: module.PetRoom })));

export type PlayableModeRoute = 'game' | 'anagrams' | 'translation' | 'sprint' | 'memory' | 'hangman' | 'letter_square';
export interface ClassicGameScreenBindings { setupError: string | null; gameState: GameState; keyStatuses: Record<string, CharStatus>; shakeRowIndex: number | null; hasActiveGame?: boolean; resumeGame?: () => boolean; startNewGame: (dictionarySnapshot?: string[], sessionMeta?: ClassicGameSessionMeta) => void; handleChar: (char: string) => void; handleDelete: () => void; handleEnter: () => void | Promise<void>; fetchHint: () => void | Promise<void>; }
export interface DictionaryUploadBindings { isUploadingDictionary: boolean; error: string | null; onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void; }
export interface AppScreensProps {
  route: ViewState;
  entryPath: ClientEntryPath;
  userProfile: UserProfile;
  isAuthenticated: boolean;
  sessionOwnerId?: string | null;
  dailyQuest?: DailyQuestState | null;
  dailyQuestReward?: DailyQuestCompletionReward | null;
  onCloseDailyQuestReward?: () => void;
  settings: GameSettings;
  modeWords: string[];
  activeDictionaryWordCount?: number;
  selectedPlayMode: PlayableModeRoute;
  classicGame: ClassicGameScreenBindings;
  dictionaryUpload: DictionaryUploadBindings;
  onRouteChange: (route: ViewState) => void;
  onEntryPathChange: (entryPath: ClientEntryPath) => void;
  onSelectedPlayModeChange: (mode: PlayableModeRoute) => void;
  onSettingsChange: (settings: GameSettings | ((prev: GameSettings) => GameSettings)) => void;
  onOpenLogin: () => void;
  onOpenRegister: (path?: 'practice' | 'kids' | 'teacher') => void;
  onOpenRules: () => void;
  onBuy: (item: ShopItem) => Promise<void>;
  onUseItem: (itemId: string) => Promise<void>;
  onUpdatePet: (pet: PetState) => Promise<void>;
  onSaveDictionary: (draft: PremiumDictionaryDraft) => Promise<void>;
  onSelectAccountMode: (mode: AccountMode) => Promise<void>;
  onCreateChild: (childName: string, pin: string) => Promise<ChildSetupResult>;
  onChildSetupComplete: (result: ChildSetupResult) => void;
  onGameReward: (input: GameRewardInput) => Promise<void>;
  onWordPractice?: (word: string, result: WordPracticeResult) => Promise<void>;
  onCharacterOnboardingComplete: (character: PetState) => Promise<void>;
  onGameStarted?: (mode: PlayableModeRoute) => void;
  onTestUnlockPremium?: () => void;
  onDictionaryPeek?: () => boolean | Promise<boolean>;
}

type GameDictionarySnapshot = { words: string[]; label: string; icon: string; key: string };
const WORD_LENGTHS: WordLength[] = [4, 5, 6];
const randomWordLength = (): WordLength => WORD_LENGTHS[Math.floor(Math.random() * WORD_LENGTHS.length)];
const ownWordList = (profile: UserProfile): string[] => Array.from(new Set([...(profile.customDictionaryEn || []), ...(profile.assignedWords || [])]));
const normalizeSnapshotWords = (words: string[]): string[] => Array.from(new Set(words.map(word => word.trim().toUpperCase()).filter(Boolean)));
const sameWordSnapshot = (first: string[], second: string[]): boolean => {
  const left = normalizeSnapshotWords(first);
  const right = normalizeSnapshotWords(second);
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every(word => rightSet.has(word));
};
const ScreenLoading = () => <div className="mx-auto mt-10 max-w-md rounded-3xl bg-white p-8 text-center font-bold text-indigo-700 shadow-sm ring-1 ring-indigo-100">Открываю раздел…</div>;

export const AppScreens: React.FC<AppScreensProps> = ({ route, entryPath, userProfile, isAuthenticated, sessionOwnerId, dailyQuest, dailyQuestReward, onCloseDailyQuestReward, settings, modeWords, activeDictionaryWordCount, selectedPlayMode, classicGame, dictionaryUpload, onRouteChange, onEntryPathChange, onSelectedPlayModeChange, onSettingsChange, onOpenLogin, onOpenRegister, onBuy, onUseItem, onUpdatePet, onSaveDictionary, onSelectAccountMode, onCreateChild, onChildSetupComplete, onGameReward, onWordPractice, onCharacterOnboardingComplete, onGameStarted, onTestUnlockPremium, onDictionaryPeek }) => {
  const [quickStartRequested, setQuickStartRequested] = React.useState(false);
  const [dictionarySnapshot, setDictionarySnapshot] = React.useState<GameDictionarySnapshot | null>(null);
  const [resumeSavedType, setResumeSavedType] = React.useState<PersistedGameType | null>(null);
  const ownWords = ownWordList(userProfile);
  const safeRoute = resolveAccessibleRoute(route, userProfile, isAuthenticated);
  const goHome = () => { setQuickStartRequested(false); setDictionarySnapshot(null); setResumeSavedType(null); onRouteChange('landing'); };
  const openEntry = (path: ClientEntryPath) => { onEntryPathChange(path); onRouteChange('landing'); };
  const startRegisterFor = (path: 'practice' | 'kids' | 'teacher') => { openEntry(path); onOpenRegister(path); };
  const isParentAccount = userProfile.role === 'parent' || userProfile.accountMode === 'parent';
  const isTeacher = userProfile.role === 'teacher' || userProfile.accountMode === 'teacher';
  const hasChosenAccountMode = userProfile.role === 'admin' || Boolean(userProfile.accountMode);
  const rulesViewerKey = `${userProfile.accountMode || userProfile.role || 'guest'}:${userProfile.username || 'guest'}`;

  React.useEffect(() => {
    if (safeRoute !== route) onRouteChange(safeRoute);
  }, [onRouteChange, route, safeRoute]);
  React.useEffect(() => {
    if (!isAuthenticated || (!userProfile.accountMode && userProfile.role !== 'admin')) return;
    const canonicalEntry: ClientEntryPath = userProfile.role === 'admin' ? 'home' : isTeacher ? 'teacher' : isParentAccount ? 'kids' : 'practice';
    if (entryPath !== canonicalEntry) onEntryPathChange(canonicalEntry);
  }, [entryPath, isAuthenticated, isParentAccount, isTeacher, onEntryPathChange, userProfile.accountMode, userProfile.role]);
  React.useEffect(() => {
    const openPet = () => { if (isParentAccount) onRouteChange('pet_room'); };
    window.addEventListener('annword:navigate-pet', openPet);
    return () => window.removeEventListener('annword:navigate-pet', openPet);
  }, [isParentAccount, onRouteChange]);

  const openPremiumFrom = (from: ViewState, kind: PremiumIntentKind = 'general') => { rememberPremiumIntent(kind, from); onRouteChange('premium'); };
  const returnFromPremium = () => onRouteChange(readPremiumIntent()?.returnTo || 'landing');
  const openAfterPayment = () => { const next = getPremiumSuccessRoute(readPremiumIntent(), isParentAccount); clearPremiumIntent(); onRouteChange(next); };
  const openDictionaryFromGameArea = () => onRouteChange(isParentAccount ? 'dictionary_settings' : 'dictionary_studio');
  const setupError = classicGame.setupError || dictionaryUpload.error;
  const savedGameSession = isAuthenticated ? readPersistedGameSession(sessionOwnerId) : null;
  const hasLegacyAnagramGame = !savedGameSession && isAuthenticated && hasSavedAnagramSession(userProfile.username);
  const hasActiveClassicGame = Boolean(classicGame.hasActiveGame);
  const hasActiveAnagramGame = savedGameSession?.gameType === 'anagrams' || hasLegacyAnagramGame;
  const activeDictionary = resolveActiveDictionaryDescriptor(settings, userProfile, isParentAccount);
  const activeDictionaryName = activeDictionary.title;
  const activeDictionaryIcon = activeDictionary.icon;
  const currentDictionaryId = activeWordSourceKey(activeWordSourceFromSettings(settings));
  const setupQuestContext = dailyQuest && getDailyQuestTargetModes(dailyQuest).includes(selectedPlayMode) ? dailyQuest : null;
  const hasKnownDictionary = activeDictionary.available && Boolean(activeDictionaryWordCount || modeWords.length || ownWords.length || settings.dictionarySource === 'builtin' || settings.dictionarySource === 'premium');

  const commitDictionarySettings = async (draftSettings: GameSettings): Promise<void> => {
    const ownerId = getCurrentProfileOwnerId();
    if (!ownerId) throw new Error('Войдите, чтобы сохранить выбор словаря.');
    const profile = await profileApiService.updateActiveWordSource(activeWordSourceFromSettings(draftSettings));
    if (!dispatchOwnedProfileUpdate(ownerId, profile)) {
      throw new Error('Аккаунт изменился во время сохранения. Повторите выбор словаря.');
    }
    onSettingsChange(previous => applyActiveWordSourceToSettings({ ...previous, wordLength: draftSettings.wordLength, username: profile.username }, profile.activeWordSource));
  };

  const routeLegacyResumeThroughCurrentDictionary = (mode: PlayableModeRoute): boolean => {
    setDictionarySnapshot(null);
    setResumeSavedType(null);
    setQuickStartRequested(hasKnownDictionary);
    onSelectedPlayModeChange(mode);
    onRouteChange('setup');
    return true;
  };
  const resumeSavedGame = (): boolean => {
    const saved = readPersistedGameSession(sessionOwnerId);
    if (saved) {
      setDictionarySnapshot(null);
      setResumeSavedType(saved.gameType);
      setQuickStartRequested(hasKnownDictionary);
      onSelectedPlayModeChange(saved.gameType);
      onRouteChange('setup');
      return true;
    }
    if (hasActiveClassicGame) return routeLegacyResumeThroughCurrentDictionary('game');
    if (hasLegacyAnagramGame) {
      clearSavedAnagramSession(userProfile.username);
      return routeLegacyResumeThroughCurrentDictionary('anagrams');
    }
    return false;
  };
  const requestQuickLaunch = (mode: PlayableModeRoute) => {
    if (isTeacher) return;
    const saved = readPersistedGameSession(sessionOwnerId);
    setResumeSavedType(saved?.gameType === mode ? saved.gameType : null);
    onSelectedPlayModeChange(mode);
    setDictionarySnapshot(null);
    setQuickStartRequested(hasKnownDictionary);
    onRouteChange('setup');
  };
  const startSelectedMode = (snapshotWords?: string[]) => {
    const words = normalizeSnapshotWords(snapshotWords || modeWords);
    const saved = resumeSavedType ? readPersistedGameSession(sessionOwnerId) : null;
    const canResumeSavedProgress = Boolean(saved
      && saved.gameType === resumeSavedType
      && saved.gameType === selectedPlayMode
      && saved.dictionaryId === currentDictionaryId
      && sameWordSnapshot(saved.dictionaryWords, words));

    if (!canResumeSavedProgress) clearPersistedGameSession(sessionOwnerId);
    if (selectedPlayMode === 'anagrams') clearSavedAnagramSession(userProfile.username);
    const snapshot: GameDictionarySnapshot = { words, label: activeDictionaryName, icon: activeDictionaryIcon, key: currentDictionaryId };
    setDictionarySnapshot(snapshot);
    setQuickStartRequested(false);
    setResumeSavedType(null);
    if (!canResumeSavedProgress) onGameStarted?.(selectedPlayMode);
    if (selectedPlayMode === 'game') {
      if (canResumeSavedProgress && classicGame.resumeGame?.()) return;
      classicGame.startNewGame(words, { dictionaryId: snapshot.key, dictionaryWords: snapshot.words, dictionaryLabel: snapshot.label, dictionaryIcon: snapshot.icon });
      return;
    }
    onRouteChange(selectedPlayMode);
  };
  const startDailyQuest = (quest: DailyQuestState) => {
    const mode = getDailyQuestPrimaryMode(quest);
    onSettingsChange(previous => ({ ...previous, wordLength: randomWordLength() }));
    requestQuickLaunch(mode);
  };

  const playWords = dictionarySnapshot?.words || modeWords;
  const playDictionaryName = dictionarySnapshot?.label || activeDictionaryName;
  const playDictionaryIcon = dictionarySnapshot?.icon || activeDictionaryIcon;
  const playDictionaryId = dictionarySnapshot?.key || currentDictionaryId;
  const resumableType = (savedGameSession?.gameType || (hasLegacyAnagramGame ? 'anagrams' : hasActiveClassicGame ? 'game' : null)) as PersistedGameType | null;
  const continueSaved = resumableType ? resumeSavedGame : undefined;
  const gameProps = { words: playWords, wordLength: settings.wordLength, dictionaryId: playDictionaryId, dictionaryLabel: playDictionaryName, dictionaryIcon: playDictionaryIcon, sessionOwnerId, rulesViewerKey, userProfile, onGameReward, onWordPractice, onBackHome: goHome, onDictionaryPeek };
  const landingMix = <LandingMixScreen entryPath={entryPath} onLogin={onOpenLogin} onStartPractice={() => startRegisterFor('practice')} onStartKids={() => startRegisterFor('kids')} onStartTeacher={() => startRegisterFor('teacher')} />;
  const suggestedMode = entryPath === 'kids' ? 'parent' : entryPath === 'teacher' ? 'teacher' : entryPath === 'practice' ? 'player' : null;
  const accountModeSetup = <AccountModeSetupScreen suggestedMode={suggestedMode} onSelectMode={onSelectAccountMode} />;
  const practiceHome = <PracticeHomeScreen userProfile={userProfile} dailyQuest={dailyQuest} dailyQuestReward={null} onCloseDailyQuestReward={onCloseDailyQuestReward} onStartDailyQuest={startDailyQuest} hasActiveClassicGame={hasActiveClassicGame} hasActiveAnagramGame={hasActiveAnagramGame} savedGameType={resumableType} onContinueSavedGame={continueSaved} activeDictionaryName={activeDictionaryName} onStartClassic={() => requestQuickLaunch('game')} onStartAnagrams={() => requestQuickLaunch('anagrams')} onStartTranslation={() => requestQuickLaunch('translation')} onStartSprint={() => requestQuickLaunch('sprint')} onStartHangman={() => requestQuickLaunch('hangman')} onStartMemory={() => requestQuickLaunch('memory')} onStartLetterSquare={() => requestQuickLaunch('letter_square')} onOpenProfile={() => onRouteChange('profile')} onOpenDictionaryStudio={() => onRouteChange('dictionary_settings')} onOpenPremium={() => openPremiumFrom('landing')} />;
  const kidsHome = <KidsHomeScreen userProfile={userProfile} dailyQuest={dailyQuest} dailyQuestReward={null} onCloseDailyQuestReward={onCloseDailyQuestReward} onStartDailyQuest={startDailyQuest} hasActiveClassicGame={hasActiveClassicGame} hasActiveAnagramGame={hasActiveAnagramGame} savedGameType={resumableType} onContinueSavedGame={continueSaved} activeDictionaryName={activeDictionaryName} onStartClassic={() => requestQuickLaunch('game')} onStartAnagrams={() => requestQuickLaunch('anagrams')} onStartTranslation={() => requestQuickLaunch('translation')} onStartSprint={() => requestQuickLaunch('sprint')} onStartHangman={() => requestQuickLaunch('hangman')} onStartMemory={() => requestQuickLaunch('memory')} onStartLetterSquare={() => requestQuickLaunch('letter_square')} onOpenShop={() => onRouteChange('shop')} onOpenProfile={() => onRouteChange('profile')} onOpenPetRoom={() => onRouteChange('pet_room')} onOpenAdultRoom={() => onRouteChange('adult_room')} onOpenDictionary={() => onRouteChange('dictionary_settings')} onOpenPremium={() => openPremiumFrom('landing')} />;
  const teacherHome = <TeacherDashboardScreen userProfile={userProfile} onOpenDictionaryStudio={() => onRouteChange('dictionary_studio')} onOpenAdultRoom={() => onRouteChange('adult_room')} onOpenProfile={() => onRouteChange('profile')} />;
  const roleHomeScreen = isTeacher ? teacherHome : isParentAccount ? kidsHome : practiceHome;
  const homeScreen = isAuthenticated ? (hasChosenAccountMode ? roleHomeScreen : accountModeSetup) : landingMix;
  const letterSquareRules = ['Соединяйте соседние буквы, чтобы собрать слово змейкой.', 'Диагонали запрещены: только вверх, вниз, влево и вправо.', 'Ошибочные слова попадают в повторение.'];

  const screens: Partial<Record<ViewState, React.ReactNode>> = {
    admin: <AdminControlCenterScreen userProfile={userProfile} onBackHome={goHome} />,
    adult_room: isParentAccount ? <ParentDashboardScreen userProfile={userProfile} onBackHome={goHome} onOpenDictionaryStudio={() => onRouteChange('dictionary_settings')} /> : <AdultRoomScreen userProfile={userProfile} onBackHome={goHome} onOpenDictionaryStudio={() => onRouteChange('dictionary_studio')} />,
    dictionary_settings: <DictionarySettingsScreen settings={settings} userProfile={userProfile} customDictionaryWords={ownWords} isAuthenticated={isAuthenticated} onCommitSettings={commitDictionarySettings} onOpenDictionaryStudio={() => onRouteChange('dictionary_studio')} onOpenPremium={() => openPremiumFrom('dictionary_settings', 'dictionary_settings')} onBack={goHome} />,
    dictionary_studio: <DictionaryStudioScreen userProfile={userProfile} onBack={() => onRouteChange(isParentAccount || isTeacher ? 'adult_room' : 'dictionary_settings')} onSaveDictionary={onSaveDictionary} />,
    premium: <PremiumScreen userProfile={userProfile} onBack={returnFromPremium} onOpenDictionarySetup={() => onRouteChange('dictionary_settings')} onTestUnlockPremium={onTestUnlockPremium || (() => undefined)} />,
    premium_success: <PremiumSuccessScreen userProfile={userProfile} onPrimaryAction={openAfterPayment} onBackHome={goHome} />,
    account_mode_setup: hasChosenAccountMode ? homeScreen : accountModeSetup,
    family_setup: <FamilySetupScreen onCreateChild={onCreateChild} onComplete={onChildSetupComplete} onBackHome={goHome} />,
    character_onboarding: isParentAccount ? <CharacterOnboardingScreen onComplete={onCharacterOnboardingComplete} /> : homeScreen,
    landing: homeScreen,
    setup: <SetupScreen selectedPlayMode={selectedPlayMode} settings={settings} customDictionaryWords={ownWords} setupError={setupError} isUploadingDictionary={dictionaryUpload.isUploadingDictionary} isAuthenticated={isAuthenticated} userProfile={userProfile} questContext={setupQuestContext} hasActiveClassicGame={hasActiveClassicGame} onResumeClassicGame={classicGame.resumeGame} onSettingsChange={onSettingsChange} onCommitDictionarySettings={commitDictionarySettings} onFileUpload={dictionaryUpload.onFileUpload} onOpenDictionaryStudio={openDictionaryFromGameArea} onOpenPremium={() => openPremiumFrom('setup', 'game_setup')} onStartGame={startSelectedMode} onBack={goHome} onLogin={onOpenLogin} autoStart={quickStartRequested} onAutoStartComplete={() => setQuickStartRequested(false)} />,
    game: <ClassicGameScreen gameState={classicGame.gameState} settings={settings} userProfile={userProfile} isAuthenticated={isAuthenticated} rulesViewerKey={rulesViewerKey} keyStatuses={classicGame.keyStatuses} shakeRowIndex={classicGame.shakeRowIndex} dictionaryWords={playWords} dictionaryLabel={playDictionaryName} dictionaryIcon={playDictionaryIcon} onChar={classicGame.handleChar} onDelete={classicGame.handleDelete} onEnter={classicGame.handleEnter} onHint={classicGame.fetchHint} onRestart={classicGame.startNewGame} onBackHome={goHome} onRegister={() => onOpenRegister()} onDictionaryPeek={onDictionaryPeek} />,
    profile: <ProfileScreen userProfile={userProfile} isAuthenticated={isAuthenticated} activeDictionaryName={activeDictionaryName} onBackHome={goHome} onOpenShop={() => isParentAccount ? onRouteChange('shop') : onRouteChange('landing')} onOpenPetRoom={() => isParentAccount ? onRouteChange('pet_room') : onRouteChange('landing')} onLogin={onOpenLogin} />,
    anagrams: <AnagramsScreen {...gameProps} />,
    translation: <TranslationChoiceScreen {...gameProps} />,
    sprint: <SprintScreen {...gameProps} />,
    memory: <MemoryScreen {...gameProps} />,
    hangman: <HangmanScreen {...gameProps} />,
    letter_square: <GameModeShell gameId="letter_square" viewerKey={rulesViewerKey} title="Змейка" subtitle="Соединяй буквы цепочкой" rules={letterSquareRules} showDictionary={false} onBackHome={goHome}><LetterSquareGameV3 key={`${playDictionaryId}:${playWords.join('|')}`} userProfile={{ ...userProfile, customDictionaryEn: playWords }} sessionOwnerId={sessionOwnerId} dictionaryId={playDictionaryId} dictionaryLabel={playDictionaryName} dictionaryIcon={playDictionaryIcon} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={goHome} /></GameModeShell>,
    shop: isParentAccount ? <Shop userProfile={userProfile} onBuy={onBuy} onClose={goHome} onOpenPetRoom={() => onRouteChange('pet_room')} /> : homeScreen,
    pet_room: isParentAccount ? <div className="h-[100dvh] min-h-[100svh] overflow-y-auto overscroll-contain"><PetRoom userProfile={userProfile} onUseItem={onUseItem} onBuy={onBuy} onUpdatePet={onUpdatePet} onClose={goHome} onOpenShop={() => onRouteChange('shop')} /></div> : homeScreen,
  };

  const rewardStreakDays = Math.max(0, Math.round(userProfile.pet.dailyStreak || 0));
  return <><React.Suspense fallback={<ScreenLoading />}><AppRouter route={safeRoute} screens={screens} fallback={screens.landing} /></React.Suspense>{dailyQuestReward && onCloseDailyQuestReward && <DailyQuestRewardModal reward={dailyQuestReward} streakDays={rewardStreakDays} onClose={onCloseDailyQuestReward} onOpenPetRoom={isParentAccount ? () => onRouteChange('pet_room') : undefined} onOpenShop={isParentAccount ? () => onRouteChange('shop') : undefined} />}</>;
};
