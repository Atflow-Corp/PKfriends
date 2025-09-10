import { Patient } from "@/pages/Index";
import PatientInformation from "./PatientInformation";

interface PatientRegistrationProps {
  onAddPatient: (patient: Patient) => void;
  onUpdatePatient: (patient: Patient) => void;
  onDeletePatient: (patientId: string) => void;
  patients: Patient[];
  selectedPatient: Patient | null;
  setSelectedPatient: (patient: Patient | null) => void;
}

const PatientRegistration = ({ 
  onAddPatient, 
  onUpdatePatient, 
  onDeletePatient,
  patients, 
  selectedPatient, 
  setSelectedPatient 
}: PatientRegistrationProps) => {
  return (
    <PatientInformation
      onAddPatient={onAddPatient}
      onUpdatePatient={onUpdatePatient}
      onDeletePatient={onDeletePatient}
      patients={patients}
      selectedPatient={selectedPatient}
      setSelectedPatient={setSelectedPatient}
      showHeader={false}
    />
  );
};

export default PatientRegistration;
