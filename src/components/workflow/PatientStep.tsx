import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Patient } from "@/pages/Index";
import { User, UserPlus, ArrowRight, CheckCircle } from "lucide-react";
import dayjs from "dayjs";

interface PatientStepProps {
  patients: Patient[];
  selectedPatient: Patient | null;
  setSelectedPatient: (patient: Patient | null) => void;
  onAddPatient: (patient: Patient) => void;
  onNext: () => void;
  isCompleted: boolean;
}

const PatientStep = ({
  patients,
  selectedPatient,
  setSelectedPatient,
  onAddPatient,
  onNext,
  isCompleted
}: PatientStepProps) => {
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);
  const [newPatientData, setNewPatientData] = useState({
    patientNo: "",
    name: "",
    birth: "",
    age: "",
    weight: "",
    height: "",
    gender: ""
  });
  const [search, setSearch] = useState("");

  const handleNewPatientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newPatient: Patient = {
      id: newPatientData.patientNo || Date.now().toString(),
      name: newPatientData.name,
      age: parseInt(newPatientData.age),
      weight: parseFloat(newPatientData.weight),
      height: parseFloat(newPatientData.height),
      gender: newPatientData.gender,
      medicalHistory: "",
      allergies: "",
      createdAt: newPatientData.birth ? new Date(newPatientData.birth) : new Date()
    };

    onAddPatient(newPatient);
    setSelectedPatient(newPatient);
    setShowNewPatientForm(false);
    setNewPatientData({
      patientNo: "",
      name: "",
      birth: "",
      age: "",
      weight: "",
      height: "",
      gender: ""
    });
  };

  const handleBirthChange = (value: string) => {
    setNewPatientData((prev) => {
      let age = "";
      if (value) {
        const today = dayjs();
        const birth = dayjs(value);
        age = today.diff(birth, 'year').toString();
      }
      return { ...prev, birth: value, age };
    });
  };

  // BMI, BSA 자동 계산
  const calcBMI = () => {
    const w = parseFloat(newPatientData.weight);
    const h = parseFloat(newPatientData.height);
    if (!w || !h) return "";
    return (w / Math.pow(h / 100, 2)).toFixed(1);
  };
  const calcBSA = () => {
    const w = parseFloat(newPatientData.weight);
    const h = parseFloat(newPatientData.height);
    if (!w || !h) return "";
    // Mosteller formula
    return Math.sqrt((w * h) / 3600).toFixed(2);
  };

  // 검색어로 환자 필터링
  const filteredPatients = patients.filter(
    (p) =>
      p.name.includes(search) ||
      (p.id && p.id.includes(search))
  );

  return (
    <div className="space-y-6">
      {/* Step 1: Patient Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            1단계: 환자 선택
            {isCompleted && <CheckCircle className="h-5 w-5 text-green-600" />}
          </CardTitle>
          <CardDescription>
            기존 환자를 선택하거나 신규 환자를 등록하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Existing Patients */}
          {patients.length > 0 && (
            <div className="space-y-4">
              <Label htmlFor="patientSearch">이름 또는 번호로 검색</Label>
              <Input
                id="patientSearch"
                placeholder="이름 또는 환자번호 입력"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="mb-2"
              />
              <Label>기존 환자 리스트</Label>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>환자번호</TableHead>
                      <TableHead>나이</TableHead>
                      <TableHead>성별</TableHead>
                      <TableHead>체중(kg)</TableHead>
                      <TableHead>신장(cm)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map((patient) => (
                        <TableRow
                          key={patient.id}
                          className={
                            selectedPatient?.id === patient.id
                              ? "bg-blue-100 cursor-pointer"
                              : "hover:bg-muted/50 cursor-pointer"
                          }
                          onClick={() => {
                            setSelectedPatient(patient);
                            setShowNewPatientForm(false);
                          }}
                          data-state={selectedPatient?.id === patient.id ? "selected" : undefined}
                        >
                          <TableCell>{patient.name}</TableCell>
                          <TableCell>{patient.id}</TableCell>
                          <TableCell>{patient.age}</TableCell>
                          <TableCell>{patient.gender === "male" ? "남" : patient.gender === "female" ? "여" : "-"}</TableCell>
                          <TableCell>{patient.weight}</TableCell>
                          <TableCell>{patient.height}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">검색 결과가 없습니다.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Or Register New */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              {patients.length > 0 ? "또는 신규 환자 등록" : "첫 환자를 등록하세요"}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewPatientForm(true);
                setSelectedPatient(null);
              }}
              className="w-full max-w-md"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              신규 환자 등록
            </Button>
          </div>

          {/* New Patient Form */}
          {showNewPatientForm && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>신규 환자 등록</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleNewPatientSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="patientNo">환자 번호 *</Label>
                      <Input
                        id="patientNo"
                        value={newPatientData.patientNo}
                        onChange={(e) => setNewPatientData({...newPatientData, patientNo: e.target.value})}
                        placeholder="환자 번호 입력"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="name">이름 *</Label>
                      <Input
                        id="name"
                        value={newPatientData.name}
                        onChange={(e) => setNewPatientData({...newPatientData, name: e.target.value})}
                        placeholder="이름 입력"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="birth">생년월일 *</Label>
                      <Input
                        id="birth"
                        type="date"
                        value={newPatientData.birth}
                        onChange={(e) => {
                          // 연도 4자리 제한
                          if (e.target.value.length > 10) return;
                          handleBirthChange(e.target.value);
                        }}
                        required
                        max={dayjs().format('YYYY-MM-DD')}
                        pattern="\\d{4}-\\d{2}-\\d{2}"
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <Label htmlFor="age">나이</Label>
                      <Input
                        id="age"
                        value={newPatientData.age}
                        readOnly
                        placeholder="생년월일 입력 시 자동 계산"
                      />
                    </div>
                    <div>
                      <Label htmlFor="weight">체중(kg) *</Label>
                      <Input
                        id="weight"
                        type="number"
                        step="0.1"
                        value={newPatientData.weight}
                        onChange={(e) => setNewPatientData({...newPatientData, weight: e.target.value})}
                        placeholder="체중(kg)"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="height">신장(cm) *</Label>
                      <Input
                        id="height"
                        type="number"
                        value={newPatientData.height}
                        onChange={(e) => setNewPatientData({...newPatientData, height: e.target.value})}
                        placeholder="신장(cm)"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="gender">성별 *</Label>
                      <select
                        id="gender"
                        value={newPatientData.gender}
                        onChange={(e) => setNewPatientData({...newPatientData, gender: e.target.value})}
                        required
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">성별 선택</option>
                        <option value="male">남성</option>
                        <option value="female">여성</option>
                        <option value="other">기타</option>
                      </select>
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
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      등록 및 선택
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowNewPatientForm(false)}
                    >
                      취소
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Selected Patient Info */}
          {selectedPatient && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800">Selected Patient</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">이름</Label>
                    <p className="text-sm">{selectedPatient.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">나이</Label>
                    <p className="text-sm">{selectedPatient.age}세</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">체중</Label>
                    <p className="text-sm">{selectedPatient.weight} kg</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">신장</Label>
                    <p className="text-sm">{selectedPatient.height} cm</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">BMI</Label>
                    <p className="text-sm">
                      {(selectedPatient.weight && selectedPatient.height ? (selectedPatient.weight / Math.pow(selectedPatient.height / 100, 2)).toFixed(1) : "-")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">BSA</Label>
                    <p className="text-sm">
                      {(selectedPatient.weight && selectedPatient.height ? Math.sqrt((selectedPatient.weight * selectedPatient.height) / 3600).toFixed(2) : "-")} m²
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Next Button */}
          {isCompleted && (
            <div className="flex justify-end">
              <Button onClick={onNext} className="flex items-center gap-2 w-[300px] bg-black text-white font-bold text-lg py-3 px-6 justify-center">
                TDM 약물정보
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PatientStep;
