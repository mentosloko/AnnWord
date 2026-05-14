import { AuthModal } from '../components/auth/AuthModal';
import { RulesModal } from '../components/modals/RulesModal';
import { AppHeader } from '../components/layout/AppHeader';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { LandingScreen } from '../components/screens/LandingScreen';
import { SetupScreen } from '../components/screens/SetupScreen';
import { ClassicGameScreen } from '../components/screens/ClassicGameScreen';
import { ProfileScreen } from '../components/screens/ProfileScreen';
import { GameModeShell } from '../components/screens/GameModeShell';
import { AnagramsScreen, HangmanScreen, MemoryScreen, SprintScreen } from '../components/screens/ModeScreens';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`Screen components smoke test failed: ${message}`);
};

const components = {
  AuthModal,
  RulesModal,
  AppHeader,
  ScreenContainer,
  LandingScreen,
  SetupScreen,
  ClassicGameScreen,
  ProfileScreen,
  GameModeShell,
  AnagramsScreen,
  SprintScreen,
  MemoryScreen,
  HangmanScreen,
};

for (const [name, component] of Object.entries(components)) {
  assert(typeof component === 'function', `${name} must be a React function component`);
}

console.log(JSON.stringify({ ok: true, checked: 'screen-components', count: Object.keys(components).length }, null, 2));
