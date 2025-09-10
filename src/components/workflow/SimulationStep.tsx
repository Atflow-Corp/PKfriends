import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Patient, Prescription, BloodTest } from "@/pages/Index";
import { Activity, ArrowLeft, CheckCircle } from "lucide-react";
import PKSimulation from "../PKSimulation";

interface SimulationStepProps {
  patients: Patient[];
  prescriptions: Prescription[];
  bloodTests: BloodTest[];
  selectedPatient: Patient | null;
  onPrev: () => void;
}

const SimulationStep = ({
  patients,
  prescriptions,
  bloodTests,
  selectedPatient,
  onPrev
}: SimulationStepProps) => {
  if (!selectedPatient) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Activity className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Please select a patient first</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const patientPrescriptions = prescriptions.filter(p => p.patientId === selectedPatient.id);
  const patientBloodTests = bloodTests.filter(b => b.patientId === selectedPatient.id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            TDM Simulation
            <CheckCircle className="h-5 w-5 text-green-600" />
          </CardTitle>
          <CardDescription>
            {selectedPatient.name} 환자의 TDM 분석 결과를 확인하고 약물 요법을 직접 시뮬레이션 해보세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* PK Simulation Component */}
          <PKSimulation
            patients={patients}
            prescriptions={prescriptions}
            bloodTests={bloodTests}
            selectedPatient={selectedPatient}
          />

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={onPrev} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              투약 기록
            </Button>
            <div className="text-sm text-muted-foreground">
              Analysis complete! You can modify data by going back to previous steps.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimulationStep;
