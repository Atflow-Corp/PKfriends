export const storage = {
  getJSON<T>(key: string, defaultValue: T | null = null): T | null {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return defaultValue;
      return JSON.parse(raw) as T;
    } catch (_err) {
      return defaultValue;
    }
  },
  setJSON<T>(key: string, value: T): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (_err) {
      // no-op
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch (_err) {
      // no-op
    }
  },
};

export const STORAGE_KEYS = {
  patients: "tdmfriends:patients",
  prescriptions: "tdmfriends:prescriptions",
  bloodTests: "tdmfriends:bloodTests",
  drugAdministrations: "tdmfriends:drugAdministrations",
  selectedPatientId: "tdmfriends:selectedPatientId",
  tdmResultPrefix: "tdmfriends:tdmResult:",
  tdmResultsPrefix: "tdmfriends:tdmResults:",
  tdmExtraSeriesPrefix: "tdmfriends:tdmExtraSeries:",
  selectedDrugPrefix: "tdmfriends:selectedDrug:",
  activeTdmPrefix: "tdmfriends:activeTdm:",
  userProfile: "tdmfriends:userProfile",
  inquiries: "tdmfriends:inquiries",
} as const;
