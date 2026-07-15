export const LEGAL_DOCUMENT_VERSIONS = {
  userAgreement: '2026-07-15',
  personalData: '2026-07-15',
  marketingEmail: '2026-07-15',
  childPersonalData: '2026-07-15',
} as const;

export interface RegistrationConsentInput {
  termsAccepted: boolean;
  personalDataAccepted: boolean;
  marketingEmailsAccepted: boolean;
}

export interface RegistrationConsentSnapshot extends RegistrationConsentInput {
  termsVersion: string;
  personalDataVersion: string;
  marketingVersion: string;
}

export interface ChildConsentSnapshot {
  legalRepresentativeConfirmed: boolean;
  childPersonalDataAccepted: boolean;
  childPersonalDataVersion: string;
}

let pendingRegistrationConsents: RegistrationConsentSnapshot | null = null;
let pendingChildConsent: ChildConsentSnapshot | null = null;

export const legalConsentService = {
  setRegistrationConsents(input: RegistrationConsentInput): void {
    pendingRegistrationConsents = {
      ...input,
      termsVersion: LEGAL_DOCUMENT_VERSIONS.userAgreement,
      personalDataVersion: LEGAL_DOCUMENT_VERSIONS.personalData,
      marketingVersion: LEGAL_DOCUMENT_VERSIONS.marketingEmail,
    };
  },

  consumeRegistrationConsents(): RegistrationConsentSnapshot | null {
    const snapshot = pendingRegistrationConsents;
    pendingRegistrationConsents = null;
    return snapshot;
  },

  setChildConsent(granted: boolean): void {
    pendingChildConsent = {
      legalRepresentativeConfirmed: granted,
      childPersonalDataAccepted: granted,
      childPersonalDataVersion: LEGAL_DOCUMENT_VERSIONS.childPersonalData,
    };
  },

  consumeChildConsent(): ChildConsentSnapshot | null {
    const snapshot = pendingChildConsent;
    pendingChildConsent = null;
    return snapshot;
  },
};

export default legalConsentService;
