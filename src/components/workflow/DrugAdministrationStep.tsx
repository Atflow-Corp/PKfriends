import { useState, useEffect } from "react";
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
  const [previousDrugName, setPreviousDrugName] = useState<string>("");

  // 약물명 변경 감지 및 투약기록 데이터 초기화
  useEffect(() => {
    if (tdmDrug?.drugName && previousDrugName && tdmDrug.drugName !== previousDrugName) {
      // 약물명이 변경된 경우 투약기록 데이터 초기화
      const currentPatientAdministrations = drugAdministrations.filter(d => d.patientId === selectedPatient?.id);
      if (currentPatientAdministrations.length > 0) {
        // 해당 환자의 투약기록만 제거
        const filteredAdministrations = drugAdministrations.filter(d => d.patientId !== selectedPatient?.id);
        setDrugAdministrations(filteredAdministrations);
      }
    }
    setPreviousDrugName(tdmDrug?.drugName || "");
  }, [tdmDrug?.drugName, selectedPatient?.id, setDrugAdministrations]);

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

  // 기존 투약 기록을 table_maker 형식으로 변환
  const convertToTableMakerFormat = () => {
    return convertToTableMakerFormatWithData(patientDrugAdministrations);
  };

  // 투약 기록을 table_maker 형식으로 변환 (데이터를 매개변수로 받음)
  const convertToTableMakerFormatWithData = (administrations) => {
    if (administrations.length === 0) {
      return {
        conditions: [],
        tableData: [
          {
            id: "title",
            round: "회차",
            time: "투약 시간",
            amount: "투약용량",
            route: "투약경로",
            injectionTime: "주입시간",
            isTitle: true
          }
        ],
        isTableGenerated: false
      };
    }

    // 투약 기록을 시간순으로 정렬
    const sortedAdministrations = [...administrations].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA.getTime() - dateB.getTime();
    });

    // 테이블 데이터 생성
    const tableData = [
      {
        id: "title",
        round: "회차",
        time: "투약 시간",
        amount: "투약용량",
        route: "투약경로",
        injectionTime: "주입시간",
        isTitle: true
      },
      ...sortedAdministrations.map((admin, index) => ({
        id: admin.id,
        round: `${index + 1} 회차`,
        time: `${admin.date} ${admin.time}`,
        timeStr: `${admin.date} ${admin.time}`,
        amount: `${admin.dose} ${admin.unit}`,
        route: admin.route,
        injectionTime: admin.infusionTime ? `${admin.infusionTime}분` : "-",
        isTitle: false
      }))
    ];

    // 투약 기록에서 조건 추출 (같은 용량, 경로를 가진 그룹으로 분류)
    const conditions = [];
    const conditionGroups = new Map();
    
    sortedAdministrations.forEach((admin, index) => {
      const key = `${admin.dose}_${admin.unit}_${admin.route}_${admin.infusionTime || 'none'}`;
      
      if (!conditionGroups.has(key)) {
        // 같은 조건의 투약들만 필터링
        const sameConditionAdmins = sortedAdministrations.filter(a => 
          a.dose === admin.dose && 
          a.unit === admin.unit && 
          a.route === admin.route && 
          (a.infusionTime || 'none') === (admin.infusionTime || 'none')
        );
        
        // 투약 간격 계산 (같은 조건의 연속된 투약들 간의 평균 간격)
        let intervalHours = 0;
        if (sameConditionAdmins.length > 1) {
          const intervals = [];
          for (let i = 0; i < sameConditionAdmins.length - 1; i++) {
            const currentTime = new Date(`${sameConditionAdmins[i].date}T${sameConditionAdmins[i].time}`);
            const nextTime = new Date(`${sameConditionAdmins[i + 1].date}T${sameConditionAdmins[i + 1].time}`);
            const interval = Math.round((nextTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60));
            intervals.push(interval);
          }
          // 평균 간격 계산
          intervalHours = Math.round(intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length);
        }
        
        conditions.push({
          id: `condition_${key}_${Date.now()}`,
          route: admin.route,
          dosage: admin.dose.toString(),
          unit: admin.unit,
          intervalHours: intervalHours.toString(),
          injectionTime: admin.infusionTime ? `${admin.infusionTime}분` : "",
          firstDoseDate: admin.date,
          firstDoseTime: admin.time,
          totalDoses: sameConditionAdmins.length.toString()
        });
        
        conditionGroups.set(key, true);
      }
    });

    return {
      conditions: conditions,
      tableData: tableData,
      isTableGenerated: administrations.length > 0
    };
  };

  // patientDrugAdministrations가 변경될 때마다 tableMakerData 업데이트
  const [tableMakerData, setTableMakerData] = useState(() => convertToTableMakerFormat());
  
  useEffect(() => {
    const currentPatientAdministrations = drugAdministrations.filter(d => d.patientId === selectedPatient?.id);
    const newData = convertToTableMakerFormatWithData(currentPatientAdministrations);
    console.log('Updating tableMakerData:', newData);
    setTableMakerData(newData);
  }, [drugAdministrations, selectedPatient?.id]);

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
        <CardHeader>
          <CardTitle>투약 기록 입력</CardTitle>
        </CardHeader>
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
                
                // 새로운 레코드들을 한 번에 추가 (중복 방지)
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
                  infusionTime: row.injectionTime && row.injectionTime !== "-" ? Number(row.injectionTime) : undefined,
                  administrationTime: undefined
                }));
                
                // 기존 기록 제거 후 새 기록 추가 (한 번에 처리)
                const updatedAdministrations = [
                  ...drugAdministrations.filter(d => d.patientId !== selectedPatient.id),
                  ...newAdministrations
                ];
                setDrugAdministrations(updatedAdministrations);
                
                // 새로운 투약 기록으로 tableMakerData 즉시 업데이트
                const newPatientDrugAdministrations = updatedAdministrations.filter(d => d.patientId === selectedPatient.id);
                const newTableMakerData = convertToTableMakerFormatWithData(newPatientDrugAdministrations);
                setTableMakerData(newTableMakerData);
              }
            }}
            // 기존 데이터 복원을 위한 props 추가
            initialConditions={tableMakerData.conditions}
            initialTableData={tableMakerData.tableData}
            initialIsTableGenerated={tableMakerData.isTableGenerated}
          />
          <div className="flex justify-between mt-6">
            <Button variant="outline" type="button" onClick={onPrev} className="flex items-center gap-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200">
              <ArrowLeft className="h-4 w-4" />
              Lab
            </Button>
            <Button onClick={onNext} className="flex items-center gap-2 w-[300px] bg-black dark:bg-blue-700 text-white font-bold text-lg py-3 px-6 justify-center dark:hover:bg-blue-800">
              TDM Simulation
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DrugAdministrationStep; 