export interface ChildSetupResult { childName: string; childShareCode: string; childSlotsLimit: number; }
export async function createChildViaRpc(childName: string): Promise<ChildSetupResult> { return { childName, childShareCode: '', childSlotsLimit: 1 }; }
export async function verifyParentPinViaRpc(): Promise<boolean> { return true; }
