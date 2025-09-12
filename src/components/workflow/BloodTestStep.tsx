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
  onAddBloodTest: (bloodTest: BloodTest) => void;
  onDeleteBloodTest: (bloodTestId: string) => void;
  onUpdateBloodTest: (bloodTestId: string, updates: Partial<BloodTest>) => void;
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
}

const BloodTestStep = ({
  patients,
  bloodTests,
  selectedPatient,
  onAddBloodTest,
  onDeleteBloodTest,
  onUpdateBloodTest,
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
    renalReplacement: ""
  });
  const [renalInfoList, setRenalInfoList] = useState<RenalInfo[]>([]);

  // Persist renal info list per patient in localStorage
  useEffect(() => {
    if (!selectedPatient) return;
    try {
      const raw = window.localStorage.getItem(`tdmfriends:renal:${selectedPatient.id}`);
      if (raw) {
        const parsed = JSON.parse(raw) as RenalInfo[];
        setRenalInfoList(parsed);
      }
    } catch (_err) { /* no-op */ }
  }, [selectedPatient?.id]);

  useEffect(() => {
    if (!selectedPatient) return;
    try {
      window.localStorage.setItem(`tdmfriends:renal:${selectedPatient.id}`, JSON.stringify(renalInfoList));
    } catch (_err) { /* no-op */ }
  }, [selectedPatient?.id, renalInfoList]);

  // 혈중 약물 농도 입력 상태
  const [formData, setFormData] = useState({
    testDate: "",
    testTime: "",
    concentration: "",
    unit: "ng/mL",
    notes: ""
  });
  
  // 모달 상태 추가
  const [showAlertModal, setShowAlertModal] = useState(false);

  const patientBloodTests = selectedPatient 
    ? bloodTests.filter(b => b.patientId === selectedPatient.id)
    : [];

  const today = dayjs().format("YYYY-MM-DD");

  // 2단계에서 입력한 TDM 약물 1개만 사용
  const tdmDrug = prescriptions.find(p => p.patientId === selectedPatient?.id);

  // TDM 약물이 변경될 때마다 단위 업데이트
  useEffect(() => {
    const defaultUnit = tdmDrug?.drugName === "Vancomycin" ? "mg/L" : "ng/mL";
    setFormData(prev => ({ ...prev, unit: defaultUnit }));
  }, [tdmDrug?.drugName]);

  const handleAddRenal = () => {
    if (!renalForm.creatinine || !renalForm.date || !renalForm.formula) return;
    
    // 투석 여부가 Y일 때 신 대체요법 입력 체크
    if (renalForm.dialysis === "Y" && !renalForm.renalReplacement.trim()) {
      alert("신 대체요법을 입력해주세요.");
      return;
    }
    
    // 신기능 데이터 추가 조건 체크
    if (selectedPatient && selectedPatient.age > 20 && renalInfoList.length > 0) {
      setShowAlertModal(true);
      return;
    }
    // 조건에 부합하면 모달 띄우기 (데이터 추가 후 실행)
   if (renalForm.dialysis === "Y" && renalForm.renalReplacement.toUpperCase() === "CRRT") {
    setShowAlertModal(true);
    }

    const newRenalInfo: RenalInfo = {
      id: Date.now().toString(),
      ...renalForm,
      isSelected: true  // 새로 추가된 데이터는 자동으로 선택
    };
    
    setRenalInfoList([...renalInfoList, newRenalInfo]);
    setRenalForm({
      creatinine: "",
      date: "",
      formula: "cockcroft-gault",
      result: "",
      dialysis: "N",
      renalReplacement: ""
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

  const handleBloodTestSelectionChange = (id: string, checked: boolean) => {
    onUpdateBloodTest(id, { isSelected: checked });
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
    const newBloodTest: BloodTest = {
      id: Date.now().toString(),
      patientId: selectedPatient.id,
      drugName: tdmDrug?.drugName || "",
      concentration: parseFloat(formData.concentration),
      unit: formData.unit,
      timeAfterDose: 0, // Lab 단계에서는 미사용
      testDate: testDateTime,
      notes: formData.notes,
      isSelected: true // 새로 추가된 데이터는 자동으로 선택
    };
    onAddBloodTest(newBloodTest);
    const defaultUnit = tdmDrug?.drugName === "Vancomycin" ? "mg/L" : "ng/mL";
    setFormData({ testDate: "", testTime: "", concentration: "", unit: defaultUnit, notes: "" });
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
            신기능(혈청 크레아티닌)과 혈중 약물 농도 정보를 입력하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 2단계에서 선택한 TDM 내역 표시 */}
          {tdmDrug && (
            <div className="py-3 px-4 rounded bg-muted dark:bg-slate-800 mb-4">
              <div className="text-base font-semibold mb-2">
                TDM 선택 정보: {tdmDrug.drugName}
              </div>
              <div className="space-y-1 text-sm">
                {tdmDrug.indication && (
                  <div>
                    <span className="font-medium">적응증:</span> {tdmDrug.indication}
                  </div>
                )}
                {tdmDrug.additionalInfo && (
                  <div>
                    <span className="font-medium">추가정보:</span> {tdmDrug.additionalInfo}
                  </div>
                )}
                {tdmDrug.tdmTarget && tdmDrug.tdmTargetValue && (
                  <div>
                    <span className="font-medium">TDM목표치:</span> {tdmDrug.tdmTarget} {tdmDrug.tdmTargetValue}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 신기능 데이터 */}
          <Card>
            <CardHeader>
              <CardTitle>신기능 데이터 ({renalInfoList.length + 1})</CardTitle>
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
                      <TableHead>혈청 크레아티닌(mg/dL)</TableHead>
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
                        <TableCell>{renalInfo.creatinine}</TableCell>
                        <TableCell>{renalInfo.date}</TableCell>
                        <TableCell>{renalInfo.formula}</TableCell>
                        <TableCell>{renalInfo.result || "-"}</TableCell>
                        <TableCell>{renalInfo.dialysis}</TableCell>
                        <TableCell>{renalInfo.renalReplacement || "-"}</TableCell>
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
                      <Select value={renalForm.formula} onValueChange={v => setRenalForm({ ...renalForm, formula: v })} required>
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
                        onChange={e => setRenalForm({ ...renalForm, result: e.target.value })}
                        placeholder="예: 45.2 mL/min"
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
                            <SelectItem value="μg/mL">μg/mL</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="ng/mL">ng/mL</SelectItem>
                            <SelectItem value="μg/L">μg/L</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">비고</Label>
                  <Input
                    id="notes"
                    type="text"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="비고 입력"
                  />
                </div>
                <Button type="submit">추가</Button>
              </form>
              {/* 입력된 혈중 약물 농도 리스트 */}
              {patientBloodTests.length > 0 && (
                <div className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">분석사용</TableHead>
                        <TableHead>날짜</TableHead>
                        <TableHead>시간</TableHead>
                        <TableHead>농도</TableHead>
                        <TableHead>비고</TableHead>
                        <TableHead className="w-16">삭제</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patientBloodTests.map((test) => (
                        <TableRow key={test.id}>
                          <TableCell>
                            <Checkbox 
                              checked={test.isSelected || false}
                              onCheckedChange={(checked) => handleBloodTestSelectionChange(test.id, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell>{test.testDate.toLocaleDateString()}</TableCell>
                          <TableCell>{test.testDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                          <TableCell>{test.concentration} {test.unit}</TableCell>
                          <TableCell>{test.notes || "-"}</TableCell>
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
