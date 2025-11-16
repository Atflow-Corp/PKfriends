// TDM 차트 공통 유틸리티 함수들

export interface SimulationDataPoint {
  time: number;
  predicted: number;
  observed: number | null;
  controlGroup?: number;
  currentMethod?: number;
}

export interface DrugAdministration {
  id: string;
  patientId: string;
  drugName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
}

/**
 * 약물별 농도 단위 반환
 */
export const getConcentrationUnit = (drug?: string): string => {
  switch (drug) {
    case 'Vancomycin':
      return 'mg/L';
    case 'Cyclosporin':
      return 'ng/mL';
    default:
      return 'mg/L';
  }
};

/**
 * 첫 투약 시간 기준점 가져오기
 */
export const getFirstDoseDateTime = (
  drugAdministrations: DrugAdministration[],
  selectedDrug?: string
): Date => {
  if (!drugAdministrations || drugAdministrations.length === 0) return new Date();
  
  const sortedDoses = drugAdministrations
    .filter(d => d.drugName === selectedDrug)
    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
  
  return sortedDoses.length > 0 
    ? new Date(`${sortedDoses[0].date}T${sortedDoses[0].time}`)
    : new Date();
};

/**
 * 시간(hours)을 날짜/시간 문자열로 포맷팅
 */
export const formatDateTimeForTick = (
  timeInHours: number,
  drugAdministrations: DrugAdministration[],
  selectedDrug?: string
): string => {
  if (!drugAdministrations || drugAdministrations.length === 0) {
    return `${timeInHours}h`;
  }
  
  const firstDoseDateTime = getFirstDoseDateTime(drugAdministrations, selectedDrug);
  const targetDateTime = new Date(firstDoseDateTime.getTime() + timeInHours * 60 * 60 * 1000);
  
  const month = String(targetDateTime.getMonth() + 1).padStart(2, '0');
  const day = String(targetDateTime.getDate()).padStart(2, '0');
  const hour = String(targetDateTime.getHours()).padStart(2, '0');
  
  return `${month}.${day} ${hour}시`;
};

/**
 * 마지막 실제 투약 시간 계산 (구분선용)
 */
export const calculateLastActualDoseTime = (
  drugAdministrations: DrugAdministration[],
  selectedDrug?: string
): number | null => {
  if (!drugAdministrations || drugAdministrations.length === 0) return null;
  
  const firstDoseDateTime = getFirstDoseDateTime(drugAdministrations, selectedDrug);
  const selectedDrugDoses = drugAdministrations
    .filter(d => d.drugName === selectedDrug)
    .map(d => {
      const doseDateTime = new Date(`${d.date}T${d.time}`);
      return (doseDateTime.getTime() - firstDoseDateTime.getTime()) / (1000 * 60 * 60);
    })
    .sort((a, b) => a - b);
  
  return selectedDrugDoses.length > 0 ? Math.max(...selectedDrugDoses) : null;
};

/**
 * 현재 시각 기준 시간(offset, hours) 계산
 * - X축이 첫 투약 시각을 0h로 잡고 있기 때문에,
 *   첫 투약 시각 기준으로 현재 시각까지의 경과 시간(시간)을 반환
 */
export const calculateCurrentTimeOffset = (
  drugAdministrations: DrugAdministration[],
  selectedDrug?: string
): number | null => {
  if (!drugAdministrations || drugAdministrations.length === 0) return null;

  const firstDoseDateTime = getFirstDoseDateTime(drugAdministrations, selectedDrug);
  const now = new Date();
  const diffHours = (now.getTime() - firstDoseDateTime.getTime()) / (1000 * 60 * 60);

  // 아직 첫 투약 전인 경우에는 기준선을 0h에 맞추기 위해 0으로 클램프
  if (diffHours < 0) return 0;

  return diffHours;
};

/**
 * Series 데이터를 SimulationDataPoint 배열로 병합
 */
export const mergeSeries = (
  ipredSeries?: { time: number; value: number }[],
  predSeries?: { time: number; value: number }[],
  observedSeries?: { time: number; value: number }[],
  currentMethodSeries?: { time: number; value: number }[]
): SimulationDataPoint[] => {
  if (!ipredSeries?.length && !predSeries?.length && !observedSeries?.length && !currentMethodSeries?.length) {
    return [];
  }

  const map = new Map<number, SimulationDataPoint>();
  
  const getPoint = (t: number): SimulationDataPoint => {
    const key = Number(t) || 0;
    const existing = map.get(key);
    if (existing) return existing;
    const created: SimulationDataPoint = { 
      time: key, 
      predicted: 0, 
      observed: null, 
      controlGroup: 0, 
      currentMethod: 0 
    };
    map.set(key, created);
    return created;
  };

  // API returns values in correct units already (Vancomycin: mg/L, Cyclosporin: ng/mL)
  for (const p of ipredSeries || []) {
    const pt = getPoint(p.time);
    pt.predicted = p.value ?? 0;
  }
  for (const p of predSeries || []) {
    const pt = getPoint(p.time);
    pt.controlGroup = p.value ?? 0;
  }
  for (const p of observedSeries || []) {
    const pt = getPoint(p.time);
    pt.observed = p.value ?? null;
  }
  for (const p of currentMethodSeries || []) {
    const pt = getPoint(p.time);
    pt.currentMethod = p.value ?? 0;
  }

  return Array.from(map.values()).sort((a, b) => a.time - b.time);
};

/**
 * 데이터 시간 범위 계산
 */
export const calculateDataTimeExtents = (
  ipredSeries?: { time: number; value: number }[],
  predSeries?: { time: number; value: number }[],
  observedSeries?: { time: number; value: number }[],
  currentMethodSeries?: { time: number; value: number }[]
): { min: number; max: number } => {
  const candidates: number[] = [];
  for (const p of ipredSeries || []) candidates.push(p.time);
  for (const p of predSeries || []) candidates.push(p.time);
  for (const p of observedSeries || []) candidates.push(p.time);
  for (const p of currentMethodSeries || []) candidates.push(p.time);
  
  const maxSeriesTime = candidates.length > 0 ? Math.max(...candidates) : 72;
  const minSeriesTime = candidates.length > 0 ? Math.min(...candidates) : 0;
  
  return { min: Math.max(0, minSeriesTime), max: Math.max(24, maxSeriesTime) };
};

/**
 * 평균 농도 계산
 */
export const calculateAverageConcentration = (
  data: SimulationDataPoint[]
): number | null => {
  if (!data || data.length < 2) return null;
  
  const sorted = [...data].sort((a, b) => a.time - b.time);
  const t0 = sorted[0].time;
  const tn = sorted[sorted.length - 1].time;
  const duration = tn - t0;
  
  if (duration <= 0) return null;
  
  let auc = 0;
  for (let i = 1; i < sorted.length; i++) {
    const dt = sorted[i].time - sorted[i - 1].time;
    if (dt <= 0) continue;
    const cPrev = sorted[i - 1].predicted ?? 0;
    const cCurr = sorted[i].predicted ?? 0;
    auc += ((cPrev + cCurr) / 2) * dt;
  }
  
  return auc / duration;
};

/**
 * Y축 최대값 계산
 */
export const calculateYMax = (
  data: SimulationDataPoint[],
  targetMax?: number | null
): number => {
  const dataMax = (data || []).reduce((m, p) => {
    const candidates = [p.predicted, p.controlGroup ?? 0, p.observed ?? 0, p.currentMethod ?? 0]
      .filter(v => typeof v === 'number') as number[];
    const localMax = candidates.length ? Math.max(...candidates) : 0;
    return Math.max(m, localMax);
  }, 0);
  
  const targetMaxNum = typeof targetMax === 'number' ? targetMax : 0;
  const calculatedMax = Math.max(dataMax, targetMaxNum);
  
  if (calculatedMax <= 0.2) {
    return 0.2;
  } else {
    return Math.ceil(calculatedMax * 1.2 * 10) / 10;
  }
};

/**
 * TDM 목표에 따른 예측값과 단위 반환
 */
export const getTdmTargetValue = (
  tdmTarget: string | undefined,
  predictedAUC: number | null,
  predictedMax: number | null,
  predictedTrough: number | null,
  selectedDrug?: string
): { value: string; unit: string; numericValue: number | null } => {
  const target = tdmTarget?.toLowerCase() || '';
  
  if (target.includes('auc')) {
    return {
      value: predictedAUC != null ? `${Math.round(predictedAUC).toLocaleString()} mg*h/L` : '-',
      unit: 'mg*h/L',
      numericValue: predictedAUC
    };
  } else if (target.includes('max') || target.includes('peak')) {
    const unit = getConcentrationUnit(selectedDrug);
    return {
      value: predictedMax != null ? `${Number(predictedMax.toFixed(2)).toLocaleString()} ${unit}` : '-',
      unit,
      numericValue: predictedMax
    };
  } else if (target.includes('trough')) {
    const unit = getConcentrationUnit(selectedDrug);
    return {
      value: predictedTrough != null ? `${Number(predictedTrough.toFixed(2)).toLocaleString()} ${unit}` : '-',
      unit,
      numericValue: predictedTrough
    };
  } else {
    return {
      value: predictedAUC != null ? `${Math.round(predictedAUC).toLocaleString()} mg*h/L` : '-',
      unit: 'mg*h/L',
      numericValue: predictedAUC
    };
  }
};

/**
 * 목표 범위 내 여부 확인
 */
export const isWithinTargetRange = (
  tdmTarget: string | undefined,
  tdmTargetValue: string | undefined,
  predictedAUC: number | null,
  predictedMax: number | null,
  predictedTrough: number | null,
  selectedDrug?: string
): boolean => {
  const targetValue = getTdmTargetValue(tdmTarget, predictedAUC, predictedMax, predictedTrough, selectedDrug);
  const targetRange = tdmTargetValue || '';
  
  if (!targetRange || !targetValue.numericValue) return true;
  
  const rangeMatch = targetRange.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (!rangeMatch) return true;
  
  const minValue = parseFloat(rangeMatch[1]);
  const maxValue = parseFloat(rangeMatch[2]);
  const currentValue = targetValue.numericValue;
  
  return currentValue >= minValue && currentValue <= maxValue;
};

/**
 * 정수 포맷팅
 */
export const formatInt = (n: number | null, unit: string): string => {
  if (n == null || Number.isNaN(n)) return '-';
  return `${Math.round(n).toLocaleString()} ${unit}`;
};

/**
 * 소수점 포맷팅
 */
export const formatFixed = (n: number | null, unit: string): string => {
  if (n == null || Number.isNaN(n)) return '-';
  return `${Number(n.toFixed(2)).toLocaleString()} ${unit}`;
};

