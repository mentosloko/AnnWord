import React from 'react';
import { UserProfile } from '../../types';
import { AdminRcAccessPanel } from '../admin/AdminRcAccessPanel';
import { AdminAnalyticsScreen } from './AdminAnalyticsScreen';

interface Props {
  userProfile: UserProfile;
  onBackHome: () => void;
}

export const AdminControlCenterScreen: React.FC<Props> = ({ userProfile, onBackHome }) => {
  if (userProfile.role !== 'admin') {
    return <AdminAnalyticsScreen userProfile={userProfile} onBackHome={onBackHome} />;
  }

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6">
        <AdminRcAccessPanel />
      </div>
      <AdminAnalyticsScreen userProfile={userProfile} onBackHome={onBackHome} />
    </>
  );
};
