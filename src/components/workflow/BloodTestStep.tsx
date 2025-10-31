import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Patient, BloodTest, Prescription } from "@/pages/Index";
import { FlaskConical, ArrowRight, ArrowLeft, CheckCircle, Plus, X } from "lucide-react";
import dayjs from "dayjs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface BloodTestStepProps {
  patients: Patient[];
  bloodTests: BloodTest[];
  selectedPatient: Patient | null;
  selectedPrescription: Prescription | null;
  onAddBloodTest: (bloodTest: BloodTest) => void;
  onDeleteBloodTest: (bloodTestId: string) => void;
  onUpdateBloodTest?: (bloodTestId: string, updates: Partial<BloodTest>) => void;
  onNext: () => void;
  onPrev: () => void;
  isCompleted: boolean;
  prescriptions: Prescription[];
}

// 신기능 정보 타입
interface RenalInfo {
  id: string;
  creatinine: string;
  date: string;
  formula: string;
  result: string;
  dialysis: "Y" | "N";
  renalReplacement: string;
  isSelected: boolean;
  isBlack: boolean; // 인종정보 필요 시 추가하며 임의로 흑인 아님으로 처리한다.
}

const BloodTestStep = ({
  patients,
  bloodTests,
  selectedPatient,
  selectedPrescription,
  onAddBloodTest,
  onDeleteBloodTest,
  onUpdateBloodTest = () => {},
  onNext,
  onPrev,
  isCompleted,
  prescriptions
}: BloodTestStepProps) => {
  // 신기능 입력 상태
  const [renalForm, setRenalForm] = useState<Omit<RenalInfo, 'id' | 'isSelected'>>({
    creatinine: "",
    date: "",
    formula: "cockcroft-gault",
    result: "",
    dialysis: "N",
    renalReplacement: "",
    isBlack: false // 인종정보 필요 시 추가하며 임의로 흑인 아님으로 처리한다.
  });
  const [renalInfoList, setRenalInfoList] = useState<RenalInfo[]>([]);
  const [renalHydrated, setRenalHydrated] = useState(false);

  // 신기능 계산 함수들
  const calculateRenalFunction = (creatinine: number, formula: string, patient: Patient, isBlack: boolean = false): string => {
    if (!creatinine || creatinine <= 0) return "";

    switch (formula) {
      case "cockcroft-gault":
        return calculateCockcroftGault(creatinine, patient.age, patient.weight, patient.height, patient.gender);
      case "mdrd":
        return calculateMDRD(creatinine, patient.age, patient.gender, isBlack);
      case "ckd-epi":
        return calculateCKDEPI(creatinine, patient.age, patient.gender, isBlack);
      default:
        return "";
    }
  };

  // 이상체중(IBW) 계산
  const calculateIBW = (height: number, gender: string): number => {
    if (gender === "여성") {
      return 45.5 + 0.9 * (height - 152);
    } else {
      return 50 + 0.9 * (height - 152);
    }
  };

  // 조정체중(AdjBW) 계산
  const calculateAdjBW = (actualWeight: number, idealWeight: number): number => {
    return idealWeight + 0.4 * (actualWeight - idealWeight);
  };

  // Cockcroft-Gault 공식 (고도비만 환자 조정체중 고려)
  const calculateCockcroftGault = (creatinine: number, age: number, weight: number, height: number, gender: string): string => {
    const genderFactor = gender === "여성" ? 0.85 : 1.0;
    
    // 이상체중 계산
    const idealWeight = calculateIBW(height, gender);
    
    // 고도비만 판단 (BMI > 30 또는 실제체중 > 이상체중의 120%)
    const bmi = weight / Math.pow(height / 100, 2);
    const isMorbidlyObese = bmi > 30 || weight > idealWeight * 1.2;
    
    // 체중 결정
    const adjustedWeight = isMorbidlyObese ? calculateAdjBW(weight, idealWeight) : weight;
    
    const ccr = ((140 - age) * adjustedWeight * genderFactor) / (72 * creatinine);
    
    // 조정체중 사용 여부 표시
    const weightInfo = isMorbidlyObese ? ` (조정체중: ${Math.round(adjustedWeight * 10) / 10}kg)` : "";
    return `CRCL = ${Math.round(ccr * 10) / 10} mL/min${weightInfo}`;
  };

  // MDRD 공식
  const calculateMDRD = (creatinine: number, age: number, gender: string, isBlack: boolean): string => {
    const genderFactor = gender === "여성" ? 0.742 : 1.0;
    const raceFactor = isBlack ? 1.212 : 1.0;
    const egfr = 175 * Math.pow(creatinine, -1.154) * Math.pow(age, -0.203) * genderFactor * raceFactor;
    return `eGFR = ${Math.round(egfr * 10) / 10} mL/min/1.73m²`;
  };

  // CKD-EPI 공식
  const calculateCKDEPI = (creatinine: number, age: number, gender: string, isBlack: boolean): string => {
    const isFemale = gender === "여성";
    const raceFactor = isBlack ? 1.212 : 1.0;
    
    let alpha, kappa, minCr, maxCr;
    
    if (isFemale) {
      alpha = -0.329;
      kappa = 0.7;
      minCr = 0.7;
      maxCr = 0.7;
    } else {
      alpha = -0.411;
      kappa = 0.9;
      minCr = 0.9;
      maxCr = 0.9;
    }

    const scr = Math.min(Math.max(creatinine / kappa, 1), 999);
    const egfr = 141 * Math.pow(scr, alpha) * Math.pow(0.993, age) * raceFactor;
    
    return `eGFR = ${Math.round(egfr * 10) / 10} mL/min/1.73m²`;
  };

  // BMI 계산
  const calculateBMI = (): string => {
    if (!selectedPatient?.weight || !selectedPatient?.height) return "N/A";
    const bmi = selectedPatient.weight / Math.pow(selectedPatient.height / 100, 2);
    return bmi.toFixed(1);
  };

  // BSA 계산 (Mosteller 공식)
  const calculateBSA = (): string => {
    if (!selectedPatient?.weight || !selectedPatient?.height) return "N/A";
    const bsa = Math.sqrt((selectedPatient.height * selectedPatient.weight) / 3600);
    return bsa.toFixed(2);
  };

  // 선택된 처방전 사용 (약품명 기준으로 데이터 분리)
  const tdmDrug = selectedPrescription;

  // Persist renal info list per patient & drug in localStorage (hydrate first, then allow writes)
  useEffect(() => {
    if (!selectedPatient || !tdmDrug) return;
    setRenalHydrated(false);
    try {
      const raw = window.localStorage.getItem(`tdmfriends:renal:${selectedPatient.id}:${tdmDrug.drugName}`);
      if (raw) {
        const parsed = JSON.parse(raw) as RenalInfo[];
        setRenalInfoList(parsed);
      } else {
        setRenalInfoList([]);
      }
    } catch (_err) {
      // no-op
    } finally {
      setRenalHydrated(true);
    }
  }, [selectedPatient?.id, tdmDrug?.drugName]);

  useEffect(() => {
    if (!selectedPatient || !tdmDrug || !renalHydrated) return;
    try {
      window.localStorage.setItem(`tdmfriends:renal:${selectedPatient.id}:${tdmDrug.drugName}`, JSON.stringify(renalInfoList));
    } catch (_err) { /* no-op */ }
  }, [selectedPatient?.id, tdmDrug?.drugName, renalInfoList, renalHydrated]);

  // 혈중 약물 농도 입력 상태
  const [formData, setFormData] = useState({
    testDate: "",
    testTime: "",
    concentration: "",
    unit: "ng/mL",
    measurementType: "Trough"
  });
  
  // 모달 상태 추가
  const [showAlertModal, setShowAlertModal] = useState(false);

  const patientBloodTests = selectedPatient && tdmDrug
    ? bloodTests.filter(b => b.patientId === selectedPatient.id && b.drugName === tdmDrug.drugName)
    : [];

  const today = dayjs().format("YYYY-MM-DD");

  // TDM 약물이 변경될 때마다 단위 업데이트
  useEffect(() => {
    const defaultUnit = tdmDrug?.drugName === "Vancomycin" ? "mg/L" : "ng/mL";
    setFormData(prev => ({ ...prev, unit: defaultUnit }));
  }, [tdmDrug?.drugName]);

  const handleAddRenal = () => {
    // 필수 데이터 입력 체크 (투석여부는 기본값 N이므로 검증에서 제외)
    if (!renalForm.creatinine || !renalForm.date || !renalForm.formula) {
      alert("신기능 데이터의 필수 항목을 모두 입력해주세요. (혈청 크레아티닌, 검사일, 투석여부)");
      return;
    }
    
    // 투석 여부가 Y일 때 신 대체요법 입력 체크
    if (renalForm.dialysis === "Y" && !renalForm.renalReplacement.trim()) {
      alert("신 대체요법을 입력해주세요.");
      return;
    }
    
    // 신 대체요법이 CRRT일 때만 모달 띄우기
    if (renalForm.renalReplacement.toUpperCase() === "CRRT") {
      setShowAlertModal(true);
    }

    const newRenalInfo: RenalInfo = {
      id: Date.now().toString(),
      ...renalForm,
      isSelected: true  // 새로 추가된 데이터는 자동으로 선택
    };
    
    // 기존 데이터들의 선택을 해제하고 새 데이터만 선택
    const updatedRenalInfoList = renalInfoList.map(item => ({ ...item, isSelected: false }));
    setRenalInfoList([...updatedRenalInfoList, newRenalInfo]);
    
    // 신기능 데이터 추가 후 폼 자동 초기화
    setRenalForm({
      creatinine: "",
      date: "",
      formula: "cockcroft-gault",
      result: "",
      dialysis: "N",
      renalReplacement: "",
      isBlack: false
    });
  };

  const handleDeleteRenal = (id: string) => {
    setRenalInfoList(renalInfoList.filter(item => item.id !== id));
  };


  const handleRenalSelectionChange = (id: string, checked: boolean) => {
    setRenalInfoList(renalInfoList.map(item => ({
      ...item,
      isSelected: item.id === id ? checked : false
    })));
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (!formData.testDate || !formData.concentration) return;
    // 날짜/시간 파싱: YYYY-MM-DD HH:mm 또는 12자리 숫자(YYYYMMDDHHmm) 모두 지원
    const compact = formData.testDate.trim().replace(/[-: ]/g, "");
    if (!/^\d{12}$/.test(compact)) {
      alert("날짜와 시간 형식이 올바르지 않습니다. 예: 2025-09-01 14:00 또는 202509011400");
      return;
    }
    const y = compact.slice(0, 4);
    const m = compact.slice(4, 6);
    const d = compact.slice(6, 8);
    const hh = compact.slice(8, 10);
    const mm = compact.slice(10, 12);
    const datePart = `${y}-${m}-${d}`;
    const timePart = `${hh}:${mm}`;
    // 오늘 이후 날짜 입력 방지
    if (datePart > today) {
      alert("날짜는 오늘 이후로 입력할 수 없습니다.");
      return;
    }
    const testDateTime = dayjs(`${datePart} ${timePart}`, "YYYY-MM-DD HH:mm").toDate();
    
    // 선택된 신기능 데이터 가져오기
    const selectedRenalInfo = renalInfoList.find(item => item.isSelected);
    
    const newBloodTest: BloodTest = {
      id: Date.now().toString(),
      patientId: selectedPatient.id,
      drugName: tdmDrug?.drugName || "",
      concentration: parseFloat(formData.concentration),
      unit: formData.unit,
      timeAfterDose: 0, // Lab 단계에서는 미사용
      testDate: testDateTime,
      measurementType: formData.measurementType,
      // 신기능 데이터 추가
      creatinine: selectedRenalInfo?.result || undefined,
      dialysis: selectedRenalInfo?.dialysis || undefined,
      renalReplacement: selectedRenalInfo?.renalReplacement || undefined
    };
    onAddBloodTest(newBloodTest);
    const defaultUnit = tdmDrug?.drugName === "Vancomycin" ? "mg/L" : "ng/mL";
    setFormData({ testDate: "", testTime: "", concentration: "", unit: defaultUnit, measurementType: "Trough" });
  };

  const handleNext = () => {
    // TDM이 반코마이신일 때 신기능 데이터 필수 입력 검증
    if (tdmDrug?.drugName === "Vancomycin") {
      const hasSelectedRenalData = renalInfoList.some(item => item.isSelected);
      if (!hasSelectedRenalData) {
        alert("신기능 데이터를 입력해주세요.");
        return;
      }
    }
    onNext();
  };

  if (!selectedPatient) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <FlaskConical className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">환자를 먼저 선택해 주세요.</p>
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
            <FlaskConical className="h-5 w-5" />
            3단계: Lab
            {isCompleted && <CheckCircle className="h-5 w-5 text-green-600" />}
          </CardTitle>
          <CardDescription>
            {selectedPatient ? `${selectedPatient.name} 환자의 신기능(혈청 크레아티닌)과 혈중 약물 농도 정보를 입력하세요.` : '신기능(혈청 크레아티닌)과 혈중 약물 농도 정보를 입력하세요.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* TDM 선택 정보 영역 */}
          {tdmDrug && selectedPatient && (
            <div className="py-3 px-4 rounded bg-muted dark:bg-slate-800 mb-4">
              {/* 1행: 환자 기본 정보 */}
              <div className="grid grid-cols-6 gap-4 mb-3">
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
                <div className="text-sm">
                  <span className="font-medium">BMI:</span> {calculateBMI()}
                </div>
                <div className="text-sm">
                  <span className="font-medium">BSA:</span> {calculateBSA()}
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
          
          {/* 신기능 데이터 */}
          <Card>
            <CardHeader>
              <CardTitle>신기능 데이터 ({renalInfoList.length})</CardTitle>
              <CardDescription>
                체크박스를 선택하면 해당 신기능 데이터가 시뮬레이션에 반영됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 신기능 데이터 테이블 */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">분석사용</TableHead>
                      <TableHead>혈청 크레아티닌</TableHead>
                      <TableHead>검사일</TableHead>
                      <TableHead>계산식</TableHead>
                      <TableHead>결과</TableHead>
                      <TableHead>투석 여부</TableHead>
                      <TableHead>신 대체요법</TableHead>
                      <TableHead className="w-16">삭제</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* 기본 행 - 신기능 데이터 없음 */}
                    <TableRow>
                      <TableCell>
                        <Checkbox 
                          checked={renalInfoList.every(item => !item.isSelected)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setRenalInfoList(renalInfoList.map(item => ({ ...item, isSelected: false })));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        해당 회차 TDM은 신기능 데이터를 사용하지 않습니다
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    
                    {/* 신기능 데이터 행들 */}
                    {renalInfoList.map((renalInfo) => (
                      <TableRow key={renalInfo.id}>
                        <TableCell>
                          <Checkbox 
                            checked={renalInfo.isSelected}
                            onCheckedChange={(checked) => handleRenalSelectionChange(renalInfo.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>{renalInfo.creatinine} mg/dL</TableCell>
                        <TableCell>{renalInfo.date}</TableCell>
                        <TableCell>{renalInfo.formula}</TableCell>
                        <TableCell>{renalInfo.result || "-"}</TableCell>
                        <TableCell>{renalInfo.dialysis}</TableCell>
                        <TableCell>
                          {renalInfo.dialysis === "Y" 
                            ? (renalInfo.renalReplacement || "-") 
                            : "N"
                          }
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRenal(renalInfo.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 신기능 데이터 추가 폼 */}
              <div className="border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Plus className="h-4 w-4" />
                  <h3 className="text-lg font-semibold">신기능 데이터 추가</h3>
                </div>
                <form className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="creatinine">혈청 크레아티닌 (mg/dL) *</Label>
                      <Input
                        id="creatinine"
                        type="number"
                        step="0.01"
                        value={renalForm.creatinine}
                        onChange={e => setRenalForm({ ...renalForm, creatinine: e.target.value })}
                        onBlur={() => {
                          if (renalForm.creatinine && selectedPatient) {
                            const creatinine = parseFloat(renalForm.creatinine);
                            if (!isNaN(creatinine)) {
                              const result = calculateRenalFunction(creatinine, renalForm.formula, selectedPatient, renalForm.isBlack);
                              setRenalForm(prev => ({ ...prev, result }));
                            }
                          }
                        }}
                        placeholder="예: 1.2"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="renalDate">검사일 *</Label>
                      <Input
                        id="renalDate"
                        type="date"
                        value={renalForm.date}
                        max={today}
                        onChange={e => setRenalForm({ ...renalForm, date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="renalFormula">계산식 *</Label>
                      <Select 
                        value={renalForm.formula} 
                        onValueChange={v => {
                          setRenalForm(prev => {
                            const newForm = { ...prev, formula: v };
                            // 계산식 변경 시 자동 계산
                            if (prev.creatinine && selectedPatient) {
                              const creatinine = parseFloat(prev.creatinine);
                              if (!isNaN(creatinine)) {
                                const result = calculateRenalFunction(creatinine, v, selectedPatient, prev.isBlack);
                                newForm.result = result;
                              }
                            }
                            return newForm;
                          });
                        }} 
                        required
                      >
                        <SelectTrigger><SelectValue placeholder="계산식 선택" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cockcroft-gault">Cockcroft-Gault</SelectItem>
                          <SelectItem value="mdrd">MDRD</SelectItem>
                          <SelectItem value="ckd-epi">CKD-EPI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="result">계산 결과</Label>
                      <Input
                        id="result"
                        value={renalForm.result}
                        onChange={e => {
                          // 자동계산된 값이 있고 사용자가 수정하려고 할 때 얼럿
                          if (renalForm.result && renalForm.result.includes("=") && e.target.value !== renalForm.result) {
                            const confirmed = window.confirm("자동계산된 데이터를 삭제하고 직접 입력하시겠습니까?");
                            if (!confirmed) {
                              return; // 취소 시 원래 값 유지
                            }
                          }
                          setRenalForm({ ...renalForm, result: e.target.value });
                        }}
                        placeholder="자동계산"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dialysis">투석 여부 *</Label>
                      <Select value={renalForm.dialysis} onValueChange={v => setRenalForm({ ...renalForm, dialysis: v as "Y" | "N" })} required>
                        <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="N">N</SelectItem>
                          <SelectItem value="Y">Y</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="renalReplacement">신 대체요법</Label>
                      <Select 
                        value={renalForm.renalReplacement} 
                        onValueChange={v => setRenalForm({ ...renalForm, renalReplacement: v })}
                        disabled={renalForm.dialysis === "N"}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="신 대체요법 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HD">HD</SelectItem>
                          <SelectItem value="CRRT">CRRT</SelectItem>
                          <SelectItem value="PD">PD</SelectItem>
                          <SelectItem value="기타">기타</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <Button type="button" onClick={handleAddRenal} className="w-full">
                    신기능 데이터 추가
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>

          {/* 혈중 약물 농도 입력 */}
          <Card>
            <CardHeader>
              <CardTitle>혈중 약물 농도</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
                <div>
                  <Label htmlFor="drugDateTime">날짜/시간</Label>
                  <Input
                    id="drugDateTime"
                    type="text"
                    value={formData.testDate}
                    placeholder="예: 2025-07-25 14:00 또는 202507251400"
                    onChange={e => setFormData({ ...formData, testDate: e.target.value })}
                    max={today + ' 23:59'}
                  />
                </div>
                <div>
                  <Label htmlFor="concentration">농도</Label>
                  <div className="flex gap-2">
                    <Input
                      id="concentration"
                      type="number"
                      step="0.01"
                      value={formData.concentration}
                      onChange={e => setFormData({ ...formData, concentration: e.target.value })}
                      className="flex-1"
                    />
                    <Select 
                      value={formData.unit} 
                      onValueChange={v => setFormData({ ...formData, unit: v })}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tdmDrug?.drugName === "Vancomycin" ? (
                          <>
                            <SelectItem value="mg/L">mg/L</SelectItem>
                          </>
                        ) : tdmDrug?.drugName === "Cyclosporin" ? (
                          <>
                            <SelectItem value="ng/mL">ng/mL</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="mg/L">mg/L</SelectItem>
                            <SelectItem value="ng/mL">ng/mL</SelectItem>
                            <SelectItem value="μg/L">μg/L</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="measurementType">측정 기준</Label>
                  <Select 
                    value={formData.measurementType} 
                    onValueChange={v => setFormData({ ...formData, measurementType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="측정 기준 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Trough">Trough</SelectItem>
                      <SelectItem value="Peak">Peak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit">추가</Button>
              </form>
              {/* 입력된 혈중 약물 농도 리스트 */}
              {patientBloodTests.length > 0 && (
                <div className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>날짜</TableHead>
                        <TableHead>시간</TableHead>
                        <TableHead>농도</TableHead>
                        <TableHead>측정 기준</TableHead>
                        <TableHead className="w-16">삭제</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patientBloodTests.map((test) => (
                        <TableRow key={test.id}>
                          <TableCell>{test.testDate.toLocaleDateString()}</TableCell>
                          <TableCell>{test.testDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                          <TableCell>{test.concentration} {test.unit}</TableCell>
                          <TableCell>{test.measurementType || "-"}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDeleteBloodTest(test.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onPrev} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              TDM 선택
            </Button>
            {isCompleted && (
              <Button onClick={handleNext} className="flex items-center gap-2 w-[300px] bg-black text-white font-bold text-lg py-3 px-6 justify-center">
                투약 기록
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 모달 얼럿 컴포넌트 */}
      {selectedPatient && (
        <AlertDialog open={showAlertModal} onOpenChange={setShowAlertModal}>
          <AlertDialogContent className="transform scale-[1.5]">
            <AlertDialogHeader>
              <AlertDialogTitle>
                 <div className="text-center">혈중 약물 농도 측정 가이드</div>
              </AlertDialogTitle>
              <AlertDialogDescription>
                <div className="text-center">
                  {selectedPatient.name} 환자는 고위험군 환자입니다.
                  <br />
                  가이드에 맞게 측정되었는지 확인 후 혈중 약물 농도를 입력해 주세요.
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
                        {/* 체크 포인트 및 가이드 박스 */}
            <div className="flex items-center justify-center space-x-2 mt-4">
              {/* Check point 박스 */}
              <div className="border border-gray-200 rounded-lg p-4 bg-accent w-1/2">
                <h2 className="font-semibold text-lg text-center mb-2">Check point</h2>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li className="text-gray-700">투석 여부: Y</li>
                  <li className="text-gray-700">신 대체요법: CRRT</li>
                </ul>
              </div>
              <ArrowRight className="h-6 w-6 text-gray-500" />
              {/* Guide 박스 */}
              <div className="border border-gray-200 rounded-lg p-4 bg-accent w-1/2">
                <h2 className="font-semibold text-lg text-center mb-2">Guide</h2>
                <ul className="text-sm space-y-1 text-center">
                  <li className="text-gray-700">투약 2시간 후 최고 흡수 농도 측정 권고(C2)</li>
                </ul>
              </div>
            </div>
            <AlertDialogFooter>
                <div className="flex justify-center w-full">
                  <AlertDialogAction onClick={() => setShowAlertModal(false)} className="w-[calc(100%)]">
                  확인
                  </AlertDialogAction>
                </div>

            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default BloodTestStep;
