import type { PetState, UserProfile, UserStats } from "../types";
import { backendApiRequest } from "./backendApiClient";
import { assignedWordsService } from "./assignedWordsService";

const withAssignedWords = async (profile: UserProfile): Promise<UserProfile> => {
  try {
    const result = await assignedWordsService.loadAssignedWords();
    return result.words.length ? { ...profile, assignedWords: result.words } : profile;
  } catch (error) {
    console.warn("Could not hydrate assigned words", error);
    return profile;
  }
};

const readProfile = async (request: Promise<{ profile: UserProfile }>): Promise<UserProfile> => withAssignedWords((await request).profile);

export const profileApiService = {
  async getCurrentProfile(): Promise<UserProfile> {
    return readProfile(backendApiRequest<{ profile: UserProfile }>("/api/profile/me"));
  },

  async updateUserDictionary(words: string[]): Promise<UserProfile> {
    return readProfile(backendApiRequest<{ profile: UserProfile }>("/api/profile/dictionary", { method: "PATCH", body: { words } }));
  },

  async updateWeeklyReportEmail(email: string): Promise<UserProfile> {
    return readProfile(backendApiRequest<{ profile: UserProfile }>("/api/profile/weekly-report-email", { method: "PATCH", body: { email } }));
  },

  async syncProfileState(profile: Pick<UserProfile, "inventory" | "pet" | "coins">): Promise<UserProfile> {
    return readProfile(backendApiRequest<{ profile: UserProfile }>("/api/profile/sync-state", { method: "POST", body: profile }));
  },

  async applyGameResult(stats: UserStats, pet: PetState, coinsDelta: number): Promise<UserProfile> {
    return readProfile(backendApiRequest<{ profile: UserProfile }>("/api/profile/game-result", { method: "POST", body: { stats, pet, coinsDelta } }));
  },
};
