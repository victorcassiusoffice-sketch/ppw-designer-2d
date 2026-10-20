import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const BUILD_SKINS = ['natural', 'gallery', 'blueprint'] as const;
export type BuildSkin = typeof BUILD_SKINS[number];
export const useBuildSkinStore = create<{ skin: BuildSkin; setSkin: (skin: BuildSkin) => void }>()(persist(
  set => ({ skin: 'natural', setSkin: skin => { if (BUILD_SKINS.includes(skin)) set({ skin }); } }),
  { name: 'olb.build-skin.v1', partialize: state => ({ skin: state.skin }),
    merge: (persisted, current) => { const skin = (persisted as { skin?: BuildSkin } | null)?.skin;
      return { ...current, skin: skin && BUILD_SKINS.includes(skin) ? skin : 'natural' }; } },
));

/** Presentation only: no product finish, object dimension or lighting value. */
export const BUILD_SKIN_PALETTES = {
  natural: { ground: '#E7E2D8', site: '#EFEAE0', boundary: '#A29C8F', ink: '#636054', grid: '#8C8577', sky: '#a9bbb4', horizon: '#c0cec8' },
  gallery: { ground: '#dddeda', site: '#eceee9', boundary: '#8c9691', ink: '#3e514a', grid: '#9fa8a1', sky: '#d4dcd8', horizon: '#edf0e9' },
  blueprint: { ground: '#14303b', site: '#1e424c', boundary: '#c7a16a', ink: '#d4e1d6', grid: '#65898b', sky: '#1c3741', horizon: '#526c70' },
} as const;
