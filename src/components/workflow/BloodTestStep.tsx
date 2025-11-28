import { useEffect, useState, useRef } from "react";
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
import DateTimePicker from 'react-datetime-picker';
import 'react-datetime-picker/dist/DateTimePicker.css';
import 'react-calendar/dist/Calendar.css';
import 'react-clock/dist/Clock.css';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  const bloodDateTimeRef = useRef<HTMLDivElement | null>(null);
  const focusPickerInput = (ref: React.RefObject<HTMLDivElement>) => {
    if (!ref?.current) return;
    const input = ref.current.querySelector("input");
    if (input) {
      input.focus();
    }
  };

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
  
  // 다크모드 감지
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    const updateDark = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    updateDark();
    const observer = new MutationObserver(updateDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

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

  // 신기능 데이터 사용 여부 확인
  const shouldUseRenalData = () => {
    if (!selectedPrescription) return true; // 기본값은 사용
    
    // 조건1: Cyclosporin인 경우 신기능 데이터 사용 안 함
    if (selectedPrescription.drugName === "Cyclosporin") {
      return false;
    }
    
    // 조건2: Vancomycin + Not specified/Korean + CRRT인 경우 신기능 데이터 사용 안 함
    if (
      selectedPrescription.drugName === "Vancomycin" &&
      selectedPrescription.indication === "Not specified/Korean" &&
      selectedPrescription.additionalInfo === "CRRT"
    ) {
      return false;
    }
    
    // 그 외의 경우 신기능 데이터 필수 입력
    return true;
  };

  const useRenalData = shouldUseRenalData();

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
  const [showRenalModal, setShowRenalModal] = useState(false);
  const [alertModalShown, setAlertModalShown] = useState(false); // 모달이 이미 표시되었는지 추적
  const [editingRenalId, setEditingRenalId] = useState<string | null>(null); // 수정 중인 신기능 데이터 ID

  const patientBloodTests = selectedPatient && tdmDrug
    ? bloodTests.filter(b => b.patientId === selectedPatient.id && b.drugName === tdmDrug.drugName)
    : [];

  const today = dayjs().format("YYYY-MM-DD");

  // 투석환자 CRRT 환자 여부 확인 (PrescriptionStep의 additionalInfo 기준)
  const isCRRTPatient = () => {
    if (!selectedPatient || !selectedPrescription) return false;
    // PrescriptionStep에서 추가정보에 CRRT가 입력된 경우
    return selectedPrescription.additionalInfo?.toUpperCase() === "CRRT" || 
           selectedPrescription.additionalInfo?.toUpperCase().includes("CRRT");
  };

  // 날짜/시간 입력창 포커스 시 모달 표시
  const handleDateTimeFocus = () => {
    if (isCRRTPatient() && !alertModalShown) {
      setShowAlertModal(true);
      setAlertModalShown(true);
    }
  };

  const handleBloodTestDateTimeChange = (value: Date | null) => {
    if (!value) {
      setFormData(prev => ({ ...prev, testDate: "", testTime: "" }));
      return;
    }

    // DateTimePicker는 Date 객체를 반환
    const dateObj = value instanceof Date ? value : new Date(value);
    if (isNaN(dateObj.getTime())) {
      return;
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    const datePart = `${year}-${month}-${day}`;
    const timePart = `${hours}:${minutes}`;

    setFormData(prev => ({
      ...prev,
      testDate: datePart,
      testTime: timePart
    }));
  };

  // TDM 약물이 변경될 때마다 단위 업데이트
  useEffect(() => {
    const defaultUnit = tdmDrug?.drugName === "Vancomycin" ? "mg/L" : "ng/mL";
    setFormData(prev => ({ ...prev, unit: defaultUnit }));
  }, [tdmDrug?.drugName]);

  // TDM 선택이 변경되면 모달 표시 상태 리셋
  useEffect(() => {
    setAlertModalShown(false);
  }, [selectedPrescription?.id]);

  // 신기능 데이터 편집 모달 열기
  const handleEditRenal = (renalInfo: RenalInfo) => {
    setEditingRenalId(renalInfo.id);
    setRenalForm({
      creatinine: renalInfo.creatinine,
      date: renalInfo.date,
      formula: renalInfo.formula,
      result: renalInfo.result,
      dialysis: renalInfo.dialysis,
      renalReplacement: renalInfo.renalReplacement,
      isBlack: renalInfo.isBlack
    });
    setShowRenalModal(true);
  };

  const handleAddRenal = () => {
    // 필수 데이터 입력 체크
    if (!renalForm.creatinine || !renalForm.date || !renalForm.formula) {
      alert("신기능 데이터의 필수 항목을 모두 입력해주세요. (혈청 크레아티닌, 검사일, 계산식)");
      return;
    }

    if (editingRenalId) {
      // 수정 모드: 기존 항목 업데이트
      const updatedList = renalInfoList.map(item => 
        item.id === editingRenalId 
          ? { ...item, ...renalForm }
          : item
      );
      setRenalInfoList(updatedList);
    } else {
      // 추가 모드: 새 항목 추가
      const newRenalInfo: RenalInfo = {
        id: Date.now().toString(),
        ...renalForm,
        isSelected: true  // 새로 추가된 데이터는 자동으로 선택
      };
      
      // 기존 데이터들의 선택을 해제하고 새 데이터만 선택
      const updatedRenalInfoList = renalInfoList.map(item => ({ ...item, isSelected: false }));
      setRenalInfoList([...updatedRenalInfoList, newRenalInfo]);
    }
    
    // 신기능 데이터 추가/수정 후 폼 자동 초기화
    setRenalForm({
      creatinine: "",
      date: "",
      formula: "cockcroft-gault",
      result: "",
      dialysis: "N",
      renalReplacement: "",
      isBlack: false
    });
    
    // 모달 닫기 및 편집 상태 초기화
    setShowRenalModal(false);
    setEditingRenalId(null);
  };

  const handleDeleteRenal = (id: string) => {
    setRenalInfoList(renalInfoList.filter(item => item.id !== id));
  };

  // 혈청 크레아티닌 값으로 신기능 계산 함수
  const handleCalculateRenalResult = () => {
    if (renalForm.creatinine && selectedPatient) {
      const creatinine = parseFloat(renalForm.creatinine);
      if (!isNaN(creatinine) && creatinine > 0) {
        const result = calculateRenalFunction(creatinine, renalForm.formula, selectedPatient, renalForm.isBlack);
        setRenalForm(prev => ({ ...prev, result }));
      }
    }
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
    if (!formData.testDate || !formData.testTime || !formData.concentration) return;

    const combinedDateTime = `${formData.testDate}T${formData.testTime}`;
    const parsedDate = dayjs(combinedDateTime);

    if (!parsedDate.isValid()) {
      alert("날짜와 시간 형식이 올바르지 않습니다.");
      return;
    }

    if (parsedDate.isAfter(dayjs())) {
      alert("날짜는 현재 시각 이후로 입력할 수 없습니다.");
      return;
    }

    if (formData.testDate > today) {
      alert("날짜는 오늘 이후로 입력할 수 없습니다.");
      return;
    }

    const testDateTime = parsedDate.toDate();
    
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
    // 신기능 데이터 필수 입력인 경우 검증
    if (useRenalData) {
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
                  <span className="font-medium">성별:</span>{" "}
                  {selectedPatient.gender === "male"
                    ? "남성"
                    : selectedPatient.gender === "female"
                      ? "여성"
                      : "-"}
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
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <CardTitle>신기능 데이터 ({renalInfoList.length})</CardTitle>
                  <CardDescription>
                    체크박스를 선택하면 해당 신기능 데이터가 시뮬레이션에 반영됩니다.
                  </CardDescription>
                </div>
                <Button onClick={() => setShowRenalModal(true)} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  신규 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 신기능 데이터 테이블 */}
              <div className={`rounded-md border ${renalInfoList.some(item => item.isSelected) ? 'border-sky-300 dark:border-sky-700' : ''}`}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="text-center">검사일</TableHead>
                      <TableHead className="text-center">혈청 크레아티닌</TableHead>
                      <TableHead className="text-center">결과</TableHead>
                      <TableHead className="w-16">삭제</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* 기본 행 - 신기능 데이터 없음/필수 */}
                    {(() => {
                      const isNoRenalDataSelected = !useRenalData && renalInfoList.every(item => !item.isSelected);
                      return (
                        <TableRow className={isNoRenalDataSelected 
                          ? 'bg-sky-50 dark:bg-sky-900 border-l-4 border-l-sky-300 dark:border-l-sky-700' 
                          : ''}>
                          <TableCell>
                            {isNoRenalDataSelected && (
                              <CheckCircle className="h-5 w-5 text-sky-500 dark:text-sky-400" />
                            )}
                          </TableCell>
                          <TableCell 
                            colSpan={3} 
                            className={`text-center ${isNoRenalDataSelected ? 'font-bold text-[#333333] dark:text-white' : 'text-muted-foreground'}`}
                          >
                            {useRenalData 
                              ? "해당 TDM은 신기능 데이터를 필수 입력해야 합니다"
                              : "해당 TDM은 신기능 데이터를 사용하지 않습니다"
                            }
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      );
                    })()}
                    
                    {/* 신기능 데이터 행들 */}
                    {renalInfoList.map((renalInfo) => {
                      const isSelected = renalInfo.isSelected;
                      return (
                      <TableRow 
                        key={renalInfo.id}
                        className={`cursor-pointer hover:bg-muted/50 ${
                          isSelected 
                            ? 'bg-sky-50 dark:bg-sky-900 border-l-4 border-l-sky-300 dark:border-l-sky-700' 
                            : ''
                        }`}
                        onClick={(e) => {
                          // 삭제 버튼이나 체크 아이콘 영역이 아닌 경우에만 수정 모달 열기
                          const target = e.target as HTMLElement;
                          if (!target.closest('button') && !target.closest('svg') && !target.closest('circle')) {
                            handleEditRenal(renalInfo);
                          }
                        }}
                        onDoubleClick={(e) => {
                          // 더블클릭으로도 수정 모달 열기 가능
                          const target = e.target as HTMLElement;
                          if (!target.closest('button')) {
                            handleEditRenal(renalInfo);
                          }
                        }}
                      >
                        <TableCell 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenalSelectionChange(renalInfo.id, !isSelected);
                          }}
                        >
                          {isSelected && (
                            <CheckCircle className="h-5 w-5 text-sky-500 dark:text-sky-400" />
                          )}
                        </TableCell>
                        <TableCell className={`text-center ${isSelected ? 'font-bold text-[#333333] dark:text-white' : ''}`}>{renalInfo.date}</TableCell>
                        <TableCell className={`text-center ${isSelected ? 'font-bold text-[#333333] dark:text-white' : ''}`}>{renalInfo.creatinine} mg/dL</TableCell>
                        <TableCell className={`text-center ${isSelected ? 'font-bold text-[#333333] dark:text-white' : ''}`}>{renalInfo.result || "-"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRenal(renalInfo.id);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
                  <Label htmlFor="drugDateTime">채혈한 날짜/시간 </Label>
                  <div 
                    style={{ width: "100%" }}
                    onFocus={handleDateTimeFocus}
                    ref={bloodDateTimeRef}
                    onClick={() => {
                      focusPickerInput(bloodDateTimeRef);
                    }}
                  >
                    <DateTimePicker
                      onChange={handleBloodTestDateTimeChange}
                      value={
                        formData.testDate && formData.testTime
                          ? new Date(`${formData.testDate}T${formData.testTime}`)
                          : null
                      }
                      format="y-MM-dd HH:mm"
                      maxDate={new Date()}
                      disableClock={false}
                      clearIcon={null}
                      calendarIcon={null}
                      yearPlaceholder="연도"
                      monthPlaceholder="월"
                      dayPlaceholder="일"
                      hourPlaceholder="시"
                      minutePlaceholder="분"
                    />
                    <style>{`
                      .react-datetime-picker {
                        width: 100%;
                        height: 40px;
                      }
                      .react-datetime-picker__wrapper {
                        width: 100%;
                        height: 40px;
                        padding: 8px 12px;
                        border: ${isDarkMode ? "1px solid #334155" : "1px solid #ced4da"};
                        border-radius: 6px;
                        background-color: ${isDarkMode ? "#1e293b" : "#fff"};
                        color: ${isDarkMode ? "#e0e6f0" : "#495057"};
                        font-size: 14px;
                      }
                      .react-datetime-picker__inputGroup {
                        color: ${isDarkMode ? "#e0e6f0" : "#495057"};
                      }
                      .react-datetime-picker__inputGroup__input {
                        color: ${isDarkMode ? "#e0e6f0" : "#495057"};
                      }
                      .react-datetime-picker__inputGroup__input::placeholder {
                        color: ${isDarkMode ? "#6b7280" : "#9ca3af"};
                        opacity: 0.7;
                      }
                      .react-datetime-picker__button {
                        color: ${isDarkMode ? "#e0e6f0" : "#495057"};
                      }
                      .react-datetime-picker__button:hover {
                        background-color: ${isDarkMode ? "#334155" : "#f8f9fa"};
                      }
                      .react-calendar {
                        background-color: ${isDarkMode ? "#1e293b" : "#fff"};
                        color: ${isDarkMode ? "#e0e6f0" : "#495057"};
                        border: ${isDarkMode ? "1px solid #334155" : "1px solid #ced4da"};
                      }
                      .react-calendar__tile {
                        color: ${isDarkMode ? "#e0e6f0" : "#495057"};
                      }
                      .react-calendar__tile:enabled:hover {
                        background-color: ${isDarkMode ? "#334155" : "#f0f0f0"};
                      }
                      .react-calendar__tile--active {
                        background-color: ${isDarkMode ? "#0f172a" : "#000"};
                        color: #fff;
                      }
                      .react-clock {
                        background-color: ${isDarkMode ? "#1e293b" : "#fff"};
                        border: ${isDarkMode ? "1px solid #334155" : "1px solid #ced4da"};
                      }
                      .react-clock__face {
                        stroke: ${isDarkMode ? "#334155" : "#ced4da"};
                      }
                      .react-clock__hand {
                        stroke: ${isDarkMode ? "#e0e6f0" : "#495057"};
                      }
                      .react-clock__mark {
                        stroke: ${isDarkMode ? "#e0e6f0" : "#495057"};
                      }
                    `}</style>
                  </div>
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
                <Button type="submit">추가</Button>
              </form>
              {/* 입력된 혈중 약물 농도 리스트 */}
              {patientBloodTests.length > 0 && (
                <div className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>채혈 날짜</TableHead>
                        <TableHead>채혈 시간</TableHead>
                        <TableHead>농도</TableHead>
                        <TableHead className="w-16">삭제</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patientBloodTests.map((test) => (
                        <TableRow key={test.id}>
                          <TableCell>{test.testDate.toLocaleDateString()}</TableCell>
                          <TableCell>{test.testDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                          <TableCell>{test.concentration} {test.unit}</TableCell>
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
              <Button onClick={handleNext} className="flex items-center gap-2 w-[300px] bg-black dark:bg-primary text-white dark:text-primary-foreground font-bold text-lg py-3 px-6 justify-center hover:bg-gray-800 dark:hover:bg-primary/90">
                투약 기록
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 신기능 데이터 추가/수정 모달 */}
      <Dialog open={showRenalModal} onOpenChange={(open) => {
        setShowRenalModal(open);
        if (!open) {
          // 모달이 닫힐 때 편집 상태 초기화
          setEditingRenalId(null);
          setRenalForm({
            creatinine: "",
            date: "",
            formula: "cockcroft-gault",
            result: "",
            dialysis: "N",
            renalReplacement: "",
            isBlack: false
          });
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRenalId ? '신기능 데이터 수정' : '신기능 데이터 추가'}</DialogTitle>
            <DialogDescription>
              {editingRenalId ? '신기능 데이터를 수정하세요.' : '신기능 데이터를 입력하세요.'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleAddRenal(); }}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="modal-renalDate">검사일 *</Label>
                <Input
                  id="modal-renalDate"
                  type="date"
                  value={renalForm.date}
                  max={today}
                  onChange={e => setRenalForm({ ...renalForm, date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="modal-creatinine" className="whitespace-nowrap">혈청 크레아티닌 (mg/dL) *</Label>
                <Input
                  id="modal-creatinine"
                  type="number"
                  step="0.01"
                  value={renalForm.creatinine}
                  onChange={e => setRenalForm({ ...renalForm, creatinine: e.target.value })}
                  onBlur={handleCalculateRenalResult}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCalculateRenalResult();
                      // 계산 결과 필드로 포커스 이동
                      const resultInput = document.getElementById('modal-result');
                      if (resultInput) {
                        setTimeout(() => {
                          (resultInput as HTMLElement).focus();
                        }, 100);
                      }
                    }
                  }}
                  placeholder="예: 1.2"
                  required
                />
              </div>
              <div>
                <Label htmlFor="modal-renalFormula">계산식 *</Label>
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
              <div>
                <Label htmlFor="modal-result">계산 결과</Label>
                <Input
                  id="modal-result"
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
            </div>
            
            <DialogFooter className="justify-center sm:justify-center">
              <Button type="button" variant="outline" onClick={() => {
                setShowRenalModal(false);
                setEditingRenalId(null);
                setRenalForm({
                  creatinine: "",
                  date: "",
                  formula: "cockcroft-gault",
                  result: "",
                  dialysis: "N",
                  renalReplacement: "",
                  isBlack: false
                });
              }}>
                취소
              </Button>
              <Button type="submit">
                {editingRenalId ? '수정' : '추가'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 모달 얼럿 컴포넌트 */}
      {selectedPatient && isCRRTPatient() && (
        <AlertDialog open={showAlertModal} onOpenChange={setShowAlertModal}>
          <AlertDialogContent className="transform scale-[1.5]">
            <AlertDialogHeader>
              <AlertDialogTitle>
                 <div className="text-center">채혈 가이드</div>
              </AlertDialogTitle>
              <AlertDialogDescription>
                <div className="text-center">
                  {selectedPatient.name} 환자는 고위험군 환자입니다.
                  <br />
                  가이드에 맞게 채혈되었는지 확인 후 입력해 주세요.
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
                        {/* 체크 포인트 및 가이드 박스 */}
            <div className="flex items-center justify-center space-x-2 mt-4">
              {/* Check point 박스 */}
              <div className="border border-gray-200 rounded-lg p-4 bg-accent w-1/2">
                <h2 className="font-semibold text-lg text-center mb-2">Check point</h2>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>투석 여부: Y</li>
                  <li>신 대체요법: CRRT</li>
                </ul>
              </div>
              <ArrowRight className="h-6 w-6 text-gray-500" />
              {/* Guide 박스 */}
              <div className="border border-gray-200 rounded-lg p-4 bg-accent w-1/2">
                <h2 className="font-semibold text-lg text-center mb-2">Guide</h2>
                <ul className="text-sm space-y-1 text-center">
                  <li>투약 2시간 후 최고 흡수 농도 측정 권고(C2)</li>
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
