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

  // Detect CRRT from saved renal info
  const renal = getSelectedRenalInfo(patientId, drugName);
  const isCRRT = /crrt/i.test(renal?.renalReplacement || "");

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
  return tauHours > 0 ? tauHours : undefined;
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
    (d) => d.patientId === selectedPatientId
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
  const tauBefore =
    savedPrescription?.tau ?? computeTauFromAdministrations(patientDoses) ?? 12;
  const cmtBefore = savedPrescription?.cmt ?? 1;

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
      const cmt =
        ext.route.includes("po") || ext.route.includes("경구") ? 2 : 1;

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
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(
        "https://b74ljng162.apigw.ntruss.com/tdm/prod/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (response.status === 503 && attempt < retries - 1) {
        // 503 에러인 경우 재시도 (지수 백오프)
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        throw new Error(`TDM API error: ${response.status}`);
      }

      const data: TdmApiMinimal = await response.json();

      if (persist && patientId) {
        try {
          window.localStorage.setItem(
            `tdmfriends:tdmResult:${patientId}`,
            JSON.stringify(data)
          );

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
            window.localStorage.setItem(historyKey, JSON.stringify(list));
            // Also persist latest result per patient+drug
            window.localStorage.setItem(
              `tdmfriends:tdmResult:${patientId}:${drugName}`,
              JSON.stringify(data)
            );
          }
        } catch (e) {
          console.error("Failed to save TDM result/history to localStorage", e);
        }
      }
      return data;
    } catch (error) {
      lastError = error as Error;
      // 503이 아닌 다른 에러는 즉시 재시도하지 않음
      if ((error as Error).message.includes("503")) {
        if (attempt < retries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      } else {
        // 503이 아닌 에러는 즉시 throw
        throw error;
      }
    }
  }

  // 모든 재시도 실패 시 마지막 에러 throw
  throw lastError || new Error("TDM API failed after retries");
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
