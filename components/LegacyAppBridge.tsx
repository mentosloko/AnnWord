import { useEffect } from 'react';
import { UserProfile } from '../types';
import { useAuthSession } from '../providers/AuthProvider';
import { useAppNavigation, NAVIGATION_EVENT } from '../providers/NavigationProvider';
import { useUserProfile } from '../providers/ProfileProvider';

interface LegacyAppBridgeProps {
  view: string;
  setView: (view: any) => void;
  userProfile: UserProfile;
  setUserProfile: (profile: UserProfile | ((profile: UserProfile) => UserProfile)) => void;
  currentUser: any;
  setCurrentUser: (user: any) => void;
}

export const LegacyAppBridge: React.FC<LegacyAppBridgeProps> = ({
  view,
  setView,
  userProfile,
  setUserProfile,
  currentUser,
  setCurrentUser,
}) => {
  const auth = useAuthSession();
  const profile = useUserProfile();
  const navigation = useAppNavigation();

  useEffect(() => {
    if (auth.isReady && auth.user && auth.user?.id !== currentUser?.id) {
      setCurrentUser(auth.user as any);
    }
    if (auth.isReady && !auth.user && currentUser) {
      setCurrentUser(null);
    }
  }, [auth.isReady, auth.user, currentUser, setCurrentUser]);

  useEffect(() => {
    if (profile.profile.username !== userProfile.username || profile.profile.coins !== userProfile.coins) {
      setUserProfile(profile.profile);
    }
  }, [profile.profile, userProfile.username, userProfile.coins, setUserProfile]);

  useEffect(() => {
    if (navigation.route !== view) {
      setView(navigation.route as any);
    }
  }, [navigation.route, view, setView]);

  useEffect(() => {
    const handleLegacyRoute = (event: Event) => {
      const route = (event as CustomEvent<{ route?: string }>).detail?.route;
      if (route) setView(route as any);
    };
    window.addEventListener(NAVIGATION_EVENT, handleLegacyRoute);
    return () => window.removeEventListener(NAVIGATION_EVENT, handleLegacyRoute);
  }, [setView]);

  return null;
};
