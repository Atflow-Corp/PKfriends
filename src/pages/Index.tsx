import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PatientRegistration from "@/components/PatientRegistration";
import StepWorkflow from "@/components/StepWorkflow";
import { User, Activity } from "lucide-react";
import { Pill, FlaskConical, TrendingUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { storage, STORAGE_KEYS } from "@/lib/storage";
import ProfileSettings, { UserProfile } from "@/components/ProfileSettings";
import { hasTdmResult } from "@/lib/tdm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface Patient {
  id: string;
  name: string;
  age: number;
  birthDate: string;
  weight: number;
  height: number;
  gender: string;
  medicalHistory: string;
  allergies: string;
  createdAt: Date;
}

export interface Prescription {
  id: string;
  patientId: string;
  drugName: string;
  dosage: number;
  unit: string;
  frequency: string;
  startDate: Date;
  endDate?: Date;
  route: string;
  prescribedBy: string;
  indication?: string;
  tdmTarget?: string;
  tdmTargetValue?: string;
  additionalInfo?: string;
}

export interface BloodTest {
  id: string;
  patientId: string;
  drugName: string;
  concentration: number;
  unit: string;
  timeAfterDose: number;
  testDate: Date;
  measurementType: string; // 측정 기준 (Trough/Peak)
  isSelected?: boolean;
  // 신기능 정보 (BloodTestStep에서 추가)
  creatinine?: string;
  dialysis?: 'Y' | 'N';
  renalReplacement?: string;
}

export interface DrugAdministration {
  id: string;
  patientId: string;
  drugName: string;
  route: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  dose: number;
  unit: string;
  isIVInfusion: boolean;
  infusionTime?: number; // IV 주입시간(분)
  administrationTime?: number; // 경구 등 투약시간(분)
  intervalHours?: number; // 투약 간격(시간)
}

interface IndexProps {
  onLogout: () => void;
}

const Index = ({ onLogout }: IndexProps) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [bloodTests, setBloodTests] = useState<BloodTest[]>([]);
  const [drugAdministrations, setDrugAdministrations] = useState<DrugAdministration[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [activeTab, setActiveTab] = useState("workflow");
  const [showTdmResultAlert, setShowTdmResultAlert] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDark]);

  // Load persisted data on mount
  useEffect(() => {
    const savedPatients = storage.getJSON<Patient[]>(STORAGE_KEYS.patients, [] as Patient[]);
    const revivePatients = (savedPatients || []).map((p: Patient) => ({ ...p, createdAt: p.createdAt ? new Date(p.createdAt) : new Date() }));
    setPatients(revivePatients);

    const savedPrescriptions = storage.getJSON<Prescription[]>(STORAGE_KEYS.prescriptions, [] as Prescription[]);
    const revivePrescriptions = (savedPrescriptions || []).map((pr: Prescription) => ({
      ...pr,
      startDate: pr.startDate ? new Date(pr.startDate) : new Date(),
      endDate: pr.endDate ? new Date(pr.endDate) : undefined
    }));
    setPrescriptions(revivePrescriptions);

    const savedBloodTests = storage.getJSON<BloodTest[]>(STORAGE_KEYS.bloodTests, [] as BloodTest[]);
    const reviveBloodTests = (savedBloodTests || []).map((bt: BloodTest) => ({
      ...bt,
      testDate: bt.testDate ? new Date(bt.testDate) : new Date()
    }));
    setBloodTests(reviveBloodTests);

    const savedDrugAdministrations = storage.getJSON<DrugAdministration[]>(STORAGE_KEYS.drugAdministrations, [] as DrugAdministration[]);
    setDrugAdministrations(savedDrugAdministrations || []);

    const savedSelectedPatientId = storage.getJSON<string | null>(STORAGE_KEYS.selectedPatientId, null);
    if (savedSelectedPatientId) {
      const found = revivePatients.find(p => p.id === savedSelectedPatientId) || null;
      setSelectedPatient(found);
    }

    // 사용자 프로필 정보 로드
    const savedUserProfile = storage.getJSON<UserProfile>(STORAGE_KEYS.userProfile);
    if (savedUserProfile) {
      setUserProfile(savedUserProfile);
    }

    setHydrated(true);
  }, []);

  // Persist data when state changes
  useEffect(() => {
    if (!hydrated) return;
    storage.setJSON(STORAGE_KEYS.patients, patients);
  }, [hydrated, patients]);
  useEffect(() => {
    if (!hydrated) return;
    storage.setJSON(STORAGE_KEYS.prescriptions, prescriptions);
  }, [hydrated, prescriptions]);
  useEffect(() => {
    if (!hydrated) return;
    storage.setJSON(STORAGE_KEYS.bloodTests, bloodTests);
  }, [hydrated, bloodTests]);
  useEffect(() => {
    if (!hydrated) return;
    storage.setJSON(STORAGE_KEYS.drugAdministrations, drugAdministrations);
  }, [hydrated, drugAdministrations]);
  useEffect(() => {
    if (!hydrated) return;
    if (selectedPatient?.id) {
      storage.setJSON(STORAGE_KEYS.selectedPatientId, selectedPatient.id);
    } else {
      storage.remove(STORAGE_KEYS.selectedPatientId);
    }
  }, [hydrated, selectedPatient]);

  const addPatient = (patient: Patient) => {
    setPatients([...patients, patient]);
  };

  const updatePatient = (patient: Patient) => {
    setPatients(patients.map(p => p.id === patient.id ? patient : p));
  };

  const deletePatient = (patientId: string) => {
    setPatients(patients.filter(p => p.id !== patientId));
  };

  const resetWorkflow = () => {
    // 워크플로우 관련 데이터 초기화
    setPrescriptions([]);
    setBloodTests([]);
    setDrugAdministrations([]);
  };

  const addPrescription = (prescription?: Prescription, updatedPrescriptions?: Prescription[]) => {
    if (updatedPrescriptions) {
      setPrescriptions(prescription ? [...updatedPrescriptions, prescription] : updatedPrescriptions);
      return;
    }
    if (prescription) {
      // 신규 TDM은 최상단에 추가
      setPrescriptions([prescription, ...prescriptions]);
    }
  };

  const addBloodTest = (bloodTest: BloodTest) => {
    setBloodTests([...bloodTests, bloodTest]);
  };

  const deleteBloodTest = (bloodTestId: string) => {
    setBloodTests(bloodTests.filter(test => test.id !== bloodTestId));
  };

  const addDrugAdministration = (drugAdministration: DrugAdministration) => {
    setDrugAdministrations([...drugAdministrations, drugAdministration]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950">
      <header className="bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <Activity className="h-8 w-8 text-blue-600 dark:text-blue-300" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">TDM Friends</h1>
                <p className="text-sm text-slate-600 dark:text-slate-300">Precision Medicine의 시작</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-sm text-slate-600 dark:text-slate-300">등록된 환자 수: {patients.length}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">선택된 환자: {selectedPatient?.name || "None"}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={`https://avatar.vercel.sh/user.png`} alt="User" />
                    <AvatarFallback>
                      {userProfile?.name ? userProfile.name.charAt(0) : "사용자"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">
                    {userProfile?.name || "사용자"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {userProfile?.name || "사용자"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {userProfile?.email || userProfile?.phone || "정보 없음"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground pt-1">
                      소속: {userProfile?.organization || "정보 없음"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <div className="flex items-center justify-between w-full">
                      <span>{isDark ? "다크 모드" : "라이트 모드"}</span>
                      <Switch
                        checked={isDark}
                        onCheckedChange={setIsDark}
                        className="ml-4"
                      />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowProfileSettings(true)}>
                    프로필 설정
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onLogout}>
                    로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={(value) => {
          // "Let's TDM" 탭으로 전환할 때만 TDM 결과 확인 (다른 탭에서 workflow로 전환할 때만)
          if (value === "workflow" && activeTab !== "workflow" && selectedPatient) {
            // 선택된 처방전이 있는지 확인
            const patientPrescriptions = prescriptions.filter(p => p.patientId === selectedPatient.id);
            if (patientPrescriptions.length > 0) {
              const latestPrescription = patientPrescriptions[0]; // 최신 처방전 사용
              const hasResult = hasTdmResult(selectedPatient.id, latestPrescription.drugName);
              
              if (hasResult) {
                // 이미 결과가 있는 경우 얼럿 표시하고 탭 전환 안 함
                setShowTdmResultAlert(true);
                return;
              }
            }
          }
          // 다른 탭으로 전환하거나 결과가 없는 경우 정상적으로 전환
          setActiveTab(value);
        }} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm h-[52px]">
            <TabsTrigger
              value="workflow"
              className="flex items-center justify-center col-span-3 rounded-l-xl px-6 h-[52px] min-h-[52px] max-h-[52px] text-slate-900 dark:text-slate-200 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-white dark:data-[state=inactive]:bg-slate-800 dark:data-[state=inactive]:text-slate-400 dark:focus:bg-slate-700 dark:focus:text-white dark:hover:bg-slate-700 dark:hover:text-white border-r border-slate-200 dark:border-slate-700 leading-none"
            >
              <Activity className="h-4 w-4 mr-2" />
              Let's TDM
            </TabsTrigger>
            <TabsTrigger
              value="management"
              className="flex items-center justify-center col-span-1 rounded-r-xl px-6 h-[52px] min-h-[52px] max-h-[52px] text-slate-900 dark:text-slate-200 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-white dark:data-[state=inactive]:bg-slate-800 dark:data-[state=inactive]:text-slate-400 dark:focus:bg-slate-700 dark:focus:text-white dark:hover:bg-slate-700 dark:hover:text-white border-l border-slate-200 dark:border-slate-700 leading-none"
            >
              <User className="h-4 w-4 mr-2" />
              환자 관리
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflow">
            <StepWorkflow
              patients={patients}
              prescriptions={prescriptions}
              bloodTests={bloodTests}
              selectedPatient={selectedPatient}
              setSelectedPatient={setSelectedPatient}
              onAddPatient={addPatient}
              onAddPrescription={addPrescription}
              setPrescriptions={setPrescriptions}
              onAddBloodTest={addBloodTest}
              onDeleteBloodTest={deleteBloodTest}
              setBloodTests={setBloodTests}
              onAddDrugAdministration={addDrugAdministration}
              drugAdministrations={drugAdministrations}
              setDrugAdministrations={setDrugAdministrations}
              onUpdatePatient={updatePatient}
              onDeletePatient={deletePatient}
              onResetWorkflow={resetWorkflow}            />
          </TabsContent>

          <TabsContent value="management">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  환자 관리
                </CardTitle>
                <CardDescription>
                  환자 관리 및 히스토리 조회
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PatientRegistration 
                  onAddPatient={addPatient}
                  onUpdatePatient={(p)=>setPatients(prev=>prev.map(x=>x.id===p.id?p:x))}
                  onDeletePatient={(id)=>setPatients(prev=>prev.filter(x=>x.id!==id))}
                  patients={patients}
                  selectedPatient={selectedPatient}
                  setSelectedPatient={setSelectedPatient}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* 프로필 설정 모달 */}
      <ProfileSettings
        open={showProfileSettings}
        onOpenChange={(open) => {
          setShowProfileSettings(open);
          // 프로필 설정이 닫힐 때 업데이트된 프로필 정보 다시 로드
          if (!open) {
            const savedUserProfile = storage.getJSON<UserProfile>(STORAGE_KEYS.userProfile);
            if (savedUserProfile) {
              setUserProfile(savedUserProfile);
            }
          }
        }}
      />

      {/* TDM 결과 이미 존재 알림 AlertDialog */}
      <AlertDialog open={showTdmResultAlert} onOpenChange={setShowTdmResultAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>TDM Workflow 완료 안내</AlertDialogTitle>
            <AlertDialogDescription>
              이미 TDM Workflow를 완료한 상태입니다. 데이터를 수정한 후 새로운 예측 결과 확인을 원하실 경우, 하단의 TDM Simulation 버튼을 선택하고 새로 결과를 확인할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowTdmResultAlert(false)}>
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
