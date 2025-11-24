import { useState, forwardRef, useImperativeHandle, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Patient, Prescription, BloodTest, DrugAdministration } from "@/pages/Index";
import { UserPlus, Edit, Eye, X, Search, Trash2, FileChartColumnIncreasing, ExternalLink, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { storage, STORAGE_KEYS } from "@/lib/storage";
import dayjs from "dayjs";
import { getTdmTargetValue } from "@/components/pk/shared/TDMChartUtils";

interface PatientInformationProps {
  onAddPatient: (patient: Patient) => void;
  onUpdatePatient: (patient: Patient) => void;
  onDeletePatient: (patientId: string) => void;
  patients: Patient[];
  selectedPatient: Patient | null;
  setSelectedPatient: (patient: Patient | null) => void;
  showHeader?: boolean;
}

export interface PatientInformationRef {
  openRegistrationModal: () => void;
  openEditModalForPatient: (patient: Patient) => void;
  openViewModalForPatient: (patient: Patient) => void;
}

interface PatientFormData {
  patientNo: string;
  name: string;
  gender: string;
  birth: string;
  age: string;
  weight: string;
  height: string;
  medicalHistory: string;
  allergies: string;
}

const PatientInformation = forwardRef<PatientInformationRef, PatientInformationProps>(({ 
  onAddPatient, 
  onUpdatePatient, 
  onDeletePatient,
  patients, 
  selectedPatient, 
  setSelectedPatient,
  showHeader = true
}, ref) => {
  const [formData, setFormData] = useState<PatientFormData>({
    patientNo: "",
    name: "",
    gender: "",
    birth: "",
    age: "",
    weight: "",
    height: "",
    medicalHistory: "",
    allergies: ""
  });
  const today = dayjs().format("YYYY-MM-DD");

  const [isEditing, setIsEditing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // TDM 분석 목록 관련 상태
  const [tdmPrescriptions, setTdmPrescriptions] = useState<Prescription[]>([]);
  const [selectedTdmPrescription, setSelectedTdmPrescription] = useState<Prescription | null>(null);

  // 환자 신규 등록
  const handleRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newPatient: Patient = {
      id: Date.now().toString(),
      name: formData.name,
      age: parseInt(formData.age),
      weight: parseFloat(formData.weight),
      height: parseFloat(formData.height),
      gender: formData.gender,
      medicalHistory: formData.medicalHistory,
      allergies: formData.allergies,
      birthDate: formData.birth,
      createdAt: new Date()
    };

    onAddPatient(newPatient);
    resetForm();
    setIsModalOpen(false);
  };

  // 환자 정보 수정
  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPatient) return;

    const updatedPatient: Patient = {
      ...selectedPatient,
      name: formData.name,
      age: parseInt(formData.age),
      weight: parseFloat(formData.weight),
      height: parseFloat(formData.height),
      gender: formData.gender,
      medicalHistory: formData.medicalHistory,
      allergies: formData.allergies,
    };

    onUpdatePatient(updatedPatient);
    resetForm();
    setIsModalOpen(false);
  };

  // 환자 정보 수정 모달 열기
  const openEditModal = (patient: Patient) => {
    setFormData({
      patientNo: patient.id,
      name: patient.name,
      gender: patient.gender,
      birth: patient.birthDate,
      age: patient.age.toString(),
      weight: patient.weight.toString(),
      height: patient.height.toString(),
      medicalHistory: patient.medicalHistory,
      allergies: patient.allergies
    });
    setSelectedPatient(patient);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  // TDM 분석 목록 로드
  const loadTdmPrescriptions = (patientId: string) => {
    try {
      const savedPrescriptions = storage.getJSON<Prescription[]>(STORAGE_KEYS.prescriptions, [] as Prescription[]);
      const patientPrescriptions = savedPrescriptions.filter(p => p.patientId === patientId);
      
      // 등록일 기준으로 내림차순 정렬 (최신순)
      const sortedPrescriptions = patientPrescriptions.sort((a, b) => {
        const dateA = new Date(a.startDate || a.id);
        const dateB = new Date(b.startDate || b.id);
        return dateB.getTime() - dateA.getTime();
      });
      
      setTdmPrescriptions(sortedPrescriptions);
    } catch (error) {
      console.error('TDM 분석 목록 로드 실패:', error);
      setTdmPrescriptions([]);
    }
  };

  // TDM 분석 선택 시 보고서 페이지로 이동
  const handleTdmSelection = (prescription: Prescription) => {
    if (!viewingPatient) return;
    
    // 선택된 약품 정보를 localStorage에 저장
    window.localStorage.setItem(`tdmfriends:selectedDrug:${viewingPatient.id}`, prescription.drugName);
    
    // TDMReportPage로 이동
    const reportUrl = `${window.location.origin}${window.location.pathname}report?patientId=${viewingPatient.id}`;
    window.open(reportUrl, '_blank');
    
    // 모달 닫기
    setIsViewModalOpen(false);
  };

  // TDM 결과 로드 함수 (prescription의 분석일시를 기준으로 가장 가까운 결과 찾기)
  const loadTdmResult = (patientId: string, drugName: string, prescriptionDate?: Date | string) => {
    try {
      // PKSimulation과 동일한 방식으로 로드 시도
      // 1. 약물별 최신 결과: tdmfriends:tdmResult:${patientId}:${drugName}
      const drugLatestKey = `tdmfriends:tdmResult:${patientId}:${drugName}`;
      const drugLatestRaw = window.localStorage.getItem(drugLatestKey);
      
      // 2. 환자별 최신 결과: tdmfriends:tdmResult:${patientId} (PKSimulation에서 사용)
      const patientLatestKey = `tdmfriends:tdmResult:${patientId}`;
      const patientLatestRaw = window.localStorage.getItem(patientLatestKey);
      
      // 3. 히스토리 배열 확인 (여러 결과 중에서 선택)
      const historyKey = `tdmfriends:tdmResults:${patientId}:${drugName}`;
      const historyRaw = window.localStorage.getItem(historyKey);
      
      // 약물별 최신 결과가 있으면 우선 사용
      if (drugLatestRaw) {
        const result = JSON.parse(drugLatestRaw);
        console.log('약물별 최신 TDM 결과 로드:', {
          keys: Object.keys(result).slice(0, 20),
          hasAUC_24: 'AUC_24_before' in result,
          hasAUC_tau: 'AUC_tau_before' in result,
          AUC_24_before: result.AUC_24_before,
          CMAX_before: result.CMAX_before,
          CTROUGH_before: result.CTROUGH_before
        });
        return result;
      }
      
      // 히스토리 확인
      if (historyRaw) {
        const historyList = JSON.parse(historyRaw) as Array<{
          id: string;
          timestamp: string;
          data?: any;
          summary?: any;
        }>;
        
        if (historyList && historyList.length > 0) {
          // 날짜가 있으면 가장 가까운 항목 찾기, 없으면 최신 항목 사용
          let targetEntry = historyList[historyList.length - 1]; // 기본적으로 최신 항목
          
          if (prescriptionDate) {
            const prescriptionDateTime = new Date(prescriptionDate).getTime();
            let closestEntry = historyList[0];
            let minDiff = Math.abs(new Date(historyList[0].timestamp).getTime() - prescriptionDateTime);
            
            for (const entry of historyList) {
              const entryTime = new Date(entry.timestamp).getTime();
              const diff = Math.abs(entryTime - prescriptionDateTime);
              if (diff < minDiff) {
                minDiff = diff;
                closestEntry = entry;
              }
            }
            targetEntry = closestEntry;
          }
          
          // summary와 data 병합 (data에 summary가 포함되어 있을 수 있음)
          let result = targetEntry.data || targetEntry.summary || null;
          if (targetEntry.data && targetEntry.summary) {
            result = { ...targetEntry.data, ...targetEntry.summary };
          }
          
          console.log('히스토리에서 찾은 TDM 결과:', {
            hasResult: !!result,
            resultKeys: result ? Object.keys(result).slice(0, 20) : [],
            hasSummary: !!targetEntry.summary,
            hasData: !!targetEntry.data,
            summaryKeys: targetEntry.summary ? Object.keys(targetEntry.summary).slice(0, 20) : [],
            dataKeys: targetEntry.data ? Object.keys(targetEntry.data).slice(0, 20) : [],
            AUC_24_before: result?.AUC_24_before,
            CMAX_before: result?.CMAX_before,
            CTROUGH_before: result?.CTROUGH_before
          });
          
          return result;
        }
      }
      
      // 환자별 최신 결과 사용 (PKSimulation fallback)
      if (patientLatestRaw) {
        const result = JSON.parse(patientLatestRaw);
        console.log('환자별 최신 TDM 결과 사용:', {
          keys: Object.keys(result).slice(0, 20),
          AUC_24_before: result.AUC_24_before,
          CMAX_before: result.CMAX_before,
          CTROUGH_before: result.CTROUGH_before
        });
        return result;
      }
      
      console.warn('TDM 결과를 찾을 수 없음:', { 
        patientId, 
        drugName, 
        prescriptionDate,
        checkedKeys: [drugLatestKey, patientLatestKey, historyKey]
      });
    } catch (error) {
      console.error('TDM 결과 로드 실패:', error);
    }
    return null;
  };

  // TDM 목표 포맷팅 함수
  const formatTdmTarget = (prescription: Prescription, tdmResult: any) => {
    const { tdmTarget, tdmTargetValue, drugName } = prescription;
    
    if (!tdmTarget || !tdmTargetValue) {
      return '-';
    }

    // TDM 목표 유형 추출 (AUC, Max, Trough)
    const targetTypeLabel = (() => {
      const target = tdmTarget.toLowerCase();
      if (target.includes('auc')) return 'AUC';
      if (target.includes('max') || target.includes('peak')) return 'Max';
      if (target.includes('trough')) return 'Trough';
      return '';
    })();

    // TDM 결과에서 예측값 추출 (모든 가능한 필드명 확인)
    // 실제 저장된 필드명: AUC_24_before, AUC_tau_before, CMAX_before, CTROUGH_before 등
    const predictedAUC = tdmResult?.AUC_24_before || tdmResult?.AUC_tau_before || tdmResult?.AUC24h_before || tdmResult?.AUCtau_before || null;
    const predictedMax = tdmResult?.CMAX_before || tdmResult?.CMax_before || null;
    const predictedTrough = tdmResult?.CTROUGH_before || tdmResult?.CTrough_before || null;
    
    // 디버깅: TDM 결과가 없거나 예측값을 추출하지 못한 경우
    if (!tdmResult || (!predictedAUC && !predictedMax && !predictedTrough)) {
      console.warn('TDM 결과 예측값 추출 실패:', {
        hasTdmResult: !!tdmResult,
        tdmResultType: typeof tdmResult,
        tdmResultKeys: tdmResult ? Object.keys(tdmResult).slice(0, 20) : [],
        prescription: { drugName, tdmTarget, tdmTargetValue },
        predictedValues: { predictedAUC, predictedMax, predictedTrough }
      });
    }

    // targetHighlight 계산
    const targetHighlight = getTdmTargetValue(tdmTarget, predictedAUC, predictedMax, predictedTrough, drugName);

    // 목표 범위 상태 계산
    const targetRangeStatus = (() => {
      if (!tdmTargetValue || !targetHighlight.numericValue) {
        if (targetHighlight.numericValue === null) {
          console.warn('targetHighlight.numericValue가 null:', {
            tdmTarget,
            predictedAUC,
            predictedMax,
            predictedTrough,
            targetHighlight
          });
        }
        return null;
      }
      
      const rangeMatch = tdmTargetValue.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
      if (!rangeMatch) {
        console.warn('목표 범위 파싱 실패:', tdmTargetValue);
        return null;
      }
      
      const minValue = parseFloat(rangeMatch[1]);
      const maxValue = parseFloat(rangeMatch[2]);
      const currentValue = targetHighlight.numericValue;
      
      if (currentValue > maxValue) return '초과';
      if (currentValue < minValue) return '미달';
      return '도달';
    })();

    // 포맷팅된 텍스트 반환
    if (targetHighlight.numericValue != null && targetRangeStatus) {
      return `${targetTypeLabel} ${targetHighlight.value} 으로 목표범위 ${targetRangeStatus}`;
    }
    
    // Fallback: TDM 결과가 없거나 예측값을 추출하지 못한 경우
    return targetTypeLabel ? `${targetTypeLabel} ${tdmTargetValue}` : tdmTargetValue;
  };

  // 항정상태 포맷팅 함수
  const formatSteadyState = (tdmResult: any) => {
    if (!tdmResult || tdmResult.Steady_state === undefined) {
      return '-';
    }
    
    const steadyState = tdmResult.Steady_state;
    const isSteadyState = typeof steadyState === 'boolean' 
      ? steadyState 
      : String(steadyState).toLowerCase() === 'true';
    
    return isSteadyState ? '도달' : '미도달';
  };

  // 환자 정보 조회 모달 열기
  const openViewModal = (patient: Patient) => {
    setViewingPatient(patient);
    loadTdmPrescriptions(patient.id);
    setIsViewModalOpen(true);
  };

  // 환자 삭제
  const handleDelete = () => {
    if (selectedPatient) {
      onDeletePatient(selectedPatient.id);
      resetForm();
      setIsModalOpen(false);
    }
  };

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      patientNo: "",
      name: "",
      gender: "",
      birth: "",
      age: "",
      weight: "",
      height: "",
      medicalHistory: "",
      allergies: ""
    });
    setIsEditing(false);
    setSelectedPatient(null);
    setIsModalOpen(false);
  };

  // 신규 환자 등록 모달 열기
  const openNewPatientModal = () => {
    setFormData({
      patientNo: "",
      name: "",
      gender: "",
      birth: "",
      age: "",
      weight: "",
      height: "",
      medicalHistory: "",
      allergies: ""
    });
    setIsEditing(false);
    setSelectedPatient(null);
    setIsModalOpen(true);
  };

  // 외부에서 사용할 수 있도록 함수들을 export
  const openRegistrationModal = () => {
    setFormData({
      patientNo: "",
      name: "",
      gender: "",
      birth: "",
      age: "",
      weight: "",
      height: "",
      medicalHistory: "",
      allergies: ""
    });
    setIsEditing(false);
    setSelectedPatient(null);
    setIsModalOpen(true);
  };

  const openEditModalForPatient = (patient: Patient) => {
    openEditModal(patient);
  };

  const openViewModalForPatient = (patient: Patient) => {
    openViewModal(patient);
  };

  // 생년월일 변경 시 나이 자동 계산
  const handleBirthChange = (value: string) => {
    setFormData((prev) => {
      const birth = value;
      const birthDayjs = birth ? dayjs(birth) : null;
      const age = birthDayjs?.isValid() ? dayjs().diff(birthDayjs, "year").toString() : "";
      return { ...prev, birth, age };
    });
  };

  // BMI 계산
  const calcBMI = () => {
    const w = parseFloat(formData.weight);
    const h = parseFloat(formData.height);
    if (!w || !h) return "";
    return (w / Math.pow(h / 100, 2)).toFixed(1);
  };

  // BSA 계산
  const calcBSA = () => {
    const w = parseFloat(formData.weight);
    const h = parseFloat(formData.height);
    if (!w || !h) return "";
    // Mosteller formula
    return Math.sqrt((w * h) / 3600).toFixed(2);
  };

  // 환자 검색 필터링
  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.id.includes(searchTerm)
  );

  // ref를 통해 외부에서 호출할 수 있는 함수들 노출
  useImperativeHandle(ref, () => ({
    openRegistrationModal,
    openEditModalForPatient,
    openViewModalForPatient
  }));

  return (
    <div className="space-y-6">
      {/* 헤더 및 액션 버튼들 */}
      <div className="flex justify-between items-center">
        {showHeader && (
          <div>
            <h2 className="text-2xl font-bold">환자 정보 관리</h2>
            <p className="text-muted-foreground">환자 등록, 수정, 조회를 관리합니다</p>
          </div>
        )}
        {!showHeader && <div></div>}
        <div className="flex gap-2">
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewPatientModal} className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                신규 환자 등록
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  {isEditing ? "환자 정보 수정" : "신규 환자 등록"}
                </DialogTitle>
                <DialogDescription>
                  {isEditing ? "환자 정보를 수정합니다" : "환자 정보를 입력해 등록하세요"}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={isEditing ? handleUpdate : handleRegistration} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="patientNo">환자 번호 *</Label>
                    <Input
                      id="patientNo"
                      value={formData.patientNo}
                      onChange={(e) => setFormData({...formData, patientNo: e.target.value})}
                      placeholder="환자 번호 입력"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="name">이름 *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="이름 입력"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="gender">성별 *</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => setFormData({...formData, gender: value})}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="성별 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">남성</SelectItem>
                        <SelectItem value="female">여성</SelectItem>
                        <SelectItem value="other">기타</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="birth">생년월일 *</Label>
                    <Input
                      id="birth"
                      type="date"
                      value={formData.birth}
                      max={today}
                      onChange={(e) => handleBirthChange(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="weight">체중(kg) *</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.1"
                      value={formData.weight}
                      onChange={(e) => setFormData({...formData, weight: e.target.value})}
                      placeholder="체중(kg)"
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="height">신장(cm) *</Label>
                    <Input
                      id="height"
                      type="number"
                      value={formData.height}
                      onChange={(e) => setFormData({...formData, height: e.target.value})}
                      placeholder="신장(cm)"
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="age">나이</Label>
                    <Input
                      id="age"
                      value={formData.age}
                      readOnly
                      placeholder="생년월일 입력 시 자동 계산"
                    />
                  </div>
                  <div>
                    <Label>BMI</Label>
                    <Input value={calcBMI()} readOnly placeholder="자동 계산" />
                  </div>
                  <div>
                    <Label>BSA</Label>
                    <Input value={calcBSA()} readOnly placeholder="자동 계산" />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  {isEditing && (
                     <Button type="button" variant="destructive" onClick={handleDelete} className="w-fit p-2">
                       <Trash2 className="h-4 w-4" />
                     </Button>
                  )}
                  <Button type="submit" className="flex-1">
                    {isEditing ? "수정하기" : "등록하기"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    취소
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* TDM 분석 목록 조회 모달 */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="min-w-[1000px] min-h-[500px] max-h-[80vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>{viewingPatient?.name} 환자의 Report 조회</DialogTitle>
            <DialogDescription>
              TDM 분석 내역을 선택하면 해당 분석의 Report를 조회하고 다운로드할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          {viewingPatient && (
            <div className="px-6 pb-6">
              {tdmPrescriptions.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">분석일</TableHead>
                        <TableHead className="w-[150px]">약물명</TableHead>
                        <TableHead className="w-[200px]">적응증</TableHead>
                        <TableHead className="w-[250px]">TDM 목표</TableHead>
                        <TableHead className="w-[120px]">항정상태</TableHead>
                        <TableHead className="w-[100px]">조회</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tdmPrescriptions.map((prescription, index) => {
                        const tdmResult = viewingPatient ? loadTdmResult(viewingPatient.id, prescription.drugName, prescription.startDate) : null;
                        const tdmTargetText = formatTdmTarget(prescription, tdmResult);
                        const steadyStateText = formatSteadyState(tdmResult);
                        
                        return (
                          <TableRow 
                            key={prescription.id}
                            className={`cursor-pointer hover:bg-accent/50 dark:hover:bg-accent/30 ${
                              selectedTdmPrescription?.id === prescription.id ? "bg-accent dark:bg-accent/50" : ""
                            }`}
                            onClick={() => setSelectedTdmPrescription(prescription)}
                          >
                            <TableCell className="align-top">
                              {dayjs(prescription.startDate || prescription.id).format('YYYY.M.D')}
                            </TableCell>
                            <TableCell className="font-medium align-top">
                              {prescription.drugName}
                            </TableCell>
                            <TableCell className="align-top">
                              {prescription.indication || '-'}
                            </TableCell>
                            <TableCell className="align-top">
                              {tdmTargetText}
                            </TableCell>
                            <TableCell className="align-top">
                              {steadyStateText}
                            </TableCell>
                            <TableCell className="align-top">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTdmSelection(prescription);
                                }}
                                className="flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                조회
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 px-6">
                  <FileChartColumnIncreasing className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">등록된 TDM 분석 내역이 없습니다.</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 환자 목록 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>등록된 환자 ({patients.length})</CardTitle>
              <CardDescription>
                환자를 클릭하면 상세 정보 확인 및 수정이 가능합니다
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="환자 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPatients.length > 0 ? (
            <div className={`rounded-md border ${selectedPatient ? 'border-sky-300 dark:border-sky-700' : ''}`}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>나이</TableHead>
                    <TableHead>성별</TableHead>
                    <TableHead>체중</TableHead>
                    <TableHead>신장</TableHead>
                    <TableHead>등록일</TableHead>
                    <TableHead>수정과 조회</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient) => {
                    const isSelected = selectedPatient?.id === patient.id;
                    return (
                    <TableRow 
                      key={patient.id}
                      className={`cursor-pointer hover:bg-muted/50 ${
                        isSelected 
                          ? 'bg-sky-50 dark:bg-sky-900 border-l-4 border-l-sky-300 dark:border-l-sky-700' 
                          : ''
                      }`}
                      onClick={() => setSelectedPatient(patient)}
                    >
                      <TableCell>
                        {isSelected && (
                          <CheckCircle className="h-5 w-5 text-sky-500 dark:text-sky-400" />
                        )}
                      </TableCell>
                      <TableCell className={`${isSelected ? 'font-bold text-[#333333] dark:text-white' : 'font-medium'}`}>{patient.name}</TableCell>
                      <TableCell className={isSelected ? 'font-bold text-[#333333] dark:text-white' : ''}>{patient.age}</TableCell>
                      <TableCell className={`capitalize ${isSelected ? 'font-bold text-[#333333] dark:text-white' : ''}`}>{patient.gender}</TableCell>
                      <TableCell className={isSelected ? 'font-bold text-[#333333] dark:text-white' : ''}>{patient.weight} kg</TableCell>
                      <TableCell className={isSelected ? 'font-bold text-[#333333] dark:text-white' : ''}>{patient.height} cm</TableCell>
                      <TableCell className={isSelected ? 'font-bold text-[#333333] dark:text-white' : ''}>{patient.createdAt.toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(patient);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openViewModal(patient);
                            }}
                          >
                            <FileChartColumnIncreasing className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm ? "검색 결과가 없습니다" : "아직 등록된 환자가 없습니다"}
              </p>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "다른 검색어를 시도해보세요" : "위 버튼을 통해 첫 환자를 등록하세요"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

export default PatientInformation;
