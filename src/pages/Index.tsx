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

export interface Patient {
  id: string;
  name: string;
  age: number;
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
}

export interface BloodTest {
  id: string;
  patientId: string;
  drugName: string;
  concentration: number;
  unit: string;
  timeAfterDose: number;
  testDate: Date;
  notes: string;
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

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDark]);

  const addPatient = (patient: Patient) => {
    setPatients([...patients, patient]);
  };

  const addPrescription = (prescription: Prescription) => {
    setPrescriptions([...prescriptions, prescription]);
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
                      <AvatarFallback>사용자</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">사용자</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">사용자</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        user@pk-friends.com
                      </p>
                      <p className="text-xs leading-none text-muted-foreground pt-1">
                        소속: PK 프렌즈 대학병원
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
                  <DropdownMenuItem>
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
        <Tabs defaultValue="workflow" className="space-y-6">
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
            />
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
                  patients={patients}
                  selectedPatient={selectedPatient}
                  setSelectedPatient={setSelectedPatient}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
