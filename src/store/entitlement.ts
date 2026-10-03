import { create } from 'zustand';
import { useSettings } from './settings';

type EntitlementStore = {
  /** Pro according to RevenueCat. */
  storePro: boolean;
  managementUrl: string | null;
  expiresAt: string | null;
  planId: string | null;
  setStore: (patch: Partial<Pick<EntitlementStore, 'storePro' | 'managementUrl' | 'expiresAt' | 'planId'>>) => void;
};

export const useEntitlement = create<EntitlementStore>((set) => ({
  storePro: false, managementUrl: null, expiresAt: null, planId: null,
  setStore: (patch) => set(patch),
}));

/** True when the user has Pro (or the dev-only demo switch is on in a development build). */
export function useIsPro() {
  const storePro = useEntitlement((s) => s.storePro);
  const demoPro = useSettings((s) => s.demoPro);
  return storePro || (__DEV__ && demoPro);
}
export const getIsPro = () => useEntitlement.getState().storePro || (__DEV__ && useSettings.getState().demoPro);
