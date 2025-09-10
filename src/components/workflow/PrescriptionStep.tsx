import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Patient, Prescription } from "@/pages/Index";
import { Pill, ArrowRight, ArrowLeft, CheckCircle, Plus } from "lucide-react";

interface PrescriptionStepProps {
  patients: Patient[];
  prescriptions: Prescription[];
  selectedPatient: Patient | null;
  onAddPrescription: (prescription: Prescription | undefined, updatedPrescriptions: Prescription[]) => void;
  onNext: () => void;
  onPrev: () => void;
  isCompleted: boolean;
  bloodTests: any[];
  drugAdministrations: any[];
  onClearLaterStepData: () => void;
}

const TDM_DRUGS = [
  { 
    name: "Vancomycin", 
    indications: ["패혈증(Sepsis)", "심내막염", "뼈관절감염", "폐렴", "복막염"], 
    additionalInfo: ["신기능", "체중", "나이", "감염 부위", "미생물 민감도"],
    targets: [
      { type: "Trough Concentration", value: "10-20 mg/L" },
      { type: "Peak Concentration", value: "25-40 mg/L" },
      { type: "AUC24", value: "400-600 mg·h/L" }
    ] 
  },
  { 
    name: "Cyclosporin", 
    indications: ["장기이식", "자가면역질환", "건선", "류마티스관절염"], 
    additionalInfo: ["신기능", "간기능", "혈압", "약물상호작용", "이식 후 경과"],
    targets: [
      { type: "Trough Concentration", value: "100-400 ng/mL" },
      { type: "Peak Concentration", value: "800-1200 ng/mL" },
      { type: "C2 Concentration", value: "1200-1700 ng/mL" }
    ] 
  }
];

const PrescriptionStep = ({
  patients,
  prescriptions,
  selectedPatient,
  onAddPrescription,
  onNext,
  onPrev,
  isCompleted,
  bloodTests,
  drugAdministrations,
  onClearLaterStepData
}: PrescriptionStepProps) => {
  const [formData, setFormData] = useState({
    drugName: "",
    indication: "",
    additionalInfo: "",
    tdmTarget: "",
    tdmTargetValue: ""
  });

  const patientPrescriptions = selectedPatient 
    ? prescriptions.filter(p => p.patientId === selectedPatient.id)
    : [];

  const selectedDrug = TDM_DRUGS.find(d => d.name === formData.drugName);
  const tdmTargets = selectedDrug ? selectedDrug.targets : [];
  const additionalInfoOptions = selectedDrug ? selectedDrug.additionalInfo : [];

  const handleDrugChange = (value: string) => {
    // 기존 약물명과 다른 경우 후속 단계 데이터 존재 여부 확인
    if (patientPrescriptions.length > 0 && patientPrescriptions[0].drugName !== value) {
      const hasLaterData = checkLaterStepData();
      if (hasLaterData) {
        const confirmed = window.confirm(
          "약물명을 변경하면 투약기록 데이터가 초기화됩니다.\n계속하시겠습니까?"
        );
        if (!confirmed) {
          return; // 변경 취소
        }
        // 사용자가 확인한 경우 후속 단계 데이터 초기화
        onClearLaterStepData();
      }
    }

    const drug = TDM_DRUGS.find(d => d.name === value);
    setFormData({
      drugName: value,
      indication: drug?.name === "Vancomycin" ? "패혈증(Sepsis)" : drug?.indications[0] || "",
      additionalInfo: "",
      tdmTarget: "Trough Concentration",
      tdmTargetValue: drug?.targets.find(t => t.type === "Trough Concentration")?.value || ""
    });
  };

  // 후속 단계(3단계 이상)에 데이터가 있는지 확인
  const checkLaterStepData = () => {
    if (!selectedPatient) return false;
    
    const hasBloodTests = bloodTests.some(test => test.patientId === selectedPatient.id);
    const hasDrugAdministrations = drugAdministrations.some(admin => admin.patientId === selectedPatient.id);
    
    return hasBloodTests || hasDrugAdministrations;
  };

  const handleTargetChange = (value: string) => {
    const target = tdmTargets.find(t => t.type === value);
    setFormData(prev => ({
      ...prev,
      tdmTarget: value,
      tdmTargetValue: target?.value || ""
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    const newPrescription: Prescription = {
      id: Date.now().toString(),
      patientId: selectedPatient.id,
      drugName: formData.drugName,
      dosage: 0,
      unit: "",
      frequency: "",
      startDate: new Date(),
      route: "",
      prescribedBy: "",
      indication: formData.indication,
      tdmTarget: formData.tdmTarget,
      tdmTargetValue: formData.tdmTargetValue
    };
    const filtered = prescriptions.filter(p => p.patientId !== selectedPatient.id);
    onAddPrescription(newPrescription, filtered);
    setFormData({
      drugName: "",
      indication: "",
      additionalInfo: "",
      tdmTarget: "",
      tdmTargetValue: ""
    });
  };

  const handleDelete = (id: string) => {
    if (!selectedPatient) return;
    const filtered = prescriptions.filter(p => !(p.id === id && p.patientId === selectedPatient.id));
    onAddPrescription(undefined, filtered);
  };

  if (!selectedPatient) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Pill className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Please select a patient first</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5" />
            2단계: TDM 약물정보
            {isCompleted && <CheckCircle className="h-5 w-5 text-green-600" />}
          </CardTitle>
          <CardDescription>
            {selectedPatient ? `${selectedPatient.name}의 TDM 약물 정보를 입력하세요.` : 'TDM 약물 정보를 입력하세요.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Existing Prescriptions */}
          {patientPrescriptions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>TDM 약물정보 ({patientPrescriptions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>약물명</TableHead>
                        <TableHead>적응증</TableHead>
                        {/* <TableHead>추가정보</TableHead> - 사용 여부 미정으로 비노출 */}
                        <TableHead>TDM 목표</TableHead>
                        <TableHead>TDM 목표치</TableHead>
                        <TableHead>삭제</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patientPrescriptions.map((prescription) => (
                        <TableRow key={prescription.id}>
                          <TableCell className="font-medium">{prescription.drugName}</TableCell>
                          <TableCell>{prescription.indication || "-"}</TableCell>
                          {/* <TableCell>{formData.additionalInfo || "-"}</TableCell> - 사용 여부 미정으로 비노출 */}
                          <TableCell>{prescription.tdmTarget || "-"}</TableCell>
                          <TableCell>{prescription.tdmTargetValue || "-"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(prescription.id)}>
                              <span className="sr-only">삭제</span>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add Prescription Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                TDM 약물 추가
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="drugName">약물명 *</Label>
                    <Select value={formData.drugName} onValueChange={handleDrugChange} required>
                      <SelectTrigger id="drugName">
                        <SelectValue placeholder="TDM 약물 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {TDM_DRUGS.map(drug => (
                          <SelectItem key={drug.name} value={drug.name}>{drug.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="indication">적응증 *</Label>
                    <Select value={formData.indication} onValueChange={(value) => setFormData(prev => ({ ...prev, indication: value }))} required disabled={!formData.drugName}>
                      <SelectTrigger id="indication">
                        <SelectValue placeholder="적응증 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedDrug?.indications.map(indication => (
                          <SelectItem key={indication} value={indication}>{indication}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* 추가정보 선택 드롭다운 - 사용 여부 미정으로 비노출
                  <div>
                    <Label htmlFor="additionalInfo">추가정보</Label>
                    <Select value={formData.additionalInfo} onValueChange={(value) => setFormData(prev => ({ ...prev, additionalInfo: value }))} disabled={!formData.drugName}>
                      <SelectTrigger id="additionalInfo">
                        <SelectValue placeholder="추가정보 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {additionalInfoOptions.map(info => (
                          <SelectItem key={info} value={info}>{info}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  */}
                  <div>
                    <Label htmlFor="tdmTarget">TDM 목표 *</Label>
                    <Select value={formData.tdmTarget} onValueChange={handleTargetChange} required disabled={!formData.drugName}>
                      <SelectTrigger id="tdmTarget">
                        <SelectValue placeholder="TDM 목표 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {tdmTargets.map(target => (
                          <SelectItem key={target.type} value={target.type}>{target.type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="tdmTargetValue">TDM 목표치 *</Label>
                    <Input id="tdmTargetValue" value={formData.tdmTargetValue} onChange={e => setFormData(prev => ({ ...prev, tdmTargetValue: e.target.value }))} placeholder="TDM 목표 선택 시 자동 입력, 수정 가능" required disabled={!formData.tdmTarget} />
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  TDM 약물 추가
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onPrev} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              환자 등록 및 선택
            </Button>
            {isCompleted && (
              <Button onClick={onNext} className="flex items-center gap-2 w-[300px] bg-black text-white font-bold text-lg py-3 px-6 justify-center">
                Lab
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrescriptionStep;
