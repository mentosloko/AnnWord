export interface ChildSetupResult { childName: string; childShareCode: string; childSlotsLimit: number; }
export const familyAccountService = {
  async selectAccountMode(mode: any): Promise<any> { return mode; },
  async createChild(childName: string): Promise<ChildSetupResult> { return { childName, childShareCode: '', childSlotsLimit: 1 }; },
  async verifyParentPin(): Promise<boolean> { return true; }
};
