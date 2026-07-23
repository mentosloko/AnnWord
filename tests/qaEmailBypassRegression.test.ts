import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const route = readFileSync('server/routes/pendingEmailSessionRoutes.ts', 'utf8');

describe('QA email confirmation bypass', () => {
  it('creates confirmed sessions only for the dedicated QA domain', () => {
    expect(route).toContain("const QA_EMAIL_DOMAIN = '@qa.annword.ru'");
    expect(route).toContain("pendingEmailSessionRouter.post('/email/account'");
    expect(route).toContain('if (!isQaEmailAddress(rawEmail))');
    expect(route).toContain('next();');
    expect(route).toContain("email_confirmed_at)\n         values ($1, $2, $3, $4, 'email', now())");
    expect(route).toContain('createProfileForUser(client, id, input.name)');
    expect(route).toContain('writeSessionCookie(res, token)');
    expect(route).toContain('qaEmailConfirmationBypassed: true');
  });

  it('does not depend on an environment flag', () => {
    expect(route).not.toContain('process.env');
    expect(route).not.toContain('QA_EMAIL_CONFIRMATION_BYPASS_ENABLED');
  });

  it('keeps legal consents and cleans stale pending registrations', () => {
    expect(route).toContain('termsAccepted !== true');
    expect(route).toContain('personalDataAccepted !== true');
    expect(route).toContain("delete from pending_email_registrations where email = $1");
    expect(route).toContain("'qa_email_bypass'");
  });
});
