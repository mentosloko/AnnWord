export type ChildSetupResult = { childName: string; childShareCode: string; childSlotsLimit: number };
export const createChildViaRpc = (childName: string) => ({ childName, childShareCode: '', childSlotsLimit: 1 });
export const verifyParentPinViaRpc = () => true;
