import type { PetState, UserProfile, UserStats } from "../types";
import { backendApiRequest } from "./backendApiClient";

export const profileApiService = {
  async getCurrentProfile(): Promise<UserProfile> {
    return (await backendApiRequest<{ profile: UserProfile }>("/api/profile/me")).profile;
  },

  async updateUserDictionary(words: string[]): Promise<UserProfile> {
    return (await backendApiRequest<{ profile: UserProfile }>("/api/profile/dictionary", { method: "PATCH", body: { words } })).profile;
  },

  async updateWeeklyReportEmail(email: string): Promise<UserProfile> {
    return (await backendApiRequest<{ profile: UserProfile }>("/api/profile/weekly-report-email", { method: "PATCH", body: { email } })).profile;
  },

  async syncProfileState(profile: Pick<UserProfile, "inventory" | "pet" | "coins">): Promise<UserProfile> {
    return (await backendApiRequest<{ profile: UserProfile }>("/api/profile/sync-state", { method: "POST", body: profile })).profile;
  },

  async applyGameResult(stats: UserStats, pet: PetState, coinsDelta: number): Promise<UserProfile> {
    return (await backendApiRequest<{ profile: UserProfile }>("/api/profile/game-result", { method: "POST", body: { stats, pet, coinsDelta } })).profile;
  },
};
