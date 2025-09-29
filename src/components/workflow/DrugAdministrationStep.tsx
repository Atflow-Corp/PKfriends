import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Patient, Prescription, DrugAdministration } from "@/pages/Index";
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
  const [conditions, setConditions] = useState<any[]>([]);

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
  const getStorageKey = () => selectedPatient ? `tdmfriends:conditions:${selectedPatient.id}` : null;

  // 컴포넌트 마운트 시 저장된 conditions 복원
  useEffect(() => {
    if (!selectedPatient) return;
    
    const storageKey = getStorageKey();
    if (!storageKey) return;

    try {
      const savedConditions = localStorage.getItem(storageKey);
      if (savedConditions) {
        const parsed = JSON.parse(savedConditions);
        console.log('Restoring conditions:', parsed);
        setConditions(parsed);
      } else {
        console.log('No saved conditions found');
      }
    } catch (error) {
      console.error('Failed to restore conditions:', error);
    }
  }, [selectedPatient?.id]);

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
  }, [conditions, selectedPatient?.id]);

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
        <CardContent>
          <div className="py-2 px-3 rounded bg-muted dark:bg-slate-800 text-base font-semibold mb-4">
            <div className="text-sm">
              <span className="text-muted-foreground">TDM 내역:</span> {tdmDrug?.drugName || "-"}, {tdmDrug?.indication || "-"}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-slate-900 border dark:border-slate-700 text-slate-900 dark:text-slate-200">
        <CardHeader>
          <CardTitle>투약 기록 입력</CardTitle>
        </CardHeader>
        <CardContent>
          {/* table_maker 테이블/입력 UI */}
          <TablePage
            tdmDrug={tdmDrug}
            onComplete={onNext}
            onTableGenerated={() => setTableReady(true)}
            initialAdministrations={patientDrugAdministrations}
            initialConditions={conditions}
            onConditionsChange={setConditions}
            onSaveRecords={(records) => {
              if (selectedPatient && tdmDrug) {
                const newAdministrations = records.map((row, idx) => ({
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
                  intervalHours: conditions.length > 0 ? Number(conditions[0].intervalHours) : undefined
                }));
                const updatedAdministrations = [
                  ...drugAdministrations.filter(d => !(d.patientId === selectedPatient.id && d.drugName === tdmDrug?.drugName)),
                  ...newAdministrations
                ];
                setDrugAdministrations(updatedAdministrations);
              }
            }}
            onRecordsChange={(records) => {
              if (selectedPatient && tdmDrug) {
                const mapped = records.map((row, idx) => ({
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
                  intervalHours: conditions.length > 0 ? Number(conditions[0].intervalHours) : undefined
                }));
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
            <Button
              onClick={async () => {
                if (!selectedPatient) { onNext(); return; }
                setLoading(true);
                try {
                  const body = buildTdmRequestBody({
                    patients,
                    prescriptions,
                    bloodTests: [],
                    drugAdministrations,
                    selectedPatientId: selectedPatient.id,
                    selectedDrugName: tdmDrug?.drugName,
                  });
                  if (body) {
                    await runTdmApi({ body, persist: true, patientId: selectedPatient.id });
                  }
                } catch (e) {
                  console.error(e);
                } finally {
                  setLoading(false);
                  onNext();
                }
              }}
              disabled={loading}
              className="flex items-center gap-2 w-[300px] bg-black dark:bg-blue-700 text-white font-bold text-lg py-3 px-6 justify-center dark:hover:bg-blue-800 disabled:opacity-60"
            >
              {loading ? '처리 중...' : 'TDM Simulation'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          
        </CardContent>
      </Card>
    </div>
  );
};

export default DrugAdministrationStep; 