import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/yandex-gateway-hardening.yml', 'utf8');

describe('Yandex API Gateway CORS hardening workflow', () => {
  it('runs on main and does not create additional Yandex resources', () => {
    expect(workflow).toContain('      - main');
    expect(workflow).toContain('api-gateway get-spec');
    expect(workflow).toContain('api-gateway update');
    expect(workflow).not.toContain('api-gateway create');
    expect(workflow).not.toContain('container revision deploy');
  });

  it('delegates CORS to the backend and rejects foreign origins', () => {
    expect(workflow).toContain("gateway['cors'] = {'origin': False}");
    expect(workflow).toContain("path_item['x-yc-apigateway-cors'] = {'origin': False}");
    expect(workflow).toContain('https://untrusted.example');
    expect(workflow).toContain('access-control-allow-origin');
    expect(workflow).toContain('access-control-max-age');
  });

  it('adds an explicit OPTIONS bridge to the existing proxy integration', () => {
    expect(workflow).toContain('from copy import deepcopy');
    expect(workflow).toContain("any_method = path_item.get('x-yc-apigateway-any-method')");
    expect(workflow).toContain('options = deepcopy(any_method)');
    expect(workflow).toContain("options.pop('operationId', None)");
    expect(workflow).toContain("options['operationId'] = f'annwordCorsPreflight{index}'");
    expect(workflow).toContain("path_item['options'] = options");
    expect(workflow).toContain('No x-yc-apigateway-any-method proxy route found');
  });

  it('prints live preflight diagnostics and restores the previous spec on failure', () => {
    expect(workflow).toContain('Trusted preflight after gateway hardening:');
    expect(workflow).toContain('Foreign preflight after gateway hardening:');
    expect(workflow).toContain('restore_on_failure');
    expect(workflow).toContain('/tmp/gateway-before.yaml');
    expect(workflow).toContain('restoring the previous API Gateway specification');
  });
});
