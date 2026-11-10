import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ read: vi.fn(), sentry: vi.fn(() => ({ name: 'sentry-test' })) }));
vi.mock('node:fs/promises', () => ({ readdir: mocked.read }));
vi.mock('@sentry/vite-plugin', () => ({ sentryVitePlugin: mocked.sentry }));

interface BuildConfig {
  build?: { sourcemap?: boolean | 'hidden' };
  plugins?: unknown[];
}

async function loadConfig(mode: string): Promise<BuildConfig> {
  // vite.config belongs to the separate tsconfig.node composite project.
  // Vitest loads its source at runtime without requiring emitted .d.ts files.
  const configPath = '../../../vite.config';
  const factory = (await import(configPath)).default as (env: { mode: string; command: 'build' }) => BuildConfig;
  return factory({mode, command:'build'});
}

const modes = [
  ['production', './dist/'],
  ['olb-plumbing', './dist/assets/plumbing/'],
  ['olb-studio', './dist/assets/studio/'],
] as const;

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

  it.each(modes)('generates no source maps without private Sentry upload configuration (%s)', async (mode) => {
    const config = await loadConfig(mode);
    expect(config.build?.sourcemap).toBe(false);
    expect(mocked.sentry).not.toHaveBeenCalled();
  });

  it.each(modes)('uses hidden maps for Sentry and removes the public copies after upload (%s)', async (mode, prefix) => {
    vi.stubEnv('SENTRY_AUTH_TOKEN', 'test-token');
    vi.stubEnv('SENTRY_ORG', 'test-org');
    vi.stubEnv('SENTRY_PROJECT', 'test-project');
    const config = await loadConfig(mode);
    expect(config.build?.sourcemap).toBe('hidden');
    expect(mocked.sentry).toHaveBeenCalledWith(expect.objectContaining({
      sourcemaps: { assets: [prefix + '**/*.{js,map}'], filesToDeleteAfterUpload: [prefix + '**/*.map'] },
    }));
  });

  it.each(modes)('refuses publication if upload cleanup leaves a map in any part of the build (%s)', async (mode) => {
    const config = await loadConfig(mode);
    const guard = config.plugins?.find(isMapGuard);
    expect(guard).toBeDefined();
    mocked.read.mockResolvedValue(['assets/main.js', 'assets/main.js.map']);
    await expect(guard!.closeBundle()).rejects.toThrow('refusing to publish');
    mocked.read.mockResolvedValue(['assets/main.js']);
    await expect(guard!.closeBundle()).resolves.toBeUndefined();
  });
});
