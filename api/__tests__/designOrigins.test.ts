import { afterEach, describe, expect, it, vi } from 'vitest';

const verifyToken = vi.hoisted(() => vi.fn(async () => ({ sub: 'user-own-id' })));
vi.mock('@clerk/backend', () => ({ verifyToken }));

import {
  allowedDesignOrigin,
  designOrigins,
  DEFAULT_DESIGN_ORIGINS,
  resolveDesignRequest,
} from '../_lib/designAssistant';
import { handleDesignMcp } from '../_lib/designMcp';
import type { MinRes } from '../_lib/sentry';

/** Production runtime with no preview host and no override. */
function productionEnv(origins = '') {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('VERCEL_URL', '');
  vi.stubEnv('VERCEL_BRANCH_URL', '');
  vi.stubEnv('DESIGN_ALLOWED_ORIGINS', origins);
}
afterEach(() => {
  vi.unstubAllEnvs();
  verifyToken.mockClear();
});

describe('design origins for both production hosts', () => {
  it('accepts designer.ppwellness.co and onelivebuild.com by default, nothing that resembles them', () => {
    productionEnv();
    expect(designOrigins()).toEqual([...DEFAULT_DESIGN_ORIGINS]);
    expect(allowedDesignOrigin('https://designer.ppwellness.co')).toBe(true);
    expect(allowedDesignOrigin('https://onelivebuild.com')).toBe(true);
    for (const origin of [
      'http://onelivebuild.com',
      'https://www.onelivebuild.com',
      'https://onelivebuild.com.evil.test',
      'https://evilonelivebuild.com',
      'http://127.0.0.1:5173',
    ])
      expect(allowedDesignOrigin(origin)).toBe(false);
  });

  it('lets DESIGN_ALLOWED_ORIGINS replace the defaults, normalising case and trailing slashes', () => {
    productionEnv(
      ' https://Designer.PPWellness.co/ , https://onelivebuild.com,https://staging.example.com ',
    );
    expect(designOrigins()).toEqual([
      'https://designer.ppwellness.co',
      'https://onelivebuild.com',
      'https://staging.example.com',
    ]);
    productionEnv('https://designer.ppwellness.co');
    expect(allowedDesignOrigin('https://designer.ppwellness.co')).toBe(true);
    expect(allowedDesignOrigin('https://onelivebuild.com')).toBe(false);
  });

  it('ignores entries that are not a bare origin and falls back to the defaults when none remain', () => {
    productionEnv('onelivebuild.com, https://evil.test/path, *, javascript:alert(1)');
    expect(designOrigins()).toEqual([...DEFAULT_DESIGN_ORIGINS]);
  });

  it('keeps the deployment, branch and local development origins', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL_URL', 'ppw-designer-2d-abc123-team.vercel.app');
    vi.stubEnv('VERCEL_BRANCH_URL', 'ppw-designer-2d-git-feature-team.vercel.app');
    vi.stubEnv('DESIGN_ALLOWED_ORIGINS', '');
    expect(designOrigins()).toEqual([
      ...DEFAULT_DESIGN_ORIGINS,
      'https://ppw-designer-2d-abc123-team.vercel.app',
      'https://ppw-designer-2d-git-feature-team.vercel.app',
      'http://127.0.0.1:5173',
      'http://localhost:5173',
    ]);
  });
});

describe('both hosts reach the assistant and MCP', () => {
  it('passes the same origins to the sign-in check as authorized parties', async () => {
    productionEnv();
    vi.stubEnv('CLERK_SECRET_KEY', 'secret-auth');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const result = await resolveDesignRequest(
      { mode: 'ai', brief: {} },
      { method: 'POST', headers: { authorization: 'Bearer token-from-onelivebuild' } },
    );
    expect(verifyToken).toHaveBeenCalledWith('token-from-onelivebuild', {
      secretKey: 'secret-auth',
      authorizedParties: ['https://designer.ppwellness.co', 'https://onelivebuild.com'],
    });
    // Signed in, but hosted AI is not configured here: no provider call is made.
    expect(result.status).toBe(503);
  });

  it('answers an MCP preflight from onelivebuild.com with that origin allowed', async () => {
    productionEnv();
    const preflight = async (origin: string) => {
      const state = { status: 0, headers: {} as Record<string, string> };
      const res: MinRes = {
        setHeader(k, v) {
          state.headers[k] = String(v);
        },
        status(s) {
          state.status = s;
          return res;
        },
        end() {},
        json() {},
      };
      await handleDesignMcp({ method: 'OPTIONS', headers: { origin } }, res);
      return state;
    };
    const allowed = await preflight('https://onelivebuild.com');
    expect(allowed.status).toBe(204);
    expect(allowed.headers['Access-Control-Allow-Origin']).toBe('https://onelivebuild.com');
    expect((await preflight('https://www.onelivebuild.com')).status).toBe(403);
  });
});
