import { useCallback, useState } from 'react';

export type RoomLighting = 'natural' | 'architectural';
export const ROOM_LIGHTING_STORAGE_KEY = 'ppw_room_lighting_v1';

function readLighting(): RoomLighting {
  try {
    return window.localStorage.getItem(ROOM_LIGHTING_STORAGE_KEY) === 'architectural' ? 'architectural' : 'natural';
  } catch {
    return 'natural';
  }
}

/** A viewing preference only: no property data, camera or material changes. */
export function useRoomLighting(): readonly [RoomLighting, (lighting: RoomLighting) => void] {
  const [lighting, setLighting] = useState<RoomLighting>(readLighting);
  const chooseLighting = useCallback((next: RoomLighting) => {
    setLighting(next);
    try { window.localStorage.setItem(ROOM_LIGHTING_STORAGE_KEY, next); } catch { /* Private browsing keeps the choice for this view. */ }
  }, []);
  return [lighting, chooseLighting] as const;
}
