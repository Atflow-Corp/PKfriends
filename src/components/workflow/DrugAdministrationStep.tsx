import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Patient, Prescription, DrugAdministration, BloodTest } from "@/pages/Index";
import dayjs from "dayjs";
import { ArrowLeft, ArrowRight, History, CheckCircle } from "lucide-react";
import TablePage from "./table_maker.jsx";
import "./table_maker.css";
import { buildTdmRequestBody, runTdmApi } from "@/lib/tdm";

interface DrugAdministrationStepProps {
  patients: Patient[];
  prescriptions: Prescription[];
  selectedPatient: Patient | null;
  selectedPrescription: Prescription | null;
  onAddDrugAdministration: (drugAdministration: DrugAdministration) => void;
  setDrugAdministrations: (records: unknown[]) => void;
  drugAdministrations: DrugAdministration[];
  bloodTests: BloodTest[];
  onNext: () => void;
  onPrev: () => void;
  isCompleted: boolean;
}

const DrugAdministrationStep = ({
  patients,
  prescriptions,
  selectedPatient,
  selectedPrescription,
  onAddDrugAdministration,
  setDrugAdministrations,
  drugAdministrations,
  bloodTests,
  onNext,
  onPrev,
  isCompleted
}: DrugAdministrationStepProps) => {
  // 선택된 처방전 사용 (약품명 기준으로 데이터 분리)
  const tdmDrug = selectedPrescription;
  const [form, setForm] = useState<Partial<DrugAdministration>>({
    drugName: tdmDrug?.drugName || "",
    route: "",
    date: "",
    time: "",
    dose: 0,
    unit: "mg",
    infusionTime: undefined
  });
  const [tableReady, setTableReady] = useState(false);
  const [loading, setLoading] = useState(false);
  type ConditionItem = { intervalHours?: number; [key: string]: string | number | boolean | null | undefined };
  const [conditions, setConditions] = useState<ConditionItem[]>([]);
  
  // table_maker에서 업데이트 필요 여부를 받기 위한 ref
  const tableUpdateRef = useRef<{
    needsUpdate: boolean;
    updateInfo: { tableRowCount: number; conditionsTotalDoses: number };
    performUpdate: () => boolean;
  } | null>(null);

  // 날짜 오늘 이후 선택 불가
  const today = dayjs().format("YYYY-MM-DD");

  const handleChange = (key: keyof DrugAdministration, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.drugName || !form.route || !form.date || !form.time || !form.dose || !form.unit) return;
    if (form.route === "IV" && !form.infusionTime) return;
    onAddDrugAdministration({
      id: Date.now().toString(),
      patientId: selectedPatient!.id,
      drugName: form.drugName!,
      route: form.route!,
      date: form.date!,
      time: form.time!,
      dose: Number(form.dose),
      unit: form.unit!,
      isIVInfusion: form.route === "IV",
      infusionTime: form.route === "IV" ? Number(form.infusionTime) : undefined,
      administrationTime: undefined
    });
    setForm({
      drugName: tdmDrug?.drugName || "",
      route: "",
      date: "",
      time: "",
      dose: 0,
      unit: "mg",
      infusionTime: undefined
    });
  };

  const patientDrugAdministrations = selectedPatient && tdmDrug
    ? drugAdministrations.filter(d => d.patientId === selectedPatient.id && d.drugName === tdmDrug.drugName)
    : [];

  // localStorage 키 생성
  const getStorageKey = useCallback(() => (
    selectedPatient && tdmDrug?.drugName
      ? `tdmfriends:conditions:${selectedPatient.id}:${tdmDrug.drugName}`
      : null
  ), [selectedPatient, tdmDrug?.drugName]);

  // 컴포넌트 마운트 시 저장된 conditions 복원
  useEffect(() => {
    if (!selectedPatient) return;
    
    const storageKey = getStorageKey();
    if (!storageKey) return;

    try {
      const savedConditions = localStorage.getItem(storageKey);
      if (savedConditions) {
        const parsed = JSON.parse(savedConditions);
        setConditions(parsed);
      }
    } catch (error) {
      console.error('Failed to restore conditions:', error);
    }
  }, [selectedPatient, tdmDrug?.drugName, getStorageKey]);

  // conditions 변경 시 localStorage에 저장
  useEffect(() => {
    if (!selectedPatient) return;
    
    const storageKey = getStorageKey();
    if (!storageKey) return;
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(conditions));
    } catch (error) {
      console.error('Failed to save conditions:', error);
    }
  }, [conditions, selectedPatient, tdmDrug?.drugName, getStorageKey]);

  useEffect(() => {
    // no-op
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            4단계: 투약기록
            {isCompleted && <CheckCircle className="h-5 w-5 text-green-600" />}
          </CardTitle>
          <CardDescription>
            2단계에서 입력한 TDM 약물에 대해 7반감기 이내의 투약력을 입력하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* TDM 선택 정보 영역 */}
          {tdmDrug && selectedPatient && (
            <div className="py-3 px-4 rounded bg-muted dark:bg-slate-800 mb-4">
              {/* 1행: 환자 기본 정보 */}
              <div className="grid grid-cols-4 gap-4 mb-3">
                <div className="text-sm">
                  <span className="font-medium">나이:</span> {selectedPatient.age}
                </div>
                <div className="text-sm">
                  <span className="font-medium">성별:</span> {selectedPatient.gender}
                </div>
                <div className="text-sm">
                  <span className="font-medium">몸무게:</span> {selectedPatient.weight}kg
                </div>
                <div className="text-sm">
                  <span className="font-medium">키:</span> {selectedPatient.height}cm
                </div>
              </div>
              
              {/* 2행: TDM 정보 */}
              <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                <div className="text-sm">
                  <span className="font-medium text-gray-600 dark:text-gray-400">약품명:</span> 
                  <span className="ml-2 font-semibold">{tdmDrug.drugName}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-600 dark:text-gray-400">적응증:</span> 
                  <span className="ml-2">{tdmDrug.indication}</span>
                </div>
              </div>
            </div>
          )}
          {(!tdmDrug || !selectedPatient) && (
            <div className="py-2 px-3 rounded bg-muted dark:bg-slate-800 text-base font-semibold mb-4">
              <div className="text-sm">
                <span className="text-muted-foreground">TDM 내역:</span> {tdmDrug?.drugName || "-"}, {tdmDrug?.indication || "-"}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-slate-900 border dark:border-slate-700 text-slate-900 dark:text-slate-200">
        <CardHeader>
          <CardTitle>투약 기록 입력</CardTitle>
        </CardHeader>
        <CardContent>
          {/* table_maker 테이블/입력 UI */}
          <TablePage
            selectedPatient={selectedPatient}
            tdmDrug={tdmDrug}
            onComplete={onNext}
            onTableGenerated={() => setTableReady(true)}
            initialAdministrations={patientDrugAdministrations}
            initialConditions={conditions}
            onConditionsChange={setConditions}
            onUpdateNeeded={(needsUpdate, updateInfo, performUpdate) => {
              tableUpdateRef.current = {
                needsUpdate,
                updateInfo,
                performUpdate
              };
            }}
            onSaveRecords={(records) => {
              if (selectedPatient && tdmDrug) {
                const newAdministrations = records.map((row, idx) => {
                  // row에 conditionId와 intervalHours가 있으면 사용, 없으면 fallback
                  const intervalHours = row.intervalHours !== undefined 
                    ? Number(row.intervalHours)
                    : (conditions.length > 0 ? Number(conditions[0].intervalHours) : undefined);
                  
                  return {
                    id: `${Date.now()}_${idx}`,
                    patientId: selectedPatient.id,
                    drugName: tdmDrug.drugName,
                    route: row.route,
                    date: row.timeStr.split(" ")[0],
                    time: row.timeStr.split(" ")[1],
                    dose: Number(row.amount.split(" ")[0]),
                    unit: row.amount.split(" ")[1] || "mg",
                    isIVInfusion: row.route === "정맥",
                    infusionTime: row.injectionTime && row.injectionTime !== "-" ? parseInt(String(row.injectionTime).replace(/[^0-9]/g, "")) : undefined,
                    administrationTime: undefined,
                    intervalHours: intervalHours
                  };
                });
                const updatedAdministrations = [
                  ...drugAdministrations.filter(d => !(d.patientId === selectedPatient.id && d.drugName === tdmDrug?.drugName)),
                  ...newAdministrations
                ];
                setDrugAdministrations(updatedAdministrations);
              }
            }}
            onRecordsChange={(records) => {
              if (selectedPatient && tdmDrug) {
                const mapped = records.map((row, idx) => {
                  // row에 conditionId와 intervalHours가 있으면 사용, 없으면 fallback
                  const intervalHours = row.intervalHours !== undefined 
                    ? Number(row.intervalHours)
                    : (conditions.length > 0 ? Number(conditions[0].intervalHours) : undefined);
                  
                  return {
                    id: `${Date.now()}_${idx}`,
                    patientId: selectedPatient.id,
                    drugName: tdmDrug.drugName,
                    route: row.route,
                    date: row.timeStr.split(" ")[0],
                    time: row.timeStr.split(" ")[1],
                    dose: Number(row.amount.split(" ")[0]),
                    unit: row.amount.split(" ")[1] || "mg",
                    isIVInfusion: row.route === "정맥",
                    infusionTime: row.injectionTime && row.injectionTime !== "-" ? parseInt(String(row.injectionTime).replace(/[^0-9]/g, "")) : (row.route === "정맥" ? 0 : undefined),
                    administrationTime: undefined,
                    intervalHours: intervalHours
                  };
                });
                const updatedAdministrations = [
                  ...drugAdministrations.filter(d => !(d.patientId === selectedPatient.id && d.drugName === tdmDrug?.drugName)),
                  ...mapped
                ];
                setDrugAdministrations(updatedAdministrations);
              }
            }}
          />
          
          <div className="flex justify-between mt-6">
            <Button variant="outline" type="button" onClick={onPrev} className="flex items-center gap-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200">
              <ArrowLeft className="h-4 w-4" />
              Lab
            </Button>
            {isCompleted && (
              <Button
                onClick={async () => {
                  if (!selectedPatient) { onNext(); return; }
                  
                  // 처방 내역 Summary 업데이트 필요 여부 확인
                  if (tableUpdateRef.current?.needsUpdate) {
                    const updateInfo = tableUpdateRef.current.updateInfo;
                    const message = `변경된 투약 기록으로 시뮬레이션을 진행합니다.\n(투약 횟수 ${updateInfo.conditionsTotalDoses}회 → ${updateInfo.tableRowCount}회)`;
                    const confirmed = window.confirm(message);
                    
                    if (!confirmed) {
                      return; // 사용자가 취소하면 시뮬레이션 진행하지 않음
                    }
                    
                    // 처방 내역 Summary 업데이트
                    const updated = tableUpdateRef.current.performUpdate();
                    if (!updated) {
                      console.warn("Failed to update conditions");
                    }
                  }
                  
                  setLoading(true);
                  try {
                    const body = buildTdmRequestBody({
                      patients,
                      prescriptions,
                      bloodTests,
                      drugAdministrations,
                      selectedPatientId: selectedPatient.id,
                      selectedDrugName: tdmDrug?.drugName,
                    });
                    if (!body) {
                      console.error('Failed to build TDM request body');
                      alert('TDM 요청 데이터를 생성할 수 없습니다. 환자 정보와 처방 정보를 확인해주세요.');
                      setLoading(false);
                      return;
                    }
                    console.log('TDM API Request Body:', JSON.stringify(body, null, 2));
                    await runTdmApi({ 
                      body, 
                      persist: true, 
                      patientId: selectedPatient.id,
                      drugName: tdmDrug?.drugName 
                    });
                    // API 호출 성공 시에만 다음 단계로 이동
                    setLoading(false);
                    onNext();
                  } catch (e) {
                    console.error('TDM API Error:', e);
                    alert(`TDM 분석 중 오류가 발생했습니다: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
                    setLoading(false);
                    // API 호출 실패 시 다음 단계로 이동하지 않음
                  }
                }}
                disabled={loading}
                className="flex items-center gap-2 w-[300px] bg-black dark:bg-blue-700 text-white font-bold text-lg py-3 px-6 justify-center dark:hover:bg-blue-800 disabled:opacity-60"
              >
                {loading ? '처리 중...' : 'TDM Simulation'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          
        </CardContent>
      </Card>
    </div>
  );
};

export default DrugAdministrationStep; 