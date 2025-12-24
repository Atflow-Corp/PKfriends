import {
  Patient,
  Prescription,
  BloodTest,
  DrugAdministration,
} from "@/pages/Index";

type RenalInfo = {
  id: string;
  creatinine: string;
  date: string;
  formula: string; // 'cockcroft-gault' | 'mdrd' | 'ckd-epi'
  result: string;
  dialysis: "Y" | "N";
  renalReplacement: string;
  isSelected: boolean;
};

const toDate = (d: string, t: string) => new Date(`${d}T${t}`);
const hoursDiff = (later: Date, earlier: Date) =>
  (later.getTime() - earlier.getTime()) / 36e5;

// 오래된 TDM 결과를 정리하는 함수
const clearOldTdmResults = (currentPatientId: string, aggressive: boolean = false) => {
  try {
    // 모든 localStorage 키 확인
    const keysToRemove: string[] = [];
    const currentPatientKeys: string[] = [];
    
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      
      // TDM 결과 관련 키만 확인
      if (key.startsWith('tdmfriends:tdmResult:') || key.startsWith('tdmfriends:tdmResults:')) {
        const isCurrentPatient = key.includes(currentPatientId);
        
        // 현재 환자의 데이터는 별도로 관리
        if (isCurrentPatient) {
          currentPatientKeys.push(key);
          // aggressive 모드에서는 현재 환자의 오래된 히스토리도 정리
          if (aggressive && key.startsWith('tdmfriends:tdmResults:')) {
            try {
              const value = window.localStorage.getItem(key);
              if (value) {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed) && parsed.length > 3) {
                  // 현재 환자의 히스토리가 3개 이상이면 오래된 것부터 삭제
                  parsed.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                  const keepCount = 2; // 최신 2개만 유지
                  parsed.splice(0, parsed.length - keepCount);
                  try {
                    window.localStorage.setItem(key, JSON.stringify(parsed));
                    console.log(`Cleared old history entries for current patient: ${key}`);
                  } catch {
                    // 저장 실패 시 전체 삭제 대상에 추가
                    keysToRemove.push(key);
                  }
                }
              }
            } catch {
              keysToRemove.push(key);
            }
          }
          continue;
        }
        
        // 다른 환자의 데이터는 오래된 것부터 삭제
        try {
          const value = window.localStorage.getItem(key);
          if (value) {
            const parsed = JSON.parse(value);
            let shouldRemove = false;
            
            // 히스토리 배열인 경우
            if (Array.isArray(parsed) && parsed.length > 0) {
              const oldestEntry = parsed[0];
              if (oldestEntry.timestamp) {
                const entryDate = new Date(oldestEntry.timestamp);
                const daysDiff = (Date.now() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
                // aggressive 모드에서는 7일 이상, 일반 모드에서는 30일 이상
                if (aggressive ? daysDiff > 7 : daysDiff > 30) {
                  shouldRemove = true;
                }
              } else {
                shouldRemove = true; // 타임스탬프가 없으면 삭제
              }
            }
            // 단일 결과인 경우 - 타임스탬프가 없으면 오래된 것으로 간주
            else if (!parsed.timestamp) {
              shouldRemove = true;
            }
            
            if (shouldRemove) {
              keysToRemove.push(key);
            }
          }
        } catch {
          // 파싱 실패한 경우 삭제 대상에 추가
          keysToRemove.push(key);
        }
      }
    }
    
    // 오래된 데이터 삭제 (aggressive 모드에서는 더 많이 삭제)
    const maxRemove = aggressive ? 50 : 10;
    const removeCount = Math.min(keysToRemove.length, maxRemove);
    for (let i = 0; i < removeCount; i++) {
      window.localStorage.removeItem(keysToRemove[i]);
    }
    
    if (removeCount > 0) {
      console.log(`Cleared ${removeCount} old TDM result entries (aggressive: ${aggressive})`);
    }
  } catch (error) {
    console.error("Error clearing old TDM results:", error);
  }
};

// 사용자가 수동으로 저장소를 정리하는 함수 (프로필 설정에서 사용)
export const clearStorage = (options?: {
  clearAll?: boolean; // 모든 데이터 삭제 (로그아웃 시 유용)
  clearTdmResults?: boolean; // TDM 결과만 삭제
  clearOldOnly?: boolean; // 오래된 데이터만 삭제 (30일 이상)
  currentPatientId?: string; // 현재 환자 ID (해당 환자 데이터 제외)
}): { cleared: number; totalSize: number } => {
  const { clearAll = false, clearTdmResults = false, clearOldOnly = false, currentPatientId } = options || {};
  
  let cleared = 0;
  let totalSize = 0;
  
  try {
    const keysToRemove: string[] = [];
    
    // 전체 크기 계산
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const value = window.localStorage.getItem(key);
      if (value) {
        totalSize += value.length;
      }
    }
    
    // 모든 데이터 삭제
    if (clearAll) {
      window.localStorage.clear();
      cleared = window.localStorage.length;
      return { cleared: 0, totalSize: 0 };
    }
    
    // TDM 결과만 삭제
    if (clearTdmResults) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key) continue;
        
        if (key.startsWith('tdmfriends:tdmResult:') || key.startsWith('tdmfriends:tdmResults:')) {
          // 현재 환자 데이터 제외 옵션
          if (currentPatientId && key.includes(currentPatientId)) {
            continue;
          }
          
          if (clearOldOnly) {
            // 오래된 데이터만 삭제 (30일 이상)
            try {
              const value = window.localStorage.getItem(key);
              if (value) {
                const parsed = JSON.parse(value);
                let shouldRemove = false;
                
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const oldestEntry = parsed[0];
                  if (oldestEntry.timestamp) {
                    const entryDate = new Date(oldestEntry.timestamp);
                    const daysDiff = (Date.now() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
                    if (daysDiff > 30) {
                      shouldRemove = true;
                    }
                  }
                } else if (!parsed.timestamp) {
                  shouldRemove = true;
                }
                
                if (shouldRemove) {
                  keysToRemove.push(key);
                }
              }
            } catch {
              // 파싱 실패한 경우 삭제
              keysToRemove.push(key);
            }
          } else {
            // 모든 TDM 결과 삭제
            keysToRemove.push(key);
          }
        }
      }
    }
    
    // 선택된 키 삭제
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
      cleared++;
    }
    
    return { cleared, totalSize };
  } catch (error) {
    console.error("Error clearing storage:", error);
    return { cleared, totalSize };
  }
};

const getSelectedRenalInfo = (
  selectedPatientId: string | null | undefined,
  drugName?: string
): RenalInfo | null => {
  try {
    if (!selectedPatientId) return null;
    // drugName이 있으면 포함, 없으면 이전 키 형식 사용 (하위 호환성)
    const key = drugName
      ? `tdmfriends:renal:${selectedPatientId}:${drugName}`
      : `tdmfriends:renal:${selectedPatientId}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const list = JSON.parse(raw) as RenalInfo[];
    const chosen =
      list.find((item) => item.isSelected) || list[list.length - 1];
    return chosen || null;
  } catch {
    return null;
  }
};

const mostellerBsa = (heightCm: number, weightKg: number): number => {
  if (!heightCm || !weightKg) return 1.73;
  return Math.sqrt((weightKg * heightCm) / 3600);
};

// Normalize model code per requirement: first letter lowercase, '-' -> '_'
const normalizeModelCode = (code: string): string => {
  if (!code) return code;
  const firstLower = code.charAt(0).toLowerCase() + code.slice(1);
  return firstLower.replace(/-/g, "_");
};

// Mapping table from drug/indication/(optional) additional info to model code
// Codes are taken from the provided spec image. We normalize on return.
const MODEL_CODE_TABLE = {
  Vancomycin: {
    "Not specified/Korean": {
      default: "Vancomycin1-1",
      CRRT: "Vancomycin1-2",
    },
    "Neurosurgical patients/Korean": {
      default: "Vancomycin2-1",
      within72h: "Vancomycin2-2", // within 72h of last dosing time
    },
  },
  Cyclosporin: {
    "Renal transplant recipients/Korean": {
      "POD ~2": "Cyclosporin1-1",
      "POD 3~6": "Cyclosporin1-2",
      "POD 7~": "Cyclosporin1-3",
      default: "Cyclosporin1-1",
    },
    "Allo-HSCT/Korean": "Cyclosporin2",
    "Thoracic transplant recipients/European": "Cyclosporin3",
  },
} as const;

const inferModelName = (args: {
  patientId: string;
  drugName?: string;
  indication?: string;
  additionalInfo?: string;
  lastDoseDate?: Date | undefined;
}): string | undefined => {
  const { patientId, drugName, indication, additionalInfo, lastDoseDate } =
    args;
  if (!drugName || !indication) return undefined;
  const table: unknown = (MODEL_CODE_TABLE as unknown)[drugName];
  if (!table) return undefined;

  // Detect CRRT from saved renal info (BloodTestStep에서 입력한 정보)
  const renal = getSelectedRenalInfo(patientId, drugName);
  const isCRRTFromRenal = /crrt/i.test(renal?.renalReplacement || "");
  
  // Detect CRRT from PrescriptionStep additionalInfo (PrescriptionStep에서 입력한 정보)
  const isCRRTFromPrescription = /crrt/i.test(additionalInfo || "");
  
  // 둘 중 하나라도 CRRT이면 CRRT로 간주
  const isCRRT = isCRRTFromRenal || isCRRTFromPrescription;

  // Compute within 72h from last dosing time
  const within72h = lastDoseDate
    ? (new Date().getTime() - lastDoseDate.getTime()) / 36e5 <= 72
    : false;

  const entry = table[indication];
  if (!entry) return undefined;

  // If entry is a string, return it
  if (typeof entry === "string") {
    return normalizeModelCode(entry);
  }

  // Vancomycin branches
  if (drugName === "Vancomycin") {
    // Not specified/Korean에서 기타 선택 시 에러
    if (indication === "Not specified/Korean" && additionalInfo === "기타") {
      throw new Error("CRRT 분석 모델만 지원됩니다.");
    }
    
    if (isCRRT && entry.CRRt) {
      // keep for robustness if case differs
      return normalizeModelCode(entry.CRRt);
    }
    if (isCRRT && entry.CRRT) {
      return normalizeModelCode(entry.CRRT);
    }
    if (within72h && entry.within72h) {
      return normalizeModelCode(entry.within72h);
    }
    // 투석 안 함 또는 CRRT가 아닌 경우 default (Vancomycin1-1) 사용
    return normalizeModelCode(entry.default);
  }

  // Cyclosporin(e) POD branches
  if (drugName === "Cyclosporin") {
    const podKey = additionalInfo?.trim();
    const podMapped = (podKey && entry[podKey]) || entry.default;
    return podMapped ? normalizeModelCode(podMapped) : undefined;
  }

  // Fallback if structure unknown
  return typeof entry.default === "string"
    ? normalizeModelCode(entry.default)
    : undefined;
};

export const computeRenalFunction = (
  selectedPatientId: string | null | undefined,
  weightKg: number,
  ageYears: number,
  sex01: number,
  heightCm: number,
  drugName?: string
): { crcl: number | undefined; egfr: number | undefined } => {
  const result = {
    crcl: undefined as number | undefined,
    egfr: undefined as number | undefined,
  };

  const renal = getSelectedRenalInfo(selectedPatientId, drugName);
  if (renal) {
    const resultStr = (renal.result || "").toString();

    // CRCL 또는 eGFR 파싱
    const match = resultStr.match(/(CRCL|eGFR)\s*=\s*([\d.]+)/i);
    if (match) {
      const type = match[1].toLowerCase() as "crcl" | "egfr";
      const value = parseFloat(match[2]);
      if (!Number.isNaN(value) && value > 0) {
        result[type] = value;
        return result;
      }
    }

    // 일반적인 숫자 파싱 (fallback) - CRCL로 간주
    const parsedResult = parseFloat(resultStr.replace(/[^0-9.-]/g, ""));
    if (!Number.isNaN(parsedResult) && parsedResult > 0) {
      result.crcl = parsedResult;
      return result;
    }

    const scrMgDl = parseFloat((renal.creatinine || "").toString());
    if (!Number.isNaN(scrMgDl) && scrMgDl > 0) {
      const isFemale = sex01 === 0;
      if (renal.formula === "cockcroft-gault") {
        const base = ((140 - ageYears) * weightKg) / (72 * scrMgDl);
        result.crcl = isFemale ? base * 0.85 : base;
        return result;
      }
      if (renal.formula === "mdrd") {
        const bsa = mostellerBsa(heightCm, weightKg);
        const eGFR =
          175 *
          Math.pow(scrMgDl, -1.154) *
          Math.pow(ageYears, -0.203) *
          (isFemale ? 0.742 : 1);
        result.egfr = eGFR * (bsa / 1.73);
        return result;
      }
      if (renal.formula === "ckd-epi") {
        const bsa = mostellerBsa(heightCm, weightKg);
        const k = isFemale ? 0.7 : 0.9;
        const a = isFemale ? -0.329 : -0.411;
        const minScrK = Math.min(scrMgDl / k, 1);
        const maxScrK = Math.max(scrMgDl / k, 1);
        const eGFR =
          141 *
          Math.pow(minScrK, a) *
          Math.pow(maxScrK, -1.209) *
          Math.pow(0.993, ageYears) *
          (isFemale ? 1.018 : 1);
        result.egfr = eGFR * (bsa / 1.73);
        return result;
      }
      // fallback - CRCL로 계산
      const base = ((140 - ageYears) * weightKg) / (72 * scrMgDl);
      result.crcl = isFemale ? base * 0.85 : base;
      return result;
    }
  }
  // 기본값
  result.crcl = 90;
  return result;
};

export const computeTauFromAdministrations = (
  events: DrugAdministration[]
): number | undefined => {
  if (!events || events.length < 2) return undefined;
  const sorted = [...events].sort(
    (a, b) =>
      toDate(a.date, a.time).getTime() - toDate(b.date, b.time).getTime()
  );
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const tauHours = hoursDiff(
    toDate(last.date, last.time),
    toDate(prev.date, prev.time)
  );
  // NaN이나 Infinity, 음수 체크하여 안전하게 처리
  if (!Number.isFinite(tauHours) || tauHours <= 0) return undefined;
  return tauHours;
};

export const parseTargetValue = (
  target?: string,
  value?: string
): { auc?: number; trough?: number } => {
  if (!value) return {};
  const nums = (value.match(/\d+\.?\d*/g) || []).map((v) => parseFloat(v));
  if (nums.length === 0) return {};
  const mid = nums.length === 1 ? nums[0] : (nums[0] + nums[1]) / 2;
  if (target && target.toLowerCase().includes("auc")) return { auc: mid };
  if (target && target.toLowerCase().includes("trough")) return { trough: mid };
  return {};
};

type ExtendedDrugAdministration = DrugAdministration & {
  isIVInfusion?: boolean;
  infusionTime?: number; // minutes
};

// 처방 내역 정보 타입
type PrescriptionInfo = {
  amount: number;
  tau: number;
  cmt: number;
  route: string;
  infusionTime?: number; // 주입시간 (분)
  timestamp: number;
};

// 처방 내역 저장
export const savePrescriptionInfo = (
  patientId: string,
  drugName: string,
  info: Omit<PrescriptionInfo, "timestamp">
) => {
  try {
    const key = `tdmfriends:prescription:${patientId}:${drugName}`;
    const data: PrescriptionInfo = {
      ...info,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save prescription info", e);
  }
};

// 처방 내역 불러오기
const getSavedPrescriptionInfo = (
  patientId: string,
  drugName: string
): PrescriptionInfo | null => {
  try {
    const key = `tdmfriends:prescription:${patientId}:${drugName}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as PrescriptionInfo;
  } catch {
    return null;
  }
};

const computeInfusionRateFromAdministration = (
  admin?: ExtendedDrugAdministration
): number => {
  if (!admin) return 0;
  const { isIVInfusion, infusionTime, dose } = admin;
  // 정맥 주사/수액 IV 통합: 정맥(IV)이고 infusionTime 지정 시 rate 계산, bolus는 0으로 간주
  if (isIVInfusion) {
    if (typeof infusionTime === "number") {
      if (infusionTime > 0) return dose / (infusionTime / 60); // mg per hour
      // bolus (infusionTime === 0)
      return 0;
    }
    // 명시되지 않은 경우도 주입시간 없음으로 간주
    return 0;
  }
  return 0;
};

export const buildTdmRequestBody = (args: {
  patients: Patient[];
  prescriptions: Prescription[];
  bloodTests: BloodTest[];
  drugAdministrations: DrugAdministration[];
  selectedPatientId: string;
  selectedDrugName?: string;
  overrides?: { amount?: number; tau?: number };
}) => {
  const {
    patients,
    prescriptions,
    bloodTests,
    drugAdministrations,
    selectedPatientId,
    selectedDrugName,
    overrides,
  } = args;
  const patient = patients.find((p) => p.id === selectedPatientId);
  const tdmPrescription =
    prescriptions.find(
      (p) =>
        p.patientId === selectedPatientId &&
        (selectedDrugName ? p.drugName === selectedDrugName : true)
    ) || prescriptions.find((p) => p.patientId === selectedPatientId);
  if (!patient || !tdmPrescription) return null;

  const weight = patient.weight;
  const age = patient.age;
  const sex = patient.gender === "male" ? 1 : 0;
  const height = patient.height;

  // 3단계(Lab)에서 저장된 신기능 값 사용 (CRCL 또는 eGFR)
  const renalFunction = computeRenalFunction(
    selectedPatientId,
    weight,
    age,
    sex,
    height,
    selectedDrugName
  );

  const patientDoses = (drugAdministrations || []).filter(
    (d) => {
      const matchesPatient = d.patientId === selectedPatientId;
      const matchesDrug = selectedDrugName 
        ? d.drugName === selectedDrugName 
        : true;
      return matchesPatient && matchesDrug;
    }
  );

  // 4단계에서 저장된 처방 내역 불러오기
  const savedPrescription = getSavedPrescriptionInfo(
    selectedPatientId,
    selectedDrugName || tdmPrescription.drugName
  );

  const lastDose =
    patientDoses.length > 0
      ? [...patientDoses].sort(
          (a, b) =>
            toDate(a.date, a.time).getTime() - toDate(b.date, b.time).getTime()
        )[patientDoses.length - 1]
      : undefined;

  // before 값: 저장된 처방 내역 사용
  const amountBefore =
    savedPrescription?.amount ?? (lastDose ? lastDose.dose : 100);
  
  // tauBefore 계산: 
  // 1) 저장된 처방 내역의 tau 우선
  // 2) 시계열 상 가장 최근 투약 기록의 intervalHours 사용
  // 3) 없으면 연속된 투약 기록 간의 간격 계산
  // 4) 그것도 없으면 기본값 12시간
  // NaN이나 Infinity가 나와도 안전하게 처리
  const rawTau =
    savedPrescription?.tau ??
    lastDose?.intervalHours ??
    computeTauFromAdministrations(patientDoses) ??
    12;
  
  const tauBefore = Number.isFinite(rawTau) && rawTau > 0 ? rawTau : 12;
  
  // CMT 계산: 저장된 처방 정보 사용, 없으면 기본값
  // Vancomycin의 경우 정맥 투약이 일반적이므로 기본값은 1
  let cmtBefore = savedPrescription?.cmt ?? 1;
  
  // Vancomycin 경구 선택 검증: 현재 사용 가능한 모델이 모두 정맥 투약 모델
  if (tdmPrescription.drugName === "Vancomycin") {
    const savedRoute = savedPrescription?.route?.toLowerCase() || "";
    const isSavedOral = savedRoute.includes("po") || 
                        savedRoute.includes("oral") || 
                        savedRoute.includes("경구");
    // 경구 선택 시 에러 발생
    if (isSavedOral) {
      throw new Error("반코마이신은 현재 정맥 투약 모델만 지원됩니다. 처방 정보에서 투약 경로를 정맥으로 변경해주세요.");
    }
  }
  
  // 디버깅: 저장된 처방 정보 로깅
  if (savedPrescription) {
    console.log(`[TDM API] Saved prescription - route: "${savedPrescription.route}", cmt: ${savedPrescription.cmt} -> ${cmtBefore}, amount: ${savedPrescription.amount}, tau: ${savedPrescription.tau}`);
  } else {
    console.log(`[TDM API] No saved prescription, using default cmt: ${cmtBefore}`);
  }

  // after 값: overrides가 있으면 사용, 없으면 before 값 사용
  const amountAfter = overrides?.amount ?? amountBefore;
  const tauAfter = overrides?.tau ?? tauBefore;
  const cmtAfter = cmtBefore; // CMT는 일반적으로 변경하지 않음

  // TOXI: 신독성 약물 복용 여부 (0: 없음, 1: 있음)
  // Neurosurgical patients/Korean 적응증에서만 특정 신독성 약물 복용 시 1
  const nonToxicDrugs = ["복용 중인 약물 없음", "기타"];
  const toxi =
    tdmPrescription.drugName === "Vancomycin" &&
    tdmPrescription.indication === "Neurosurgical patients/Korean" &&
    tdmPrescription.additionalInfo &&
    !nonToxicDrugs.includes(tdmPrescription.additionalInfo)
      ? 1
      : 0;

  // 주입시간 정보 (분)
  const infusionTimeMinutes =
    (lastDose as ExtendedDrugAdministration)?.infusionTime ??
    savedPrescription?.infusionTime ??
    0;

  // dose rate (mg/h) for IV infusion; 0 for bolus/oral
  const rateBefore = computeInfusionRateFromAdministration(
    lastDose as ExtendedDrugAdministration
  );

  // rateAfter는 amountAfter를 기준으로 계산 (주입시간이 동일하다고 가정)
  const rateAfter =
    infusionTimeMinutes > 0
      ? amountAfter / (infusionTimeMinutes / 60)
      : rateBefore;

  const dataset: Array<{
    ID: string;
    TIME: number;
    DV: number | null;
    AMT: number;
    RATE: number;
    CMT: number;
    WT: number;
    SEX: number;
    AGE: number;
    CRCL: number | undefined;
    EGFR: number | undefined;
    TOXI: number;
    EVID: number;
  }> = [];

  // 1단계: 투약 기록 추가 (EVID: 1)
  // 4단계에서 입력한 투약 기록들을 시간순으로 정렬
  const sortedDoses = [...patientDoses].sort(
    (a, b) =>
      toDate(a.date, a.time).getTime() - toDate(b.date, b.time).getTime()
  );

  // anchor: 첫 번째 투약 시간을 기준점으로 사용 (상대 시간 계산용)
  const anchorDoseTime =
    sortedDoses.length > 0
      ? toDate(sortedDoses[0].date, sortedDoses[0].time)
      : new Date();

  // 투약 기록이 있으면 모두 추가
  if (sortedDoses.length > 0) {
    for (const d of sortedDoses) {
      const ext = d as ExtendedDrugAdministration;
      // 첫 번째 투약 시간으로부터 상대 시간 계산 (시간 단위)
      const relativeTime = Math.max(
        0,
        hoursDiff(toDate(d.date, d.time), anchorDoseTime)
      );
      const rate = computeInfusionRateFromAdministration(ext);
      // CMT 계산: 경구 투약이면 2, 정맥 투약이면 1
      // route 값이 "IV", "정맥", "oral", "경구" 등 다양한 형식으로 올 수 있음
      const routeLower = (ext.route || "").toLowerCase();
      const isOral = routeLower.includes("po") || 
                     routeLower.includes("oral") || 
                     routeLower.includes("경구");
      let cmt = isOral ? 2 : 1;
      
      // Vancomycin 경구 선택 검증: 현재 사용 가능한 모델이 모두 정맥 투약 모델
      if (tdmPrescription.drugName === "Vancomycin" && isOral) {
        throw new Error("반코마이신은 현재 정맥 투약 모델만 지원됩니다. 투약 경로를 정맥으로 변경해주세요.");
      }
      
      // 디버깅: route와 CMT 값 로깅
      if (sortedDoses.length <= 3 || d === sortedDoses[0] || d === sortedDoses[sortedDoses.length - 1]) {
        console.log(`[TDM API] Dose route: "${ext.route}" -> CMT: ${cmt}, AMT: ${d.dose}, TIME: ${relativeTime}`);
      }

      dataset.push({
        ID: selectedPatientId,
        TIME: relativeTime,
        DV: null,
        AMT: d.dose,
        RATE: rate,
        CMT: cmt,
        WT: weight,
        SEX: sex,
        AGE: age,
        CRCL: renalFunction.crcl,
        EGFR: renalFunction.egfr,
        TOXI: toxi,
        EVID: 1, // 투약 이벤트
      });
    }
  } else if (amountBefore !== undefined) {
    // 투약 기록이 없으면 저장된 처방 정보로 하나의 투약 이벤트 생성
    dataset.push({
      ID: selectedPatientId,
      TIME: 0.0,
      DV: null,
      AMT: amountBefore,
      RATE: 0,
      CMT: cmtBefore,
      WT: weight,
      SEX: sex,
      AGE: age,
      CRCL: renalFunction.crcl,
      EGFR: renalFunction.egfr,
      TOXI: toxi,
      EVID: 1,
    });
  }

  // 2단계: 혈중 약물 농도 추가 (EVID: 0)
  // 3단계에서 입력한 혈중 농도들을 필터링
  const relatedTests = selectedDrugName
    ? bloodTests.filter(
        (b) =>
          b.patientId === selectedPatientId && b.drugName === selectedDrugName
      )
    : bloodTests.filter((b) => b.patientId === selectedPatientId);

  // 혈중 농도를 시간순으로 정렬 (n개일 수 있음)
  const testsSorted = [...relatedTests].sort(
    (a, b) => a.testDate.getTime() - b.testDate.getTime()
  );

  if (testsSorted.length > 0) {
    // 혈중 농도가 있으면 모두 추가 (여러 개 가능)
    for (const bloodTest of testsSorted) {
      // 첫 번째 투약 시간으로부터 상대 시간 계산 (시간 단위)
      const relativeTime = hoursDiff(bloodTest.testDate, anchorDoseTime);

      // 단위 불필요. Vancomycin은 mg/L, Cyclosporin은 ng/mL로 고정되어 있음
      const dv = bloodTest.concentration;

      dataset.push({
        ID: selectedPatientId,
        TIME: relativeTime,
        DV: dv,
        AMT: 0,
        RATE: 0,
        CMT: 1,
        WT: weight,
        SEX: sex,
        AGE: age,
        CRCL: renalFunction.crcl,
        EGFR: renalFunction.egfr,
        TOXI: toxi,
        EVID: 0, // 관찰 이벤트 (혈중 농도)
      });
    }
  } else {
    // 혈중 농도가 없으면 미래 시점에 관찰 이벤트 하나 추가 (DV는 null)
    dataset.push({
      ID: selectedPatientId,
      TIME: tauAfter ?? 2.0,
      DV: null,
      AMT: 0,
      RATE: 0,
      CMT: 1,
      WT: weight,
      SEX: sex,
      AGE: age,
      CRCL: renalFunction.crcl,
      EGFR: renalFunction.egfr,
      TOXI: toxi,
      EVID: 0,
    });
  }

  // Infer model name from drug/indication and context
  const modelName = inferModelName({
    patientId: selectedPatientId,
    drugName: tdmPrescription.drugName,
    indication: tdmPrescription.indication,
    additionalInfo: tdmPrescription.additionalInfo as string | undefined,
    lastDoseDate: lastDose ? toDate(lastDose.date, lastDose.time) : undefined,
  });

  // API request body with before/after fields
  const body = {
    // Patient covariates
    input_WT: weight,
    input_CRCL: renalFunction.crcl,
    input_EGFR: renalFunction.egfr,
    input_AGE: age,
    input_SEX: sex,
    input_TOXI: toxi,

    // Before values (from saved prescription)
    input_tau_before: tauBefore,
    input_amount_before: amountBefore,
    input_rate_before: rateBefore,
    input_cmt_before: cmtBefore,

    // After values (adjusted or same as before)
    input_tau_after: tauAfter,
    input_amount_after: amountAfter,
    input_rate_after: rateAfter,
    input_cmt_after: cmtAfter,

    model_name: modelName,
    dataset,
  };

  return body;
};

export type TdmApiMinimal = {
  AUC_tau_before?: number;
  AUC_24_before?: number;
  CMAX_before?: number;
  CTROUGH_before?: number;
  AUC_tau_after?: number;
  AUC_24_after?: number;
  CMAX_after?: number;
  CTROUGH_after?: number;
  Steady_state?: boolean | string;
};

type TdmHistoryEntry = {
  id: string;
  timestamp: string;
  model_name?: string;
  summary: TdmApiMinimal;
  dataset: unknown[];
  data: unknown;
};

type TdmRequestBodyWithOptionalModel = {
  model_name?: string;
  dataset?: unknown[];
} & Record<string, unknown>;

// CORS 에러 또는 네트워크 에러인지 확인하는 헬퍼 함수
const isRetryableError = (error: Error): boolean => {
  const errorMessage = error.message.toLowerCase();
  const errorName = error.name?.toLowerCase() || "";

  // 503 에러
  if (errorMessage.includes("503")) {
    return true;
  }

  // CORS 에러 또는 네트워크 에러
  if (
    errorMessage.includes("cors") ||
    errorMessage.includes("failed to fetch") ||
    errorMessage.includes("networkerror") ||
    errorMessage.includes("network error") ||
    errorName === "typeerror" ||
    errorName === "networkerror"
  ) {
    return true;
  }

  return false;
};

// TDM 결과가 이미 존재하는지 확인하는 함수
export const hasTdmResult = (patientId: string, drugName?: string): boolean => {
  try {
    // 1. 약물별 최신 결과 확인
    if (drugName) {
      const drugLatestKey = `tdmfriends:tdmResult:${patientId}:${drugName}`;
      const drugLatestRaw = window.localStorage.getItem(drugLatestKey);
      if (drugLatestRaw) {
        const result = JSON.parse(drugLatestRaw);
        if (result && Object.keys(result).length > 0) {
          return true;
        }
      }

      // 2. 히스토리 배열 확인
      const historyKey = `tdmfriends:tdmResults:${patientId}:${drugName}`;
      const historyRaw = window.localStorage.getItem(historyKey);
      if (historyRaw) {
        const list = JSON.parse(historyRaw) as Array<{ data?: unknown }>;
        if (list && list.length > 0 && list.some(entry => entry.data)) {
          return true;
        }
      }
    }

    // 3. 환자별 최신 결과 확인 (약물명 없이 저장된 경우)
    const patientLatestKey = `tdmfriends:tdmResult:${patientId}`;
    const patientLatestRaw = window.localStorage.getItem(patientLatestKey);
    if (patientLatestRaw) {
      const result = JSON.parse(patientLatestRaw);
      if (result && Object.keys(result).length > 0) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
};

// Unified TDM API caller. If persist=true and patientId provided, the result is saved to localStorage.
export const runTdmApi = async (args: {
  body: unknown;
  persist?: boolean;
  patientId?: string;
  drugName?: string;
  retries?: number;
}): Promise<unknown> => {
  const { body, persist, patientId, drugName, retries = 3 } = args;

  let lastError: Error | null = null;
  const apiUrl = "https://b74ljng162.apigw.ntruss.com/tdm/prod/";
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`[TDM API] 시도 ${attempt + 1}/${retries} - ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      console.log(`[TDM API] 응답 상태: ${response.status} ${response.statusText}`);

      if (response.status === 503 && attempt < retries - 1) {
        // 503 에러인 경우 재시도 (지수 백오프, 최대 10초까지)
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.warn(
          `[TDM API] 서버 일시적 오류 (503) - ${attempt + 1}/${retries} 재시도 중... (${delay}ms 대기)`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        // 서버 응답 본문 읽기 시도
        let errorMessage = `TDM API 오류: HTTP ${response.status}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = `TDM API 오류 (HTTP ${response.status}): ${JSON.stringify(errorJson)}`;
            } catch {
              errorMessage = `TDM API 오류 (HTTP ${response.status}): ${errorText.substring(0, 200)}`;
            }
          }
        } catch (e) {
          // 응답 본문 읽기 실패 시 기본 메시지 사용
        }
        console.error('TDM API Request Body:', JSON.stringify(body, null, 2));
        throw new Error(errorMessage);
      }

      const data: TdmApiMinimal = await response.json();

      if (persist && patientId) {
        try {
          // 저장 전 데이터 크기 체크 (대략 4MB 제한)
          const dataString = JSON.stringify(data);
          const dataSize = new Blob([dataString]).size;
          const maxSize = 4 * 1024 * 1024; // 4MB
          
          if (dataSize > maxSize) {
            console.warn(`TDM result data too large (${(dataSize / 1024 / 1024).toFixed(2)}MB), skipping localStorage save`);
            return data;
          }

          // 환자별 최신 결과 저장 시도
          try {
            window.localStorage.setItem(
              `tdmfriends:tdmResult:${patientId}`,
              dataString
            );
          } catch (setError) {
            // QuotaExceededError인 경우 기존 데이터 정리 후 재시도
            if (setError instanceof Error && setError.name === 'QuotaExceededError') {
              console.warn('localStorage quota exceeded, attempting to clear old TDM results (aggressive)');
              // 오래된 TDM 결과 정리 (aggressive 모드)
              clearOldTdmResults(patientId, true);
              // 재시도
              try {
                window.localStorage.setItem(
                  `tdmfriends:tdmResult:${patientId}`,
                  dataString
                );
              } catch (retryError) {
                console.error("Failed to save TDM result after aggressive cleanup", retryError);
                // 최종 시도: 현재 환자의 기존 데이터도 삭제하고 저장
                try {
                  window.localStorage.removeItem(`tdmfriends:tdmResult:${patientId}`);
                  if (drugName) {
                    window.localStorage.removeItem(`tdmfriends:tdmResult:${patientId}:${drugName}`);
                    window.localStorage.removeItem(`tdmfriends:tdmResults:${patientId}:${drugName}`);
                  }
                  window.localStorage.setItem(
                    `tdmfriends:tdmResult:${patientId}`,
                    dataString
                  );
                  console.log("Saved TDM result after removing current patient's old data");
                } catch (finalError) {
                  console.error("Failed to save TDM result after final cleanup", finalError);
                  throw new Error("localStorage 용량이 부족합니다. 브라우저 저장소를 정리해주세요.");
                }
              }
            } else {
              throw setError;
            }
          }

          if (drugName) {
            const historyKey = `tdmfriends:tdmResults:${patientId}:${drugName}`;
            const raw = window.localStorage.getItem(historyKey);
            const list: TdmHistoryEntry[] = raw
              ? (JSON.parse(raw) as TdmHistoryEntry[])
              : [];
            const typedBody = body as TdmRequestBodyWithOptionalModel;
            const entry: TdmHistoryEntry = {
              id: `${Date.now()}`,
              timestamp: new Date().toISOString(),
              model_name: typedBody?.model_name,
              summary: data,
              dataset: (typedBody?.dataset as unknown[]) || [],
              data,
            };
            list.push(entry);
            
            // 히스토리 최대 5개로 제한 (오래된 것부터 삭제)
            if (list.length > 5) {
              list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
              list.splice(0, list.length - 5);
            }
            
            try {
              const historyString = JSON.stringify(list);
              window.localStorage.setItem(historyKey, historyString);
              // Also persist latest result per patient+drug
              window.localStorage.setItem(
                `tdmfriends:tdmResult:${patientId}:${drugName}`,
                dataString
              );
            } catch (historyError) {
              // 히스토리 저장 실패 시 오래된 항목 삭제 후 재시도
              if (historyError instanceof Error && historyError.name === 'QuotaExceededError') {
                console.warn('localStorage quota exceeded, cleaning old history entries (aggressive)');
                // 오래된 TDM 결과 정리 (aggressive 모드)
                clearOldTdmResults(patientId, true);
                // 가장 오래된 항목 삭제 후 재시도 (최신 1개만 유지)
                if (list.length > 1) {
                  list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                  list.splice(0, list.length - 1); // 최신 1개만 유지
                  try {
                    window.localStorage.setItem(historyKey, JSON.stringify(list));
                    window.localStorage.setItem(
                      `tdmfriends:tdmResult:${patientId}:${drugName}`,
                      dataString
                    );
                  } catch (retryError) {
                    console.error("Failed to save TDM history after cleanup", retryError);
                    // 최종 시도: 현재 환자의 기존 히스토리 전체 삭제하고 최신 것만 저장
                    try {
                      window.localStorage.removeItem(historyKey);
                      window.localStorage.removeItem(`tdmfriends:tdmResult:${patientId}:${drugName}`);
                      // 최신 항목만 다시 생성
                      const latestEntry: TdmHistoryEntry = {
                        id: `${Date.now()}`,
                        timestamp: new Date().toISOString(),
                        model_name: typedBody?.model_name,
                        summary: data,
                        dataset: (typedBody?.dataset as unknown[]) || [],
                        data,
                      };
                      window.localStorage.setItem(historyKey, JSON.stringify([latestEntry]));
                      window.localStorage.setItem(
                        `tdmfriends:tdmResult:${patientId}:${drugName}`,
                        dataString
                      );
                      console.log("Saved TDM history after removing all old entries");
                    } catch (finalError) {
                      console.error("Failed to save TDM history after final cleanup", finalError);
                      throw new Error("localStorage 용량이 부족합니다. 브라우저 저장소를 정리해주세요.");
                    }
                  }
                } else {
                  // 히스토리가 1개뿐이면 그대로 저장 시도
                  try {
                    window.localStorage.setItem(historyKey, JSON.stringify(list));
                    window.localStorage.setItem(
                      `tdmfriends:tdmResult:${patientId}:${drugName}`,
                      dataString
                    );
                  } catch (finalError) {
                    console.error("Failed to save TDM history", finalError);
                    throw new Error("localStorage 용량이 부족합니다. 브라우저 저장소를 정리해주세요.");
                  }
                }
              } else {
                throw historyError;
              }
            }
          }
        } catch (e) {
          // QuotaExceededError인 경우 더 자세한 로그 및 사용자에게 에러 전달
          if (e instanceof Error && e.name === 'QuotaExceededError') {
            console.error("localStorage quota exceeded. Please clear browser storage or reduce data size.", e);
            // 사용자에게 알리기 위해 에러를 다시 throw
            throw new Error("localStorage 용량이 부족합니다. 브라우저 저장소를 정리해주세요.");
          } else if (e instanceof Error && e.message.includes("localStorage 용량이 부족")) {
            // 이미 처리된 에러는 그대로 throw
            throw e;
          } else {
            console.error("Failed to save TDM result/history to localStorage", e);
            // 다른 에러도 사용자에게 알림
            throw new Error("데이터 저장 중 오류가 발생했습니다. 다시 시도해주세요.");
          }
        }
      }
      return data;
    } catch (error) {
      lastError = error as Error;
      const errorMessage = lastError.message.toLowerCase();
      const errorName = lastError.name || "";
      
      // 상세한 오류 정보 로깅
      console.error(`[TDM API] 오류 발생 (시도 ${attempt + 1}/${retries}):`, {
        name: errorName,
        message: lastError.message,
        stack: lastError.stack,
        error: error
      });
      
      // CORS 오류 감지
      const isCorsError = errorMessage.includes("cors") || 
                         errorMessage.includes("access-control-allow-origin") ||
                         (error instanceof TypeError && (
                           errorMessage.includes("failed to fetch") ||
                           errorMessage.includes("networkerror") ||
                           errorName === "TypeError"
                         ));
      
      // 네트워크 오류 감지
      const isNetworkError = errorMessage.includes("failed to fetch") ||
                            errorMessage.includes("networkerror") ||
                            errorMessage.includes("network error") ||
                            errorName === "TypeError" ||
                            errorName === "NetworkError";
      
      // 503 오류 감지 (응답을 받았지만 503인 경우는 이미 처리됨)
      const is503Error = errorMessage.includes("503");
      
      // CORS 또는 네트워크 오류인 경우 명확한 메시지 제공
      if (isCorsError || isNetworkError) {
        const errorType = isCorsError ? "CORS 오류" : "네트워크 오류";
        const detailedError = new Error(
          `${errorType}: TDM 서버에 접근할 수 없습니다.\n\n` +
          `오류 상세:\n` +
          `- 오류 유형: ${errorName}\n` +
          `- 오류 메시지: ${lastError.message}\n\n` +
          `가능한 원인:\n` +
          `- 서버의 CORS 설정 문제\n` +
          `- 네트워크 연결 문제\n` +
          `- 서버가 일시적으로 사용 불가능한 상태\n\n` +
          `서버 관리자에게 문의하거나 잠시 후 다시 시도해주세요.`
        );
        lastError = detailedError;
      }
      
      // 503 에러 또는 CORS/네트워크 에러인 경우 재시도
      if (isRetryableError(lastError)) {
        if (attempt < retries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          const errorType = isCorsError ? "CORS" : 
                          isNetworkError ? "네트워크" :
                          is503Error ? "서버 일시적 오류 (503)" : 
                          "일시적";
          console.warn(
            `[TDM API] ${errorType} 오류 감지 - ${attempt + 1}/${retries} 재시도 중... (${delay}ms 대기)`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      } else {
        // 재시도 불가능한 에러는 즉시 throw
        console.error(`[TDM API] 재시도 불가능한 오류 - 즉시 실패 처리`);
        throw error;
      }
    }
  }

  // 모든 재시도 실패 시 마지막 에러 throw
  const finalError = lastError || new Error("TDM API 호출 실패: 모든 재시도 실패");
  
  // 최종 오류 상세 로깅
  console.error(`[TDM API] 최종 실패 (${retries}회 재시도 후):`, {
    message: finalError.message,
    name: finalError.name,
    stack: finalError.stack
  });
  
  // CORS 오류인 경우 추가 안내
  if (finalError.message.includes("CORS 오류") || finalError.message.includes("네트워크 오류")) {
    console.error(
      "[TDM API] 서버 접근 오류로 인한 API 호출 실패.\n" +
      "서버 측에서 CORS 헤더 설정이 필요하거나 네트워크 연결을 확인해주세요."
    );
  }
  
  throw finalError;
};

export const setActiveTdm = (
  patientId: string,
  drugName: string | undefined,
  active: boolean
) => {
  try {
    if (!patientId || !drugName) return;
    const key = `tdmfriends:activeTdm:${patientId}:${drugName}`;
    if (active)
      window.localStorage.setItem(
        key,
        JSON.stringify({ active: true, at: Date.now() })
      );
    else window.localStorage.removeItem(key);
  } catch {
    console.warn("setActiveTdm failed");
  }
};

export const isActiveTdmExists = (
  patientId: string,
  drugName: string | undefined
): boolean => {
  try {
    if (!patientId || !drugName) return false;
    const key = `tdmfriends:activeTdm:${patientId}:${drugName}`;
    return !!window.localStorage.getItem(key);
  } catch {
    return false;
  }
};
