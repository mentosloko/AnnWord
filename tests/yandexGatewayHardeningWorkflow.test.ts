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

  it('pins preflight responses to the AnnWord origin instead of wildcard CORS', () => {
    expect(workflow).toContain("'origin': 'https://annword.ru'");
    expect(workflow).toContain("'allowedHeaders': ['content-type', 'x-annword-session']");
    expect(workflow).toContain("'credentials': True");
    expect(workflow).toContain("'maxAge': 3600");
    expect(workflow).toContain("'optionsSuccessStatus': 204");
    expect(workflow).toContain("path_item['x-yc-apigateway-cors'] = deepcopy(cors_rule)");
    expect(workflow).toContain("foreign_origin" );
    expect(workflow).toContain("[ \"$foreign_origin\" = '*' ]");
    expect(workflow).toContain('https://untrusted.example');
  });

  it('removes only the AnnWord experimental OPTIONS bridge and keeps proxy routing intact', () => {
    expect(workflow).toContain("operation_id.startswith('annwordCorsPreflight')");
    expect(workflow).toContain("del path_item['options']");
    expect(workflow).toContain("any_method = path_item.get('x-yc-apigateway-any-method')");
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
