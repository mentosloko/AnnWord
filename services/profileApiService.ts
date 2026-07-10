import type { PetState, UserProfile, UserStats } from "../types";
import { backendApiRequest } from "./backendApiClient";

const readProfile = async (request: Promise<{ profile: UserProfile }>): Promise<UserProfile> => (await request).profile;

export const profileApiService = {
  async getCurrentProfile(): Promise<UserProfile> {
    return readProfile(backendApiRequest<{ profile: UserProfile }>("/api/profile/me"));
  },

  async updateUserDictionary(words: string[]): Promise<UserProfile> {
    return readProfile(backendApiRequest<{ profile: UserProfile }>("/api/profile/dictionary", { method: "PATCH", body: { words } }));
  },

  async updateStats(stats: UserStats): Promise<UserProfile> {
    return readProfile(backendApiRequest<{ profile: UserProfile }>("/api/profile/stats", { method: "PATCH", body: { stats } }));
  },

  async updatePet(pet: PetState): Promise<UserProfile> {
    return readProfile(backendApiRequest<{ profile: UserProfile }>("/api/profile/pet", { method: "PATCH", body: { pet } }));
  },

  async incrementCoins(amount: number): Promise<UserProfile> {
    return readProfile(backendApiRequest<{ profile: UserProfile }>("/api/profile/coins", { method: "POST", body: { amount } }));
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