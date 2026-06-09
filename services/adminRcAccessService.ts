export interface AdminRcProfile { id: string; username: string; role: any; subscriptionTier: any; featureFlags: any; }
export const RC_FEATURE_LABELS: any[] = [];
async function listProfiles(): Promise<AdminRcProfile[]> { return []; }
async function setAccess(): Promise<void> { return; }
async function linkLearner(): Promise<void> { return; }
export const adminRcAccessService = { listProfiles, setAccess, linkLearner };
