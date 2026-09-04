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

  it('restores the previous gateway specification if live verification fails', () => {
    expect(workflow).toContain('restore_on_failure');
    expect(workflow).toContain('/tmp/gateway-before.yaml');
    expect(workflow).toContain('restoring the previous API Gateway specification');
  });
});
