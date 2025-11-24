import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Patient, Prescription, BloodTest, DrugAdministration } from "@/pages/Index";
import { Pill, ArrowRight, ArrowLeft, CheckCircle, Plus } from "lucide-react";

interface TdmDrug {
  name: string;
  indications: string[];
  additionalInfo: string[] | {
    default?: string[];
    [key: string]: string[] | undefined;
  };
  targets: Array<{
    type: string;
    value: string;
  }>;
  defaultTargets?: {
    [key: string]: {
      type: string;
      value: string;
    };
  };
}

interface PrescriptionStepProps {
  patients: Patient[];
  prescriptions: Prescription[];
  selectedPatient: Patient | null;
  selectedPrescription: Prescription | null;
  setSelectedPrescription: (prescription: Prescription | null) => void;
  onAddPrescription: (prescription: Prescription | undefined, updatedPrescriptions: Prescription[]) => void;
  onNext: () => void;
  onPrev: () => void;
  isCompleted: boolean;
  bloodTests: BloodTest[];
  setBloodTests: (bloodTests: BloodTest[]) => void;
  drugAdministrations: DrugAdministration[];
  setDrugAdministrations: (drugAdministrations: DrugAdministration[]) => void;
  onClearLaterStepData: () => void;
  onResetWorkflow: () => void;
}

// 신독성 약물 목록
const NEPHROTOXIC_DRUGS = [
  "복용 중인 약물 없음",
  "Nephrotoxic drugs including aminoglycosides (amikacin and tobramycin)",
  "Liposomal amphotericin B",
  "Antiviral agents (acyclovir, famciclovir and ganciclovir)",
  "Colistimethate",
  "Cytotoxic agents (cytosine arabinoside, fludarabine and idarubicin)",
  "Cyclosporin",
  "Tacrolimus",
  "Non-steroidal anti-inflammatory agents (aceclofenac, ibuprofen, ketoprofen, ketorolac and zaltoprofen)",
  "Trimethoprim/sulfamethoxazole",
  "기타"
];

const TDM_DRUGS: TdmDrug[] = [
  { 
    name: "Vancomycin", 
    indications: ["Not specified/Korean", "Neurosurgical patients/Korean"], 
    additionalInfo: {
      default: ["신기능", "체중", "나이", "감염 부위", "미생물 민감도"],
      "Neurosurgical patients/Korean": NEPHROTOXIC_DRUGS
    },
    targets: [
      { type: "Trough Concentration", value: "10-20 mg/L" },
      { type: "Peak Concentration", value: "25-40 mg/L" },
      { type: "AUC", value: "400-600 mg·h/L" }
    ],
    // 적응증별 default TDM 목표와 목표치
    defaultTargets: {
      "Not specified/Korean": { type: "AUC", value: "400-600 mg·h/L" },
      "Neurosurgical patients/Korean": { type: "AUC", value: "400-600 mg·h/L" }
    }
  },
  { 
    name: "Cyclosporin", 
    indications: ["Renal transplant recipients/Korean", "Allo-HSCT/Korean", "Thoracic transplant recipients/European"], 
    additionalInfo: {
      default: ["신기능", "간기능", "혈압", "약물상호작용", "이식 후 경과"],
      "Renal transplant recipients/Korean": ["POD ~2", "POD 3~6", "POD 7~"]
    },
    targets: [
      { type: "Trough Concentration", value: "100-400 ng/mL" },
      { type: "Peak Concentration", value: "800-1200 ng/mL" }
      // 모델링에서 사용하지 않는 데이터 삭제함: { type: "C2 Concentration", value: "1200-1700 ng/mL" }
    ],
    // 적응증별 default TDM 목표와 목표치
    defaultTargets: {
      "Allo-HSCT/Korean": { type: "Trough Concentration", value: "150-400 ng/mL" },
      "Thoracic transplant recipients/European": { type: "Trough Concentration", value: "170-230 ng/mL" },
      "Renal transplant recipients/Korean": { type: "Trough Concentration", value: "300-350 ng/mL" }
    }
  }
];

const PrescriptionStep = ({
  patients,
  prescriptions,
  selectedPatient,
  selectedPrescription,
  setSelectedPrescription,
  onAddPrescription,
  onNext,
  onPrev,
  isCompleted,
  bloodTests,
  setBloodTests,
  drugAdministrations,
  setDrugAdministrations,
  onClearLaterStepData,
  onResetWorkflow
}: PrescriptionStepProps) => {
  const [formData, setFormData] = useState({
    drugName: "",
    indication: "",
    additionalInfo: "",
    tdmTarget: "",
    tdmTargetValue: ""
  });

  const [showDrugListModal, setShowDrugListModal] = useState(false);
  const [nephrotoxicDrugAnswer, setNephrotoxicDrugAnswer] = useState<"네" | "아니오" | "">("");

  const [selectedTdmId, setSelectedTdmId] = useState<string | null>(null);
  const [newlyAddedTdmId, setNewlyAddedTdmId] = useState<string | null>(null);

  // TDM 타입을 구분하는 헬퍼 함수들
  const isTempTdm = (prescriptionId: string): boolean => {
    return prescriptionId.startsWith('temp');
  };


  // 새로 추가된 TDM인지 확인 (temp로 시작하지 않는 ID는 모두 신규)
  const isNewlyAddedTdm = (prescriptionId: string): boolean => {
    return !isTempTdm(prescriptionId);
  };

  const getTdmType = (prescription: Prescription): 'newly-added' | 'existing' => {
    if (isTempTdm(prescription.id)) return 'existing';
    return 'newly-added';
  };

  const getTdmTypeLabel = (prescription: Prescription): string => {
    const type = getTdmType(prescription);
    switch (type) {
      case 'newly-added':
        return '신규 추가';
      case 'existing':
        return '기존 TDM';
      default:
        return '';
    }
  };

  // 신규 TDM 개수 확인
  const getNewlyAddedTdmCount = (): number => {
    return patientPrescriptions.filter(p => isNewlyAddedTdm(p.id)).length;
  };

  // 컴포넌트 마운트 시 저장된 데이터 복원
  useEffect(() => {
    if (!selectedPatient) return;
    const storageKey = `tdmfriends:prescription:${selectedPatient.id}`;

    try {
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed.selectedTdmId) {
          setSelectedTdmId(parsed.selectedTdmId);
          // 선택된 TDM도 즉시 복원하여 하위 단계가 약물별 데이터를 로드할 수 있게 함
          const restored = prescriptions.find(p => p.id === parsed.selectedTdmId && p.patientId === selectedPatient.id);
          if (restored) {
            setSelectedPrescription(restored);
          }
        }
        
        if (parsed.newlyAddedTdmId) {
          setNewlyAddedTdmId(parsed.newlyAddedTdmId);
        }
      }
    } catch (error) {
      console.error('Failed to restore prescription data:', error);
    }
  }, [selectedPatient, prescriptions, setSelectedPrescription, selectedPatient?.id]);

  // selectedTdmId나 formData 변경 시 localStorage에 저장
  useEffect(() => {
    if (!selectedPatient) return;
    
    const storageKey = `tdmfriends:prescription:${selectedPatient.id}`;
    
    try {
      const dataToSave = {
        selectedTdmId,
        newlyAddedTdmId,
        formData
      };
      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Failed to save prescription data:', error);
    }
  }, [selectedTdmId, newlyAddedTdmId, formData, selectedPatient, selectedPatient?.id]);

  // selectedTdmId가 변경될 때, 상위의 selectedPrescription을 동기화
  useEffect(() => {
    if (!selectedPatient || !selectedTdmId) return;
    const p = prescriptions.find(x => x.id === selectedTdmId && x.patientId === selectedPatient.id);
    if (p) setSelectedPrescription(p);
  }, [selectedTdmId, prescriptions, selectedPatient, selectedPatient?.id, setSelectedPrescription]);

  // 신규 TDM이 추가되면 자동으로 선택되도록 하는 useEffect
  useEffect(() => {
    if (!selectedPatient || !newlyAddedTdmId) return;

    const newTdm = prescriptions.find(
      (p) => p.id === newlyAddedTdmId && p.patientId === selectedPatient.id
    );

    if (newTdm) {
      if (selectedTdmId !== newlyAddedTdmId) {
        setSelectedTdmId(newlyAddedTdmId);
      }
      setSelectedPrescription(newTdm);
    }
  }, [prescriptions, newlyAddedTdmId, selectedPatient, selectedPatient?.id, selectedTdmId, setSelectedPrescription]);

  const patientPrescriptions = selectedPatient 
    ? prescriptions.filter(p => p.patientId === selectedPatient.id)
    : [];

  const allPrescriptions = patientPrescriptions;

  // TDM 내역 선택 시 폼에 자동 기입
  const handleTdmSelect = (prescription: Prescription) => {
    setSelectedTdmId(prescription.id);
    setSelectedPrescription(prescription);
    // 기존 TDM을 선택할 때는 newlyAddedTdmId 클리어
    if (prescription.id !== newlyAddedTdmId) {
      setNewlyAddedTdmId(null);
    }
    
    // 폼 데이터 설정
    const newFormData = {
      drugName: prescription.drugName || "",
      indication: prescription.indication || "",
      additionalInfo: prescription.additionalInfo || "",
      tdmTarget: prescription.tdmTarget || "Trough Concentration",
      tdmTargetValue: prescription.tdmTargetValue || ""
    };
    
    setFormData(newFormData);
    
    // Neurosurgical patients/Korean인 경우 라디오 버튼 상태 초기화
    if (newFormData.drugName === "Vancomycin" && newFormData.indication === "Neurosurgical patients/Korean") {
      setNephrotoxicDrugAnswer(newFormData.additionalInfo === "복용 중인 약물 없음" ? "아니오" : newFormData.additionalInfo ? "네" : "");
    } else {
      setNephrotoxicDrugAnswer("");
    }
  };

  const selectedDrug = TDM_DRUGS.find(d => d.name === formData.drugName);
  const tdmTargets = selectedDrug ? selectedDrug.targets : [];
  
  // 적응증에 따라 다른 additionalInfo 옵션 제공
  const getAdditionalInfoOptions = () => {
    if (!selectedDrug || !formData.indication) return [];
    
    // Vancomycin + Not specified/Korean 조합일 때 투석여부 옵션 제공
    if (selectedDrug.name === "Vancomycin" && formData.indication === "Not specified/Korean") {
      return ["투석 안 함", "CRRT"];
    }
    
    // 적응증별로 다른 옵션이 있는 경우
    if (typeof selectedDrug.additionalInfo === 'object' && !Array.isArray(selectedDrug.additionalInfo)) {
      const indicationOptions = selectedDrug.additionalInfo[formData.indication];
      if (indicationOptions) {
        return indicationOptions;
      }
      
      // 기본 옵션 사용
      const defaultOptions = selectedDrug.additionalInfo.default;
      if (defaultOptions) {
        return defaultOptions;
      }
    }
    
    // 기존 배열 형태 (하위 호환성)
    if (Array.isArray(selectedDrug.additionalInfo)) {
      return selectedDrug.additionalInfo;
    }
    
    return [];
  };
  
  const additionalInfoOptions = getAdditionalInfoOptions();
  
  // 조건부 additionalInfo 노출 로직
  const shouldShowAdditionalInfo = () => {
    if (!selectedDrug || !formData.indication) return false;
    
    // Vancomycin + Not specified/Korean 조합
    if (selectedDrug.name === "Vancomycin" && formData.indication === "Not specified/Korean") {
      return true;
    }
    
    // Vancomycin + Neurosurgical patients/Korean 조합
    if (selectedDrug.name === "Vancomycin" && formData.indication === "Neurosurgical patients/Korean") {
      return true;
    }
    
    // Cyclosporin + Renal transplant recipients/Korean 조합
    if (selectedDrug.name === "Cyclosporin" && formData.indication === "Renal transplant recipients/Korean") {
      return true;
    }
    
    return false;
  };

  // 추가정보 필드 타이틀 결정
  const getAdditionalInfoTitle = () => {
    if (!selectedDrug || !formData.indication) return "추가정보";
    
    if (selectedDrug.name === "Vancomycin" && formData.indication === "Not specified/Korean") {
      return "투석여부(신 대체요법)";
    }
    
    if (selectedDrug.name === "Vancomycin" && formData.indication === "Neurosurgical patients/Korean") {
      return "복용 중인 약물";
    }
    
    if (selectedDrug.name === "Cyclosporin" && formData.indication === "Renal transplant recipients/Korean") {
      return "POD";
    }
    
    return "추가정보";
  };

  // 추가정보 필드 필수 여부 확인
  const isAdditionalInfoRequired = () => {
    if (selectedDrug?.name === "Vancomycin" && 
        formData.indication === "Not specified/Korean") {
      return true;
    }
    
    if (selectedDrug?.name === "Vancomycin" && 
        formData.indication === "Neurosurgical patients/Korean") {
      return true;
    }
    
    if (selectedDrug?.name === "Cyclosporin" && 
        formData.indication === "Renal transplant recipients/Korean") {
      return true;
    }
    
    return false;
  };

  const handleDrugChange = (value: string) => {
    // 기존 약물명과 다른 경우 후속 단계 데이터 존재 여부 확인
    if (patientPrescriptions.length > 0 && patientPrescriptions[0].drugName !== value) {
      const hasLaterData = checkLaterStepData();
      if (hasLaterData) {
        // 약물명 변경 시 투약기록 데이터 초기화 확인 기능 비활성화
        // const confirmed = window.confirm(
        //   "약물명을 변경하면 투약기록 데이터가 초기화됩니다.\n계속하시겠습니까?"
        // );
        // if (!confirmed) {
        //   return; // 변경 취소
        // }
        // 사용자가 확인한 경우 후속 단계 데이터 초기화
        onClearLaterStepData();
      }
    }

    const drug = TDM_DRUGS.find(d => d.name === value);
    const firstIndication = drug?.indications[0] || "";
    const defaultTarget = drug?.defaultTargets?.[firstIndication];
    
    setFormData({
      drugName: value,
      indication: firstIndication,
      additionalInfo: "",
      tdmTarget: defaultTarget?.type || "Trough Concentration",
      tdmTargetValue: defaultTarget?.value || drug?.targets.find(t => t.type === "Trough Concentration")?.value || ""
    });
    // 약물 변경 시 라디오 버튼 상태 초기화
    setNephrotoxicDrugAnswer("");
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
    
    
    // 신규 TDM은 약물별로 1개만 허용 - 해당 약물의 기존 신규 TDM 개수 확인
    const existingNewTdmsForDrug = prescriptions.filter(p => 
      p.patientId === selectedPatient.id && 
      p.drugName === formData.drugName && 
      isNewlyAddedTdm(p.id)
    );
    
    const hasExistingNewTdmForDrug = existingNewTdmsForDrug.length > 0;
    
    console.log('Debug - hasExistingNewTdmForDrug:', hasExistingNewTdmForDrug);
    console.log('Debug - formData.drugName:', formData.drugName);
    console.log('Debug - selectedPatient.id:', selectedPatient.id);
    console.log('Debug - prescriptions for patient:', prescriptions.filter(p => p.patientId === selectedPatient.id));
    console.log('Debug - newlyAddedTdmId:', newlyAddedTdmId);
    console.log('Debug - existingNewTdmsForDrug:', existingNewTdmsForDrug);
    
    if (hasExistingNewTdmForDrug) {
      const confirmed = window.confirm(`${formData.drugName}에 대한 신규 TDM이 이미 등록되어 있습니다. 삭제 후 새로운 TDM을 추가하시겠습니까?`);
      if (!confirmed) {
        return;
      }
      // 해당 약물의 기존 신규 TDM만 삭제 (과거 데이터는 유지)
      console.log('Debug - Before filtering, prescriptions:', prescriptions);
      
      // 같은 환자, 같은 약물의 모든 신규 TDM 삭제
      console.log('Debug - existingNewTdmsForDrug:', existingNewTdmsForDrug);
      
      const filtered = prescriptions.filter(p => {
        // 다른 환자의 데이터는 모두 유지
        if (p.patientId !== selectedPatient.id) {
          console.log(`Debug - Prescription ${p.id} (${p.drugName}): 다른 환자 - 유지`);
          return true;
        }
        
        // 다른 약물의 데이터는 모두 유지
        if (p.drugName !== formData.drugName) {
          console.log(`Debug - Prescription ${p.id} (${p.drugName}): 다른 약물 - 유지`);
          return true;
        }
        
        // 같은 환자, 같은 약물인 경우
        const isNewTdm = isNewlyAddedTdm(p.id);
        if (isNewTdm) {
          // 신규 TDM인 경우 - 모두 삭제
          console.log(`Debug - Prescription ${p.id} (${p.drugName}): 신규 TDM - 삭제`);
          return false;
        } else {
          // 과거 데이터는 모두 유지
          console.log(`Debug - Prescription ${p.id} (${p.drugName}): 과거 데이터 - 유지`);
          return true;
        }
      });
      
      console.log('Debug - filtered prescriptions:', filtered);
      
      // 기존 신규 TDM 삭제 후 새 TDM 추가
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
        tdmTargetValue: formData.tdmTargetValue,
        additionalInfo: formData.additionalInfo
      };
      
      const finalPrescriptions = [...filtered, newPrescription];
      onAddPrescription(undefined, finalPrescriptions);
      
      // 신규 추가된 TDM ID 설정 및 즉시 선택
      setNewlyAddedTdmId(newPrescription.id);
      setSelectedTdmId(newPrescription.id);
      setSelectedPrescription(newPrescription);
      
      // 폼 초기화
      setFormData({
        drugName: "",
        indication: "",
        additionalInfo: "",
        tdmTarget: "",
        tdmTargetValue: ""
      });
      
      return; // 함수 종료
    }
    
    // 기존 신규 TDM이 없는 경우의 로직
    // 추가정보 필수 입력 체크
    if (formData.drugName === "Vancomycin" && 
        formData.indication === "Not specified/Korean" && 
        !formData.additionalInfo) {
      alert(`투석여부(신 대체요법) 정보를 입력해주세요.`);
      return;
    }
    
    if (formData.drugName === "Vancomycin" && 
        formData.indication === "Neurosurgical patients/Korean" && 
        !formData.additionalInfo) {
      alert(`${formData.indication}의 경우 복용 중인 약물 정보를 입력해주세요.`);
      return;
    }
    
    if (formData.drugName === "Cyclosporin" && 
        formData.indication === "Renal transplant recipients/Korean" && 
        !formData.additionalInfo) {
      alert(`${formData.indication}의 경우 POD 정보를 입력해주세요.`);
      return;
    }
    
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
      tdmTargetValue: formData.tdmTargetValue,
      additionalInfo: formData.additionalInfo
    };
    const filtered = prescriptions.filter(p => p.patientId !== selectedPatient.id);
    onAddPrescription(newPrescription, filtered);
    
    // 신규 추가된 TDM ID 설정 및 즉시 선택
    setNewlyAddedTdmId(newPrescription.id);
    setSelectedTdmId(newPrescription.id);
    setSelectedPrescription(newPrescription);
    
    // 폼 초기화
    setFormData({
      drugName: "",
      indication: "",
      additionalInfo: "",
      tdmTarget: "",
      tdmTargetValue: ""
    });
    
    // localStorage는 클리어하지 않음 (새로 추가된 TDM이 선택된 상태로 유지)
  };

  const handleDelete = (id: string) => {
    if (!selectedPatient) return;
    
    // 신규 TDM만 삭제 가능
    if (!isNewlyAddedTdm(id)) {
      return;
    }
    
    // 삭제할 TDM 정보 찾기
    const prescriptionToDelete = prescriptions.find(p => p.id === id && p.patientId === selectedPatient.id);
    if (!prescriptionToDelete) return;
    
    // 진행 중인 TDM 삭제 확인 얼럿
    const confirmed = window.confirm(
      `${prescriptionToDelete.drugName} TDM이 진행 중입니다.\n\n` +
      `해당 TDM 내역을 삭제 시 관련된 Lab정보와 투약 기록, 시뮬레이션 데이터가 초기화 됩니다.\n\n` +
      `삭제하시겠습니까?`
    );
    
    if (!confirmed) return;
    
    // 해당 약품의 관련 데이터 삭제
    const drugName = prescriptionToDelete.drugName;
    
    // 1. 처방전 데이터 삭제
    const filtered = prescriptions.filter(p => !(p.id === id && p.patientId === selectedPatient.id));
    onAddPrescription(undefined, filtered);
    
    // 2. 혈중 약물 농도 데이터 삭제 (해당 약품만)
    const filteredBloodTests = bloodTests.filter(test => 
      !(test.patientId === selectedPatient.id && test.drugName === drugName)
    );
    setBloodTests(filteredBloodTests);
    
    // 3. 투약 기록 데이터 삭제 (해당 약품만)
    const filteredDrugAdministrations = drugAdministrations.filter(admin => 
      !(admin.patientId === selectedPatient.id && admin.drugName === drugName)
    );
    setDrugAdministrations(filteredDrugAdministrations);
    
    // 4. 로컬스토리지에서 신기능 데이터 삭제
    try {
      localStorage.removeItem(`tdmfriends:renal:${selectedPatient.id}:${drugName}`);
    } catch (error) {
      console.error('Failed to clear renal data from localStorage:', error);
    }
    
    // 5. 삭제 후 남아있는 최신 TDM 자동 선택
    const remainingPrescriptions = filtered.filter(p => p.patientId === selectedPatient.id);
    if (remainingPrescriptions.length > 0) {
      // 시간순으로 정렬하여 최신 TDM 선택
      const latestPrescription = remainingPrescriptions.sort((a, b) => {
        const timeA = parseInt(a.id);
        const timeB = parseInt(b.id);
        return timeB - timeA; // 최신순
      })[0];
      
      setSelectedTdmId(latestPrescription.id);
      setSelectedPrescription(latestPrescription);
      
      // 최신 TDM이 신규 추가된 것인지 확인
      if (isNewlyAddedTdm(latestPrescription.id)) {
        setNewlyAddedTdmId(latestPrescription.id);
      } else {
        setNewlyAddedTdmId(null);
      }
      
      // 폼 데이터 설정
      const newFormData = {
        drugName: latestPrescription.drugName || "",
        indication: latestPrescription.indication || "",
        additionalInfo: latestPrescription.additionalInfo || "",
        tdmTarget: latestPrescription.tdmTarget || "Trough Concentration",
        tdmTargetValue: latestPrescription.tdmTargetValue || ""
      };
      setFormData(newFormData);
    } else {
      // 남은 TDM이 없으면 선택 상태 초기화
      setSelectedTdmId(null);
      setSelectedPrescription(null);
    }
    
    // 6. 삭제된 TDM이 새로 추가된 TDM이었다면 상태 초기화
    if (id === newlyAddedTdmId) {
      setNewlyAddedTdmId(null);
    }
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
            2단계: TDM 선택
            {isCompleted && <CheckCircle className="h-5 w-5 text-green-600" />}
          </CardTitle>
          <CardDescription>
            {selectedPatient ? `${selectedPatient.name} 환자의 TDM 약물 정보를 입력하세요.` : 'TDM 약물 정보를 입력하세요.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Existing Prescriptions */}
          {patientPrescriptions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>TDM 내역 ({patientPrescriptions.length})</CardTitle>
                <CardDescription>기 수행된 TDM의 F/U TDM을 진행하신다면 아래 내역 중 선택해 주세요.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`rounded-md border ${selectedTdmId ? 'border-[#8EC5FF]' : ''}`}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>분석일</TableHead>
                        <TableHead>약물명</TableHead>
                        <TableHead>적응증</TableHead>
                        <TableHead>추가정보</TableHead>
                        <TableHead>TDM 목표치</TableHead>
                        <TableHead>삭제</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patientPrescriptions.map((prescription) => {
                        const isSelected = selectedTdmId === prescription.id;
                        return (
                          <TableRow 
                            key={prescription.id} 
                            className={`cursor-pointer hover:bg-muted/50 ${
                              isSelected 
                                ? 'bg-[#EFF6FF] border-l-4 border-l-[#8EC5FF]' 
                                : ''
                            }`}
                            onClick={() => handleTdmSelect(prescription)}
                          >
                            <TableCell>
                              {isSelected && (
                                <CheckCircle className="h-5 w-5 text-[#8EC5FF]" />
                              )}
                            </TableCell>
                            <TableCell className={isSelected ? 'font-bold text-[#333333]' : ''}>
                              {isNewlyAddedTdm(prescription.id) ? "진행 중" : (prescription.startDate ? new Date(prescription.startDate).toLocaleDateString('ko-KR') : "-")}
                            </TableCell>
                            <TableCell className={`${isSelected ? 'font-bold text-[#333333]' : 'font-medium'}`}>{prescription.drugName}</TableCell>
                            <TableCell className={isSelected ? 'font-bold text-[#333333]' : ''}>{prescription.indication || "-"}</TableCell>
                            <TableCell className={isSelected ? 'font-bold text-[#333333]' : ''}>
                              {prescription.additionalInfo
                                ? prescription.drugName === "Vancomycin" &&
                                  prescription.indication === "Neurosurgical patients/Korean"
                                  ? (prescription.additionalInfo === "복용 중인 약물 없음"
                                      ? "신독성 약물 복용 안 함"
                                      : "신독성 약물 복용 중")
                                  : prescription.additionalInfo
                                : "-"}
                            </TableCell>
                            <TableCell className={isSelected ? 'font-bold text-[#333333]' : ''}>{prescription.tdmTarget && prescription.tdmTargetValue ? `${prescription.tdmTarget}: ${prescription.tdmTargetValue}` : (prescription.tdmTargetValue || "-")}</TableCell>
                            <TableCell>
                              {/* 신규로 추가한 TDM만 삭제 가능 */}
                              {isNewlyAddedTdm(prescription.id) && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={(e) => {
                                    e.stopPropagation(); // 행 클릭 이벤트 방지
                                    handleDelete(prescription.id);
                                  }}
                                >
                                  <span className="sr-only">삭제</span>
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
                신규 TDM 추가
                {selectedTdmId && (() => {
                  const selectedPrescription = patientPrescriptions.find(p => p.id === selectedTdmId);
                  if (!selectedPrescription) return null;
                  
                  const tdmType = getTdmType(selectedPrescription);
                  // 기존 TDM 내역에서 선택된 경우에만 F/U 안내문 노출
                  if (tdmType !== 'existing') return null;
                  
                  const registrationDate = selectedPrescription.startDate 
                    ? new Date(selectedPrescription.startDate).toLocaleDateString('ko-KR')
                    : '';
                  return (
                    <span className="text-sm text-blue-600 font-normal">
                      ({registrationDate}에 진행한 TDM을 F/U합니다)
                    </span>
                  );
                })()}
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
                    <Label htmlFor="indication">적응증/Demographic *</Label>
                    <Select value={formData.indication} onValueChange={(value) => {
                      // 적응증별 default TDM 목표와 목표치 자동 설정
                      const defaultTarget = selectedDrug?.defaultTargets?.[value];
                      setFormData(prev => ({ 
                        ...prev, 
                        indication: value, 
                        additionalInfo: selectedTdmId ? prev.additionalInfo : "", // TDM 내역 선택 시에는 유지
                        tdmTarget: defaultTarget?.type || prev.tdmTarget,
                        tdmTargetValue: defaultTarget?.value || prev.tdmTargetValue
                      }));
                      // 적응증 변경 시 라디오 버튼 상태 초기화 (Neurosurgical patients/Korean인 경우만)
                      if (formData.drugName === "Vancomycin" && value === "Neurosurgical patients/Korean") {
                        setNephrotoxicDrugAnswer(selectedTdmId && formData.additionalInfo === "복용 중인 약물 없음" ? "아니오" : selectedTdmId && formData.additionalInfo && formData.additionalInfo !== "복용 중인 약물 없음" ? "네" : "");
                      } else {
                        setNephrotoxicDrugAnswer("");
                      }
                    }} required disabled={!formData.drugName}>
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
                  
                  {shouldShowAdditionalInfo() && (
                    <div className="md:col-span-2">
                      {formData.drugName === "Vancomycin" && formData.indication === "Neurosurgical patients/Korean" ? (
                        // 라디오 버튼으로 신독성 약물 복용 여부 선택
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label htmlFor="nephrotoxic-drug" className="font-bold">
                              신독성 약물을 복용 중인가요? {isAdditionalInfoRequired() ? "*" : ""}
                            </Label>
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-sm text-gray-600 underline"
                              onClick={() => setShowDrugListModal(true)}
                            >
                              약물 목록 보기
                            </Button>
                          </div>
                          <RadioGroup
                            value={nephrotoxicDrugAnswer || (formData.additionalInfo === "복용 중인 약물 없음" ? "아니오" : formData.additionalInfo && formData.additionalInfo !== "복용 중인 약물 없음" ? "네" : "")}
                            onValueChange={(value) => {
                              setNephrotoxicDrugAnswer(value as "네" | "아니오");
                              if (value === "아니오") {
                                setFormData(prev => ({ ...prev, additionalInfo: "복용 중인 약물 없음" }));
                              } else if (value === "네") {
                                // "네" 선택 시 신독성 약물 복용 중으로 처리 (첫 번째 약물을 기본값으로 설정)
                                const firstNephrotoxicDrug = NEPHROTOXIC_DRUGS.find(d => d !== "복용 중인 약물 없음" && d !== "기타");
                                setFormData(prev => ({ 
                                  ...prev, 
                                  additionalInfo: prev.additionalInfo && prev.additionalInfo !== "복용 중인 약물 없음" 
                                    ? prev.additionalInfo 
                                    : firstNephrotoxicDrug || ""
                                }));
                              }
                            }}
                            className="flex items-center space-x-6"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="네" id="yes" />
                              <Label htmlFor="yes">네</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="아니오" id="no" />
                              <Label htmlFor="no">아니오</Label>
                            </div>
                          </RadioGroup>
                        </div>
                      ) : (
                        // 라디오 버튼으로 추가정보 선택 (Not specified/Korean, POD 등)
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="font-bold">
                              {getAdditionalInfoTitle()} {isAdditionalInfoRequired() ? "*" : ""}
                            </Label>
                            {formData.drugName === "Vancomycin" && formData.indication === "Not specified/Korean" && (
                              <span className="text-sm text-muted-foreground">
                                Vancomycin의 Not specified/Korean 적응증에서는 CRRT 분석 모델만 지원됩니다.
                              </span>
                            )}
                          </div>
                          <RadioGroup
                            value={formData.additionalInfo}
                            onValueChange={(value) => {
                              setFormData(prev => ({ ...prev, additionalInfo: value }));
                            }}
                            className="flex flex-wrap gap-4"
                          >
                            {additionalInfoOptions.map((info, index) => (
                              <div key={info} className="flex items-center space-x-2">
                                <RadioGroupItem value={info} id={`additional-${index}`} />
                                <Label htmlFor={`additional-${index}`} className="cursor-pointer">
                                  {info}
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="pt-[30px]">
                  <Button type="submit" className="w-full">
                    TDM 추가
                  </Button>
                </div>
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
              <Button
                onClick={() => {
                  if (!selectedTdmId) {
                    alert("현재 진행 중인 TDM이 선택되어 있지 않습니다. TDM 내역을 선택한 후 다음 단계로 이동해주세요.");
                    return;
                  }
                  onNext();
                }}
                className="flex items-center gap-2 w-[300px] bg-black dark:bg-primary text-white dark:text-primary-foreground font-bold text-lg py-3 px-6 justify-center hover:bg-gray-800 dark:hover:bg-primary/90"
              >
                Lab
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 신독성 약물 목록 모달 */}
      <Dialog open={showDrugListModal} onOpenChange={setShowDrugListModal}>
        <DialogContent
          className="max-w-3xl max-h-[80vh] overflow-y-auto"
          onInteractOutside={() => setShowDrugListModal(false)}
        >
          <DialogHeader>
            <DialogTitle>
              신독성 약물 목록 ({NEPHROTOXIC_DRUGS.filter(drug => drug !== "복용 중인 약물 없음" && drug !== "기타").length})
            </DialogTitle>
            <DialogDescription>
              해당하는 약물이 있다면 "네"를 선택해주세요.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
            {NEPHROTOXIC_DRUGS
              .filter(drug => drug !== "복용 중인 약물 없음" && drug !== "기타")
              .map((drug, index) => (
                <li key={index} className="text-base text-foreground">
                  {drug}
                </li>
              ))}
          </ul>
          <div className="flex justify-end pt-4">
            <Button type="button" onClick={() => setShowDrugListModal(false)}>
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrescriptionStep;
