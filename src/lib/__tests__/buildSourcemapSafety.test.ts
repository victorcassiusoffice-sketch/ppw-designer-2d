import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ read: vi.fn(), sentry: vi.fn(() => ({ name: 'sentry-test' })) }));
vi.mock('node:fs/promises', () => ({ readdir: mocked.read }));
vi.mock('@sentry/vite-plugin', () => ({ sentryVitePlugin: mocked.sentry }));

interface BuildConfig {
  build?: { sourcemap?: boolean | 'hidden' };
  plugins?: unknown[];
}

async function loadConfig(): Promise<BuildConfig> {
  // vite.config belongs to the separate tsconfig.node composite project.
  // Vitest loads its source at runtime without requiring emitted .d.ts files.
  const configPath = '../../../vite.config';
  return (await import(configPath)).default as BuildConfig;
}

function isMapGuard(plugin: unknown): plugin is { name: string; closeBundle: () => Promise<void> } {
  return !!plugin && typeof plugin === 'object' && 'name' in plugin && plugin.name === 'no-public-source-maps';
}

describe('public build source map policy', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('SENTRY_AUTH_TOKEN', '');
    vi.stubEnv('SENTRY_ORG', '');
    vi.stubEnv('SENTRY_PROJECT', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('generates no source maps without private Sentry upload configuration', async () => {
    const config = await loadConfig();
    expect(config.build?.sourcemap).toBe(false);
    expect(mocked.sentry).not.toHaveBeenCalled();
  });

  it('uses hidden maps for Sentry and removes the public copies after upload', async () => {
    vi.stubEnv('SENTRY_AUTH_TOKEN', 'test-token');
    vi.stubEnv('SENTRY_ORG', 'test-org');
    vi.stubEnv('SENTRY_PROJECT', 'test-project');
    const config = await loadConfig();
    expect(config.build?.sourcemap).toBe('hidden');
    expect(mocked.sentry).toHaveBeenCalledWith(expect.objectContaining({
      sourcemaps: { assets: ['./dist/**/*.{js,map}'], filesToDeleteAfterUpload: ['./dist/**/*.map'] },
    }));
  });

  it('refuses publication if upload cleanup leaves a map in the build', async () => {
    const config = await loadConfig();
    const guard = config.plugins?.find(isMapGuard);
    expect(guard).toBeDefined();
    mocked.read.mockResolvedValue(['assets/main.js', 'assets/main.js.map']);
    await expect(guard!.closeBundle()).rejects.toThrow('refusing to publish');
    mocked.read.mockResolvedValue(['assets/main.js']);
    await expect(guard!.closeBundle()).resolves.toBeUndefined();
  });
});
