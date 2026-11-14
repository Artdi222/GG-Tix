import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ALL_CITIES = 'Semua Kota';
const KEY = '@ggtix_home_city';

interface CityState {
  city: string;
  pickerOpen: boolean;
  setCity(city: string): void;
  openPicker(open: boolean): void;
  hydrate(): Promise<void>;
}

/** One city choice shared by every screen's city bar, remembered across launches. */
export const useCityStore = create<CityState>((set) => ({
  city: ALL_CITIES,
  pickerOpen: false,
  setCity: (city) => {
    set({ city, pickerOpen: false });
    AsyncStorage.setItem(KEY, city).catch(() => {});
  },
  openPicker: (pickerOpen) => set({ pickerOpen }),
  hydrate: async () => {
    try {
      const saved = await AsyncStorage.getItem(KEY);
      if (saved) set({ city: saved });
    } catch { /* storage unavailable: keep the default */ }
  },
}));
