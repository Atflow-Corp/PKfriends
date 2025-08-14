import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Patient, Prescription, DrugAdministration } from "@/pages/Index";
import dayjs from "dayjs";
import { ArrowLeft, ArrowRight, History, CheckCircle } from "lucide-react";
import TablePage from "./table_maker.jsx";
import "./table_maker.css";

interface DrugAdministrationStepProps {
  patients: Patient[];
  prescriptions: Prescription[];
  selectedPatient: Patient | null;
  onAddDrugAdministration: (drugAdministration: DrugAdministration) => void;
  setDrugAdministrations: (records: any[]) => void;
  drugAdministrations: DrugAdministration[];
  onNext: () => void;
  onPrev: () => void;
  isCompleted: boolean;
}

const DrugAdministrationStep = ({
  patients,
  prescriptions,
  selectedPatient,
  onAddDrugAdministration,
  setDrugAdministrations,
  drugAdministrations,
  onNext,
  onPrev,
  isCompleted
}: DrugAdministrationStepProps) => {
  // 2단계에서 입력한 TDM 약물 1개만 사용
  const tdmDrug = prescriptions.find(p => p.patientId === selectedPatient?.id);
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

  // 약물명은 상단에 텍스트로만 표시, 선택 불가
  // 날짜 오늘 이후 선택 불가
  const today = dayjs().format("YYYY-MM-DD");

  const handleChange = (key: keyof DrugAdministration, value: any) => {
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

  const patientDrugAdministrations = drugAdministrations.filter(d => d.patientId === selectedPatient?.id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            4단계: TDM 약물 투약력 입력
            {isCompleted && <CheckCircle className="h-5 w-5 text-green-600" />}
          </CardTitle>
          <CardDescription>
            2단계에서 입력한 TDM 약물에 대해 7반감기 이내의 투약력을 입력하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-2 px-3 rounded bg-muted dark:bg-slate-800 text-base font-semibold mb-4">
            약물명: {tdmDrug?.drugName || "-"}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-slate-900 border dark:border-slate-700 text-slate-900 dark:text-slate-200">
        <CardContent>
          {/* table_maker 테이블/입력 UI */}
          <TablePage
            tdmDrug={tdmDrug}
            onComplete={onNext}
            onTableGenerated={() => setTableReady(true)}
            onSaveRecords={(records) => {
              // records를 DrugAdministration 타입으로 변환하여 onAddDrugAdministration으로 추가
              if (selectedPatient && tdmDrug) {
                // 기존 투약 기록을 모두 삭제 (같은 환자의 기존 기록)
                const filteredAdministrations = drugAdministrations.filter(d => d.patientId !== selectedPatient.id);
                
                // 새로운 레코드들을 개별적으로 추가
                records.forEach((row, idx) => {
                  const newDrugAdministration = {
                    id: `${Date.now()}_${idx}`,
                    patientId: selectedPatient.id,
                    drugName: tdmDrug.drugName,
                    route: row.route,
                    date: row.timeStr.split(" ")[0],
                    time: row.timeStr.split(" ")[1],
                    dose: Number(row.amount.split(" ")[0]),
                    unit: row.amount.split(" ")[1] || "mg",
                    isIVInfusion: row.route === "정맥",
                    infusionTime: row.injectionTime && row.injectionTime !== "-" ? Number(row.injectionTime) : undefined,
                    administrationTime: undefined
                  };
                  onAddDrugAdministration(newDrugAdministration);
                });
              }
            }}
          />
          <div className="flex justify-between mt-6">
            <Button variant="outline" type="button" onClick={onPrev} className="flex items-center gap-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200">
              <ArrowLeft className="h-4 w-4" />
              Lab
            </Button>
            <div className="flex gap-4">
              <Button type="button" className="flex items-center gap-2 bg-black text-white hover:bg-gray-800">
                임시저장
              </Button>
              <Button onClick={onNext} className="flex items-center gap-2 w-[300px] bg-black dark:bg-blue-700 text-white font-bold text-lg py-3 px-6 justify-center dark:hover:bg-blue-800">
                TDM Simulation
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DrugAdministrationStep; 