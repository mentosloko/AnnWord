import React from 'react';
import { AppRouter } from './AppRouter';
import { LandingMixScreen } from './screens/LandingMixScreen';
import { ClientEntryPath } from '../services/clientEntryPath';
import type { AccountMode, DailyQuestCompletionReward, DailyQuestState, GameSettings, GameState, CharStatus, PetState, ShopItem, UserProfile, ViewState, WordLength } from '../types';
import type { GameRewardInput } from '../services/gamificationRules';
import type { WordPracticeResult } from '../services/gameSessionEngine';
import type { PremiumDictionaryDraft } from '../services/premiumDictionaryService';
import type { ChildSetupResult } from '../services/familyAccountService';
import { getDailyQuestPrimaryMode, getDailyQuestTargetModes } from '../services/dailyQuest';
import { getKidsDictionaryMeta } from '../services/kidsDictionaryCatalog';
import { getPremiumDictionaryMeta } from '../services/premiumDictionaryCatalog';
import { hasSavedAnagramSession } from '../services/anagramSessionStatus';
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
export interface ClassicGameScreenBindings { setupError: string | null; gameState: GameState; keyStatuses: Record<string, CharStatus>; shakeRowIndex: number | null; hasActiveGame?: boolean; resumeGame?: () => boolean; startNewGame: () => void; handleChar: (char: string) => void; handleDelete: () => void; handleEnter: () => void | Promise<void>; fetchHint: () => void | Promise<void>; }
export interface DictionaryUploadBindings { isUploadingDictionary: boolean; error: string | null; onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void; }
export interface AppScreensProps {
  route: ViewState;
  entryPath: ClientEntryPath;
  userProfile: UserProfile;
  isAuthenticated: boolean;
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
  onOpenRegister: () => void;
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

const WORD_LENGTHS: WordLength[] = [4, 5, 6];
const randomWordLength = (): WordLength => WORD_LENGTHS[Math.floor(Math.random() * WORD_LENGTHS.length)];
const ownWordList = (profile: UserProfile): string[] => Array.from(new Set([...(profile.customDictionaryEn || []), ...(profile.assignedWords || [])]));
const ScreenLoading = () => <div className="mx-auto mt-10 max-w-md rounded-3xl border-2 border-indigo-50 bg-white p-8 text-center font-black text-indigo-700 shadow-sm">Открываю раздел…</div>;

export const AppScreens: React.FC<AppScreensProps> = ({ route, entryPath, userProfile, isAuthenticated, dailyQuest, dailyQuestReward, onCloseDailyQuestReward, settings, modeWords, selectedPlayMode, classicGame, dictionaryUpload, onRouteChange, onEntryPathChange, onSelectedPlayModeChange, onSettingsChange, onOpenLogin, onOpenRegister, onOpenRules, onBuy, onUseItem, onUpdatePet, onSaveDictionary, onSelectAccountMode, onCreateChild, onChildSetupComplete, onGameReward, onWordPractice, onCharacterOnboardingComplete, onGameStarted, onTestUnlockPremium, onDictionaryPeek }) => {
  const ownWords = ownWordList(userProfile);
  const goHome = () => onRouteChange('landing');
  const openEntry = (path: ClientEntryPath) => { onEntryPathChange(path); onRouteChange('landing'); };
  const startRegisterFor = (path: 'practice' | 'kids' | 'teacher') => { openEntry(path); onOpenRegister(); };
  const isParentAccount = userProfile.role === 'parent' || userProfile.accountMode === 'parent';
  const isTeacher = userProfile.role === 'teacher' || userProfile.accountMode === 'teacher';
  const hasChosenAccountMode = userProfile.role === 'admin' || Boolean(userProfile.accountMode);
  const rulesViewerKey = `${userProfile.accountMode || userProfile.role || 'guest'}:${userProfile.username || 'guest'}`;

  React.useEffect(() => {
    if (!isAuthenticated || (!userProfile.accountMode && userProfile.role !== 'admin')) return;
    const canonicalEntry: ClientEntryPath = userProfile.role === 'admin' ? 'home' : isTeacher ? 'teacher' : isParentAccount ? 'kids' : 'practice';
    if (entryPath !== canonicalEntry) onEntryPathChange(canonicalEntry);
  }, [entryPath, isAuthenticated, isParentAccount, isTeacher, onEntryPathChange, userProfile.accountMode, userProfile.role]);

  const openPremiumFrom = (from: ViewState, kind: PremiumIntentKind = 'general') => {
    rememberPremiumIntent(kind, from);
    onRouteChange('premium');
  };
  const returnFromPremium = () => onRouteChange(readPremiumIntent()?.returnTo || 'landing');
  const openAfterPayment = () => {
    const next = getPremiumSuccessRoute(readPremiumIntent(), isParentAccount);
    clearPremiumIntent();
    onRouteChange(next);
  };
  const openDictionaryFromGameArea = () => onRouteChange(isParentAccount ? 'adult_room' : 'dictionary_studio');
  const setupError = classicGame.setupError || dictionaryUpload.error;
  const hasActiveClassicGame = Boolean(classicGame.hasActiveGame);
  const hasActiveAnagramGame = isAuthenticated && hasSavedAnagramSession(userProfile.username);
  const premiumMeta = isParentAccount ? getKidsDictionaryMeta(settings.activePremiumDictionaryId) : getPremiumDictionaryMeta(settings.activePremiumDictionaryId);
  const activeDictionaryName = settings.dictionarySource === 'custom' || settings.useCustomDictionary ? 'Слова из вашего списка' : settings.dictionarySource === 'premium' ? premiumMeta.title : isParentAccount ? 'Детский словарь' : 'General English';
  const activeDictionaryIcon = settings.dictionarySource === 'custom' || settings.useCustomDictionary ? '📖' : settings.dictionarySource === 'premium' ? premiumMeta.icon : isParentAccount ? '🌈' : '📚';
  const setupQuestContext = dailyQuest && getDailyQuestTargetModes(dailyQuest).includes(selectedPlayMode) ? dailyQuest : null;

  const openSetupFor = (mode: PlayableModeRoute) => {
    if (isTeacher) return;
    if (mode === 'anagrams' && hasActiveAnagramGame) { onSelectedPlayModeChange(mode); onRouteChange('anagrams'); return; }
    onSelectedPlayModeChange(mode);
    onRouteChange('setup');
  };
  const startSelectedMode = () => {
    onGameStarted?.(selectedPlayMode);
    if (selectedPlayMode === 'game') { classicGame.startNewGame(); return; }
    onRouteChange(selectedPlayMode);
  };
  const startDailyQuest = (quest: DailyQuestState) => {
    const mode = getDailyQuestPrimaryMode(quest);
    onSelectedPlayModeChange(mode);
    onSettingsChange(previous => ({ ...previous, wordLength: randomWordLength() }));
    onRouteChange('setup');
  };

  const gameProps = { words: modeWords, wordLength: settings.wordLength, dictionaryLabel: activeDictionaryName, dictionaryIcon: activeDictionaryIcon, rulesViewerKey, userProfile, onGameReward, onWordPractice, onBackHome: goHome, onDictionaryPeek };
  const landingMix = <LandingMixScreen entryPath={entryPath} onLogin={onOpenLogin} onStartPractice={() => startRegisterFor('practice')} onStartKids={() => startRegisterFor('kids')} onStartTeacher={() => startRegisterFor('teacher')} />;
  const accountModeSetup = <AccountModeSetupScreen onSelectMode={onSelectAccountMode} />;
  const practiceHome = <PracticeHomeScreen userProfile={userProfile} dailyQuest={dailyQuest} dailyQuestReward={dailyQuestReward} onCloseDailyQuestReward={onCloseDailyQuestReward} onStartDailyQuest={startDailyQuest} hasActiveClassicGame={hasActiveClassicGame} hasActiveAnagramGame={hasActiveAnagramGame} activeDictionaryName={activeDictionaryName} onStartClassic={() => openSetupFor('game')} onStartAnagrams={() => openSetupFor('anagrams')} onStartTranslation={() => openSetupFor('translation')} onStartSprint={() => openSetupFor('sprint')} onStartHangman={() => openSetupFor('hangman')} onStartMemory={() => openSetupFor('memory')} onStartLetterSquare={() => openSetupFor('letter_square')} onOpenProfile={() => onRouteChange('profile')} onOpenDictionaryStudio={() => onRouteChange('dictionary_settings')} onOpenPremium={() => openPremiumFrom('landing')} />;
  const kidsHome = <KidsHomeScreen userProfile={userProfile} dailyQuest={dailyQuest} dailyQuestReward={dailyQuestReward} onCloseDailyQuestReward={onCloseDailyQuestReward} onStartDailyQuest={startDailyQuest} hasActiveClassicGame={hasActiveClassicGame} hasActiveAnagramGame={hasActiveAnagramGame} onStartClassic={() => openSetupFor('game')} onStartAnagrams={() => openSetupFor('anagrams')} onStartTranslation={() => openSetupFor('translation')} onStartSprint={() => openSetupFor('sprint')} onStartHangman={() => openSetupFor('hangman')} onStartMemory={() => openSetupFor('memory')} onStartLetterSquare={() => openSetupFor('letter_square')} onOpenShop={() => onRouteChange('shop')} onOpenProfile={() => onRouteChange('profile')} onOpenPetRoom={() => onRouteChange('pet_room')} onOpenAdultRoom={() => onRouteChange('adult_room')} onOpenPremium={() => openPremiumFrom('landing')} />;
  const teacherHome = <TeacherDashboardScreen userProfile={userProfile} onOpenDictionaryStudio={() => onRouteChange('dictionary_studio')} onOpenAdultRoom={() => onRouteChange('adult_room')} onOpenProfile={() => onRouteChange('profile')} />;
  const roleHomeScreen = isTeacher ? teacherHome : isParentAccount ? kidsHome : practiceHome;
  const homeScreen = isAuthenticated ? (hasChosenAccountMode ? roleHomeScreen : accountModeSetup) : landingMix;
  const letterSquareRules = ['Соединяйте соседние буквы, чтобы собрать слово змейкой.', 'Диагонали запрещены: только вверх, вниз, влево и вправо.', 'Ошибочные слова попадают в повторение.'];

  const screens: Partial<Record<ViewState, React.ReactNode>> = {
    admin: <AdminControlCenterScreen userProfile={userProfile} onBackHome={goHome} />,
    adult_room: <AdultRoomScreen userProfile={userProfile} onBackHome={goHome} onOpenDictionaryStudio={() => onRouteChange(isParentAccount ? 'dictionary_settings' : 'dictionary_studio')} />,
    dictionary_settings: <DictionarySettingsScreen settings={settings} userProfile={userProfile} customDictionaryWords={ownWords} isAuthenticated={isAuthenticated} onSettingsChange={onSettingsChange} onOpenDictionaryStudio={() => onRouteChange('dictionary_studio')} onOpenPremium={() => openPremiumFrom('dictionary_settings', 'dictionary_settings')} onBack={goHome} />,
    dictionary_studio: <DictionaryStudioScreen userProfile={userProfile} onBack={() => onRouteChange(isParentAccount || isTeacher ? 'adult_room' : 'dictionary_settings')} onSaveDictionary={onSaveDictionary} />,
    premium: <PremiumScreen userProfile={userProfile} onBack={returnFromPremium} onOpenDictionarySetup={() => onRouteChange('dictionary_settings')} onTestUnlockPremium={onTestUnlockPremium || (() => undefined)} />,
    premium_success: <PremiumSuccessScreen userProfile={userProfile} onPrimaryAction={openAfterPayment} onBackHome={goHome} />,
    account_mode_setup: hasChosenAccountMode ? homeScreen : accountModeSetup,
    family_setup: <FamilySetupScreen onCreateChild={onCreateChild} onComplete={onChildSetupComplete} onBackHome={goHome} />,
    character_onboarding: isParentAccount ? <CharacterOnboardingScreen onComplete={onCharacterOnboardingComplete} onOpenPremium={() => openPremiumFrom('character_onboarding', 'character_onboarding')} /> : homeScreen,
    landing: homeScreen,
    setup: <SetupScreen selectedPlayMode={selectedPlayMode} settings={settings} customDictionaryWords={ownWords} setupError={setupError} isUploadingDictionary={dictionaryUpload.isUploadingDictionary} isAuthenticated={isAuthenticated} userProfile={userProfile} questContext={setupQuestContext} hasActiveClassicGame={hasActiveClassicGame} onResumeClassicGame={classicGame.resumeGame} onSettingsChange={onSettingsChange} onFileUpload={dictionaryUpload.onFileUpload} onOpenDictionaryStudio={openDictionaryFromGameArea} onOpenPremium={() => openPremiumFrom('setup', 'game_setup')} onStartGame={startSelectedMode} onBack={goHome} onLogin={onOpenLogin} />,
    game: <ClassicGameScreen gameState={classicGame.gameState} settings={settings} userProfile={userProfile} isAuthenticated={isAuthenticated} rulesViewerKey={rulesViewerKey} keyStatuses={classicGame.keyStatuses} shakeRowIndex={classicGame.shakeRowIndex} dictionaryWords={modeWords} dictionaryLabel={activeDictionaryName} dictionaryIcon={activeDictionaryIcon} onChar={classicGame.handleChar} onDelete={classicGame.handleDelete} onEnter={classicGame.handleEnter} onHint={classicGame.fetchHint} onRestart={classicGame.startNewGame} onBackHome={goHome} onRegister={onOpenRegister} onDictionaryPeek={onDictionaryPeek} />,
    profile: <ProfileScreen userProfile={userProfile} isAuthenticated={isAuthenticated} activeDictionaryName={activeDictionaryName} onBackHome={goHome} onOpenShop={() => isParentAccount ? onRouteChange('shop') : onRouteChange('landing')} onOpenPetRoom={() => isParentAccount ? onRouteChange('pet_room') : onRouteChange('landing')} onLogin={onOpenLogin} />,
    anagrams: <AnagramsScreen {...gameProps} />,
    translation: <TranslationChoiceScreen {...gameProps} />,
    sprint: <SprintScreen {...gameProps} />,
    memory: <MemoryScreen {...gameProps} />,
    hangman: <HangmanScreen {...gameProps} />,
    letter_square: <GameModeShell gameId="letter_square" viewerKey={rulesViewerKey} title="Змейка" subtitle="Соединяй буквы цепочкой" rules={letterSquareRules} showDictionary={false} onBackHome={goHome}><LetterSquareGameV3 userProfile={{ ...userProfile, customDictionaryEn: modeWords }} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={goHome} /></GameModeShell>,
    shop: isParentAccount ? <Shop userProfile={userProfile} onBuy={onBuy} onClose={goHome} onOpenPetRoom={() => onRouteChange('pet_room')} /> : homeScreen,
    pet_room: isParentAccount ? <PetRoom userProfile={userProfile} onUseItem={onUseItem} onBuy={onBuy} onUpdatePet={onUpdatePet} onClose={goHome} onOpenShop={() => onRouteChange('shop')} /> : homeScreen,
  };

  return <React.Suspense fallback={<ScreenLoading />}><AppRouter route={route} screens={screens} fallback={screens.landing} /></React.Suspense>;
};
