import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Patient, Prescription } from "@/pages/Index";
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
  onAddPrescription: (prescription: Prescription | undefined, updatedPrescriptions: Prescription[]) => void;
  onNext: () => void;
  onPrev: () => void;
  isCompleted: boolean;
  bloodTests: any[];
  drugAdministrations: any[];
  onClearLaterStepData: () => void;
}

const TDM_DRUGS: TdmDrug[] = [
  { 
    name: "Vancomycin", 
    indications: ["Not specified/Korean", "Neurosurgical patients/Korean"], 
    additionalInfo: {
      default: ["신기능", "체중", "나이", "감염 부위", "미생물 민감도"],
      "Neurosurgical patients/Korean": [
        "복용 중인 약물 없음",
        "Nephrotoxic drugs including aminoglycosides (amikacin and tobramycin)",
        "Liposomal amphotericin B",
        "Antiviral agents (acyclovir, famciclovir and ganciclovir)",
        "Colistimethate",
        "Cytotoxic agents (cytosine arabinoside, fludarabine and idarubicin)",
        "Cyclosporine",
        "Tacrolimus",
        "Non-steroidal anti-inflammatory agents (aceclofenac, ibuprofen, ketoprofen, ketorolac and zaltoprofen)",
        "Trimethoprim/sulfamethoxazole"
      ]
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
      { type: "Peak Concentration", value: "800-1200 ng/mL" },
      { type: "C2 Concentration", value: "1200-1700 ng/mL" }
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

  const [selectedTdmId, setSelectedTdmId] = useState<string | null>(null);
  const [newlyAddedTdmId, setNewlyAddedTdmId] = useState<string | null>(null);

  // localStorage 키 생성
  const getStorageKey = () => selectedPatient ? `tdmfriends:prescription:${selectedPatient.id}` : null;

  // TDM 타입을 구분하는 헬퍼 함수들
  const isTempTdm = (prescriptionId: string): boolean => {
    return prescriptionId.startsWith('temp');
  };


  // 과거 데이터(테스트 데이터)가 아니면 모두 신규 데이터로 판단
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
    
    const storageKey = getStorageKey();
    if (!storageKey) return;

    try {
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed.selectedTdmId) {
          setSelectedTdmId(parsed.selectedTdmId);
          
          // selectedTdmId가 복원되면 해당 prescription을 찾아서 폼 데이터 설정
          // 이 시점에서는 아직 tempPrescriptions가 정의되지 않았으므로 직접 계산
          const currentPatientPrescriptions = selectedPatient 
            ? prescriptions.filter(p => p.patientId === selectedPatient.id)
            : [];
          
          // tempPrescriptions를 직접 정의 (중복 방지)
          const currentTempPrescriptions: Prescription[] = [
            {
              id: "temp1",
              patientId: selectedPatient?.id || "",
              drugName: "Vancomycin",
              dosage: 1000,
              unit: "mg",
              frequency: "q12h",
              startDate: new Date('2024-01-15'),
              route: "IV",
              prescribedBy: "Dr. Kim",
              indication: "패혈증(Sepsis)",
              tdmTarget: "Trough Concentration",
              tdmTargetValue: "10-20 mg/L",
              additionalInfo: ""
            },
            {
              id: "temp2",
              patientId: selectedPatient?.id || "",
              drugName: "Cyclosporin",
              dosage: 200,
              unit: "mg",
              frequency: "q12h",
              startDate: new Date('2024-01-20'),
              route: "oral",
              prescribedBy: "Dr. Lee",
              indication: "장기이식",
              tdmTarget: "Trough Concentration",
              tdmTargetValue: "100-400 ng/mL",
              additionalInfo: ""
            },
            {
              id: "temp3",
              patientId: selectedPatient?.id || "",
              drugName: "Vancomycin",
              dosage: 750,
              unit: "mg",
              frequency: "q8h",
              startDate: new Date('2024-02-01'),
              route: "IV",
              prescribedBy: "Dr. Park",
              indication: "심내막염",
              tdmTarget: "Peak Concentration",
              tdmTargetValue: "25-40 mg/L",
              additionalInfo: ""
            }
          ];
          
          const allPrescriptions = [...currentPatientPrescriptions, ...currentTempPrescriptions];
          const selectedPrescription = allPrescriptions.find(p => p.id === parsed.selectedTdmId);
          if (selectedPrescription) {
            const formDataFromPrescription = {
              drugName: selectedPrescription.drugName || "",
              indication: selectedPrescription.indication || "",
              additionalInfo: selectedPrescription.additionalInfo || "",
              tdmTarget: selectedPrescription.tdmTarget || "Trough Concentration",
              tdmTargetValue: selectedPrescription.tdmTargetValue || ""
            };
            setFormData(formDataFromPrescription);
          } else if (parsed.formData) {
            // prescription을 찾을 수 없는 경우에만 저장된 formData 사용
            setFormData(parsed.formData);
          }
        } else if (parsed.formData) {
          setFormData(parsed.formData);
        }
        
        if (parsed.newlyAddedTdmId) {
          setNewlyAddedTdmId(parsed.newlyAddedTdmId);
        }
      }
    } catch (error) {
      console.error('Failed to restore prescription data:', error);
    }
  }, [selectedPatient?.id, prescriptions.length]);

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
  }, [selectedTdmId, newlyAddedTdmId, formData, selectedPatient?.id]);

  // 신규 TDM이 추가되면 자동으로 선택되도록 하는 useEffect
  useEffect(() => {
    if (!selectedPatient || !newlyAddedTdmId) return;
    
    // 신규 추가된 TDM이 현재 선택되지 않은 상태라면 자동으로 선택
    if (selectedTdmId !== newlyAddedTdmId) {
      // prescriptions 배열에서 해당 ID의 TDM을 찾아서 선택
      const newTdm = prescriptions.find(p => p.id === newlyAddedTdmId && p.patientId === selectedPatient.id);
      if (newTdm) {
        setSelectedTdmId(newlyAddedTdmId);
      }
    }
  }, [prescriptions, newlyAddedTdmId, selectedPatient?.id, selectedTdmId]);

  // 테스트를 위한 임시 데이터이므로 추후 삭제해 주세요.
  const tempPrescriptions: Prescription[] = [
    {
      id: "temp1",
      patientId: selectedPatient?.id || "",
      drugName: "Vancomycin",
      dosage: 1000,
      unit: "mg",
      frequency: "q12h",
      startDate: new Date('2024-01-15'),
      route: "IV",
      prescribedBy: "Dr. Kim",
      indication: "Neurosurgical patients/Korean",
      tdmTarget: "Trough Concentration",
      tdmTargetValue: "10-20 mg/L",
      additionalInfo: ""
    },
    {
      id: "temp2",
      patientId: selectedPatient?.id || "",
      drugName: "Cyclosporin",
      dosage: 200,
      unit: "mg",
      frequency: "q12h",
      startDate: new Date('2024-01-20'),
      route: "oral",
      prescribedBy: "Dr. Lee",
      indication: "Allo-HSCT/Korean",
      tdmTarget: "Trough Concentration",
      tdmTargetValue: "100-400 ng/mL",
      additionalInfo: ""
    },
    {
      id: "temp3",
      patientId: selectedPatient?.id || "",
      drugName: "Vancomycin",
      dosage: 750,
      unit: "mg",
      frequency: "q8h",
      startDate: new Date('2024-02-01'),
      route: "IV",
      prescribedBy: "Dr. Park",
      indication: "Not specified/Korean",
      tdmTarget: "Peak Concentration",
      tdmTargetValue: "25-40 mg/L",
      additionalInfo: ""
    }
  ];

  const patientPrescriptions = selectedPatient 
    ? prescriptions.filter(p => p.patientId === selectedPatient.id)
    : [];

  // 실제 처방전과 임시 데이터를 합침
  const allPrescriptions = [...patientPrescriptions, ...tempPrescriptions];

  // TDM 내역 선택 시 폼에 자동 기입
  const handleTdmSelect = (prescription: Prescription) => {
    setSelectedTdmId(prescription.id);
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
  };

  const selectedDrug = TDM_DRUGS.find(d => d.name === formData.drugName);
  const tdmTargets = selectedDrug ? selectedDrug.targets : [];
  
  // 적응증에 따라 다른 additionalInfo 옵션 제공
  const getAdditionalInfoOptions = () => {
    if (!selectedDrug || !formData.indication) return [];
    
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
    
    
    // 신규 TDM은 1개만 허용 - 기존 신규 TDM이 있는지 확인
    const newlyAddedCount = getNewlyAddedTdmCount();
    if (newlyAddedCount > 0) {
      const confirmed = window.confirm("이미 신규 TDM이 등록되어 있습니다. 삭제 후 새로운 TDM을 추가하시겠습니까?");
      if (!confirmed) {
        return;
      }
      // 기존 신규 TDM만 삭제 (과거 데이터는 유지)
      const filtered = prescriptions.filter(p => !(p.patientId === selectedPatient.id && isNewlyAddedTdm(p.id)));
      onAddPrescription(undefined, filtered);
    }
    
    // 추가정보 필수 입력 체크
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
    
    const filtered = prescriptions.filter(p => !(p.id === id && p.patientId === selectedPatient.id));
    onAddPrescription(undefined, filtered);
    
    // 삭제된 TDM이 선택된 상태였다면 선택 해제
    if (selectedTdmId === id) {
      setSelectedTdmId(null);
    }
    
    // 삭제된 TDM이 새로 추가된 TDM이었다면 상태 초기화
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
          {allPrescriptions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>TDM 내역 ({allPrescriptions.length})</CardTitle>
                <CardDescription>기 수행된 TDM의 F/U TDM을 진행하신다면 아래 내역 중 선택해 주세요.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>등록일</TableHead>
                        <TableHead>약물명</TableHead>
                        <TableHead>적응증</TableHead>
                        <TableHead>추가정보</TableHead>
                        <TableHead>TDM 목표치</TableHead>
                        <TableHead>삭제</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allPrescriptions.map((prescription) => (
                          <TableRow 
                            key={prescription.id} 
                            className={`cursor-pointer hover:bg-blue-50/50 ${selectedTdmId === prescription.id ? "bg-blue-50" : ""}`}
                            onClick={() => handleTdmSelect(prescription)}
                          >
                            <TableCell>
                              {isNewlyAddedTdm(prescription.id) ? "등록 중" : (prescription.startDate ? new Date(prescription.startDate).toLocaleDateString('ko-KR') : "-")}
                            </TableCell>
                            <TableCell className="font-medium">{prescription.drugName}</TableCell>
                            <TableCell>{prescription.indication || "-"}</TableCell>
                            <TableCell>{prescription.additionalInfo || "-"}</TableCell>
                            <TableCell>{prescription.tdmTarget && prescription.tdmTargetValue ? `${prescription.tdmTarget}: ${prescription.tdmTargetValue}` : (prescription.tdmTargetValue || "-")}</TableCell>
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
                신규 TDM 추가
                {selectedTdmId && (() => {
                  const selectedPrescription = allPrescriptions.find(p => p.id === selectedTdmId);
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
                  
                  
                  {shouldShowAdditionalInfo() && (
                    <div>
                      <Label htmlFor="additionalInfo">
                        {getAdditionalInfoTitle()} {isAdditionalInfoRequired() ? "*" : ""}
                      </Label>
                      <Select 
                        value={formData.additionalInfo} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, additionalInfo: value }))} 
                        required={isAdditionalInfoRequired()}
                      >
                        <SelectTrigger id="additionalInfo">
                          <SelectValue placeholder={formData.indication === "Renal transplant recipients/Korean" ? "POD를 선택하세요" : "약물명 선택"} />
                        </SelectTrigger>
                        <SelectContent>
                          {additionalInfoOptions.map(info => (
                            <SelectItem key={info} value={info}>{info}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                 
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
                  TDM 추가
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
