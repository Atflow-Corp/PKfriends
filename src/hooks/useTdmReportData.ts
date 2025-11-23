import { useState, useEffect } from "react";
import { Patient, Prescription, BloodTest, DrugAdministration } from "@/pages/Index";
import { storage, STORAGE_KEYS } from "@/lib/storage";

interface UseTdmReportDataOptions {
  patientId: string | null;
  drugName: string | null;
}

interface UseTdmReportDataResult {
  patient: Patient | null;
  prescription: Prescription | null;
  tdmResult: any | null;
  tdmExtraSeries: {
    ipredSeries?: { time: number; value: number }[];
    predSeries?: { time: number; value: number }[];
    observedSeries?: { time: number; value: number }[];
  } | null;
  prescriptionInfo: {
    tau?: number;
    amount?: number;
  } | null;
  inputTOXI: number | undefined;
  isLoading: boolean;
}

/**
 * TDM 보고서 페이지에서 사용할 데이터를 로드하는 커스텀 훅
 * localStorage에서 환자, 처방전, TDM 결과, 시리즈 데이터 등을 로드합니다.
 */
export const useTdmReportData = ({
  patientId,
  drugName,
}: UseTdmReportDataOptions): UseTdmReportDataResult => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [tdmResult, setTdmResult] = useState<any | null>(null);
  const [tdmExtraSeries, setTdmExtraSeries] = useState<{
    ipredSeries?: { time: number; value: number }[];
    predSeries?: { time: number; value: number }[];
    observedSeries?: { time: number; value: number }[];
  } | null>(null);
  const [prescriptionInfo, setPrescriptionInfo] = useState<{
    tau?: number;
    amount?: number;
  } | null>(null);
  const [inputTOXI, setInputTOXI] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!patientId || !drugName) {
      setIsLoading(false);
      return;
    }

    const loadData = () => {
      try {
        // 환자 데이터 로드
        const savedPatients = storage.getJSON<Patient[]>(STORAGE_KEYS.patients, [] as Patient[]);
        const revivePatients = (savedPatients || []).map((p: any) => ({
          ...p,
          createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        }));

        const foundPatient = revivePatients.find((p) => p.id === patientId);
        if (foundPatient) {
          setPatient(foundPatient);
        }

        // 처방전 데이터 로드
        const savedPrescriptions = storage.getJSON<Prescription[]>(
          STORAGE_KEYS.prescriptions,
          [] as Prescription[]
        );
        const revivePrescriptions = (savedPrescriptions || []).map((pr: any) => ({
          ...pr,
          startDate: pr.startDate ? new Date(pr.startDate) : new Date(),
        }));

        const foundPrescription = revivePrescriptions.find(
          (p) => p.patientId === patientId && p.drugName === drugName
        );
        if (foundPrescription) {
          setPrescription(foundPrescription);
        }

        // TDM 결과 데이터 로드 (여러 키 형식 확인)
        let savedTdmResult = window.localStorage.getItem(
          `tdmfriends:tdmResult:${patientId}:${drugName}`
        );

        // 2. 환자별 최신 결과: tdmfriends:tdmResult:${patientId} (약품명 없이 저장된 경우)
        if (!savedTdmResult) {
          savedTdmResult = window.localStorage.getItem(`tdmfriends:tdmResult:${patientId}`);
        }

        // 3. 히스토리에서 최신 데이터 가져오기: tdmfriends:tdmResults:${patientId}:${drugName}
        let latestHistoryEntry: any = null;
        if (!savedTdmResult) {
          const historyKey = `tdmfriends:tdmResults:${patientId}:${drugName}`;
          const historyRaw = window.localStorage.getItem(historyKey);
          if (historyRaw) {
            try {
              const historyList = JSON.parse(historyRaw) as any[];
              if (historyList && historyList.length > 0) {
                // 최신 항목 찾기 (timestamp 기준)
                latestHistoryEntry = historyList
                  .filter((entry) => entry.timestamp || entry.id)
                  .sort((a, b) => {
                    const timeA = a.timestamp
                      ? new Date(a.timestamp).getTime()
                      : parseInt(a.id || "0");
                    const timeB = b.timestamp
                      ? new Date(b.timestamp).getTime()
                      : parseInt(b.id || "0");
                    return timeB - timeA;
                  })[0];

                if (latestHistoryEntry?.summary) {
                  savedTdmResult = JSON.stringify(latestHistoryEntry.summary);
                } else if (latestHistoryEntry?.data) {
                  savedTdmResult = JSON.stringify(latestHistoryEntry.data);
                }
              }
            } catch (historyError) {
              console.warn("히스토리 데이터 파싱 실패:", historyError);
            }
          }
        } else {
          // savedTdmResult가 있으면 히스토리에서 최신 엔트리도 찾기 (input_TOXI 확인용)
          const historyKey = `tdmfriends:tdmResults:${patientId}:${drugName}`;
          const historyRaw = window.localStorage.getItem(historyKey);
          if (historyRaw) {
            try {
              const historyList = JSON.parse(historyRaw) as any[];
              if (historyList && historyList.length > 0) {
                latestHistoryEntry = historyList
                  .filter((entry) => entry.timestamp || entry.id)
                  .sort((a, b) => {
                    const timeA = a.timestamp
                      ? new Date(a.timestamp).getTime()
                      : parseInt(a.id || "0");
                    const timeB = b.timestamp
                      ? new Date(b.timestamp).getTime()
                      : parseInt(b.id || "0");
                    return timeB - timeA;
                  })[0];
              }
            } catch (historyError) {
              console.warn("히스토리 데이터 파싱 실패:", historyError);
            }
          }
        }

        if (savedTdmResult) {
          setTdmResult(JSON.parse(savedTdmResult));
        }

        // 히스토리 엔트리에서 input_TOXI 값 추출 (dataset의 첫 번째 행에서 TOXI 확인)
        // 참고: dataset의 TOXI 값은 API 요청 시 input_TOXI와 동일한 값입니다 (src/lib/tdm.ts 참조)
        if (
          latestHistoryEntry?.dataset &&
          Array.isArray(latestHistoryEntry.dataset) &&
          latestHistoryEntry.dataset.length > 0
        ) {
          const firstRow = latestHistoryEntry.dataset[0] as any;
          if (firstRow.TOXI !== undefined) {
            console.log("히스토리에서 TOXI 값 확인:", {
              TOXI: firstRow.TOXI,
              datasetLength: latestHistoryEntry.dataset.length,
              firstRow: firstRow,
            });
            setInputTOXI(firstRow.TOXI);
          } else {
            console.warn("히스토리 dataset에서 TOXI 값을 찾을 수 없습니다:", {
              firstRow: firstRow,
              datasetLength: latestHistoryEntry.dataset.length,
            });
          }
        } else {
          console.warn("히스토리 엔트리에서 dataset을 찾을 수 없습니다:", {
            hasHistoryEntry: !!latestHistoryEntry,
            hasDataset: !!latestHistoryEntry?.dataset,
          });
        }

        // TDM 시리즈 데이터 로드
        const tdmExtraSeriesKey = `tdmfriends:tdmExtraSeries:${patientId}:${drugName}`;
        const savedTdmExtraSeries = window.localStorage.getItem(tdmExtraSeriesKey);
        if (savedTdmExtraSeries) {
          setTdmExtraSeries(JSON.parse(savedTdmExtraSeries));
        }

        // 처방전 정보 로드 (tau, amount)
        const prescriptionInfoKey = `tdmfriends:prescription:${patientId}:${drugName}`;
        const savedPrescriptionInfo = window.localStorage.getItem(prescriptionInfoKey);
        if (savedPrescriptionInfo) {
          const parsed = JSON.parse(savedPrescriptionInfo);
          setPrescriptionInfo({
            tau: parsed.tau,
            amount: parsed.amount,
          });
        }
      } catch (error) {
        console.error("TDM 결과 데이터 로드 실패:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [patientId, drugName]);

  return {
    patient,
    prescription,
    tdmResult,
    tdmExtraSeries,
    prescriptionInfo,
    inputTOXI,
    isLoading,
  };
};

