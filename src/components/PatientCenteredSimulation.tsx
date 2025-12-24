
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Patient, Prescription, BloodTest } from "@/pages/Index";
import { User, UserPlus, Activity, Calculator, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from "recharts";

interface PatientCenteredSimulationProps {
  patients: Patient[];
  prescriptions: Prescription[];
  bloodTests: BloodTest[];
  selectedPatient: Patient | null;
  setSelectedPatient: (patient: Patient | null) => void;
  onAddPatient: (patient: Patient) => void;
}

const PatientCenteredSimulation = ({ 
  patients, 
  prescriptions, 
  bloodTests, 
  selectedPatient, 
  setSelectedPatient, 
  onAddPatient 
}: PatientCenteredSimulationProps) => {
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);
  const [newPatientData, setNewPatientData] = useState({
    name: "",
    age: "",
    weight: "",
    height: "",
    gender: "",
    medicalHistory: "",
    allergies: ""
  });
  const [simulationParams, setSimulationParams] = useState({
    dose: "",
    halfLife: "",
    drugName: ""
  });
  const [showSimulation, setShowSimulation] = useState(false);

  const patientBloodTests = selectedPatient 
    ? bloodTests.filter(b => b.patientId === selectedPatient.id)
    : [];

  const patientPrescriptions = selectedPatient 
    ? prescriptions.filter(p => p.patientId === selectedPatient.id)
    : [];

  const availableDrugs = Array.from(new Set([
    ...patientPrescriptions.map(p => p.drugName),
    ...patientBloodTests.map(b => b.drugName)
  ]));

  const handleNewPatientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newPatient: Patient = {
      id: Date.now().toString(),
      name: newPatientData.name,
      age: parseInt(newPatientData.age),
      weight: parseFloat(newPatientData.weight),
      height: parseFloat(newPatientData.height),
      gender: newPatientData.gender,
      medicalHistory: newPatientData.medicalHistory,
      allergies: newPatientData.allergies,
      createdAt: new Date()
    };

    onAddPatient(newPatient);
    setSelectedPatient(newPatient);
    setShowNewPatientForm(false);
    setNewPatientData({
      name: "",
      age: "",
      weight: "",
      height: "",
      gender: "",
      medicalHistory: "",
      allergies: ""
    });
  };

  const generateSimulationData = () => {
    if (!simulationParams.dose || !simulationParams.halfLife) return [];
    
    const dose = parseFloat(simulationParams.dose);
    const halfLife = parseFloat(simulationParams.halfLife);
    const ke = 0.693 / halfLife;
    
    const timePoints = [];
    for (let t = 0; t <= 24; t += 0.5) {
      const concentration = dose * Math.exp(-ke * t);
      timePoints.push({
        time: t,
        predicted: concentration,
        observed: patientBloodTests.find(test => 
          test.drugName === simulationParams.drugName && 
          Math.abs(test.timeAfterDose - t) < 0.5
        )?.concentration || null
      });
    }
    return timePoints;
  };

  const simulationData = generateSimulationData();

  return (
    <div className="space-y-6">
      {/* Patient Selection/Registration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Select Patient
            </CardTitle>
            <CardDescription>
              Choose an existing patient or register a new one for PK analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="patientSelect">Existing Patients</Label>
              <Select
                value={selectedPatient?.id || ""}
                onValueChange={(value) => {
                  const patient = patients.find(p => p.id === value);
                  setSelectedPatient(patient || null);
                  setShowNewPatientForm(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.name} (Age: {patient.age}, {patient.weight}kg)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Or</p>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewPatientForm(true);
                  setSelectedPatient(null);
                }}
                className="w-full"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Register New Patient
              </Button>
            </div>
          </CardContent>
        </Card>

        {selectedPatient && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient Information
              </CardTitle>
              <CardDescription>
                {selectedPatient.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Age</Label>
                  <p className="text-sm">{selectedPatient.age} years</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Weight</Label>
                  <p className="text-sm">{selectedPatient.weight} kg</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Height</Label>
                  <p className="text-sm">{selectedPatient.height} cm</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Gender</Label>
                  <p className="text-sm capitalize">{selectedPatient.gender}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">BMI</Label>
                  <p className="text-sm">
                    {(selectedPatient.weight / Math.pow(selectedPatient.height / 100, 2)).toFixed(1)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Data Points</Label>
                  <p className="text-sm">{patientBloodTests.length} tests</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* New Patient Registration Form */}
      {showNewPatientForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Register New Patient
            </CardTitle>
            <CardDescription>
              Enter patient information for PK analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleNewPatientSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={newPatientData.name}
                    onChange={(e) => setNewPatientData({...newPatientData, name: e.target.value})}
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="age">Age *</Label>
                  <Input
                    id="age"
                    type="number"
                    value={newPatientData.age}
                    onChange={(e) => setNewPatientData({...newPatientData, age: e.target.value})}
                    placeholder="Age in years"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="weight">Weight (kg) *</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    value={newPatientData.weight}
                    onChange={(e) => setNewPatientData({...newPatientData, weight: e.target.value})}
                    placeholder="Weight in kg"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="height">Height (cm) *</Label>
                  <Input
                    id="height"
                    type="number"
                    value={newPatientData.height}
                    onChange={(e) => setNewPatientData({...newPatientData, height: e.target.value})}
                    placeholder="Height in cm"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender *</Label>
                  <Select
                    value={newPatientData.gender}
                    onValueChange={(value) => setNewPatientData({...newPatientData, gender: value})}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  Register & Select Patient
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowNewPatientForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* PK Simulation Section */}
      {selectedPatient && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Simulation Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="drugName">Drug Name</Label>
                <Input
                  id="drugName"
                  value={simulationParams.drugName}
                  onChange={(e) => setSimulationParams({...simulationParams, drugName: e.target.value})}
                  placeholder="e.g., Digoxin"
                />
              </div>
              <div>
                <Label htmlFor="dose">Initial Dose (mg)</Label>
                <Input
                  id="dose"
                  type="number"
                  value={simulationParams.dose}
                  onChange={(e) => setSimulationParams({...simulationParams, dose: e.target.value})}
                  placeholder="100"
                />
              </div>
              <div>
                <Label htmlFor="halfLife">Half-life (hours)</Label>
                <Input
                  id="halfLife"
                  type="number"
                  step="0.1"
                  value={simulationParams.halfLife}
                  onChange={(e) => setSimulationParams({...simulationParams, halfLife: e.target.value})}
                  placeholder="6.0"
                />
              </div>
              <Button 
                onClick={() => setShowSimulation(true)}
                className="w-full"
                disabled={!simulationParams.dose || !simulationParams.halfLife}
              >
                Generate PK Simulation
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                PK Simulation Results
              </CardTitle>
              <CardDescription>
                Pharmacokinetic profile for {selectedPatient.name}
                {simulationParams.drugName && ` - ${simulationParams.drugName}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showSimulation && simulationData.length > 0 ? (
                <div className="h-80 min-h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={simulationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="time" 
                        label={{ value: 'Time (hours)', position: 'insideBottom', offset: -5 }}
                      />
                      <YAxis 
                        label={{ value: 'Concentration (ng/mL)', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        formatter={(value: any, name: string) => [
                          typeof value === 'number' ? `${value.toFixed(2)} ng/mL` : 'N/A', 
                          name === 'predicted' ? 'Predicted' : 'Observed'
                        ]}
                        labelFormatter={(value) => `Time: ${value} hours`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="predicted" 
                        stroke="#2563eb" 
                        strokeWidth={2}
                        name="predicted"
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="observed" 
                        stroke="#dc2626" 
                        strokeWidth={0}
                        dot={{ fill: "#dc2626", r: 4 }}
                        name="observed"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center">
                  <div className="text-center">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {selectedPatient ? 
                        "Set simulation parameters and click 'Generate PK Simulation'" :
                        "Select a patient to begin PK simulation"
                      }
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!selectedPatient && !showNewPatientForm && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Patient Selected</h3>
              <p className="text-muted-foreground mb-6">
                Select an existing patient or register a new patient to begin PK simulation analysis
              </p>
              <Button onClick={() => setShowNewPatientForm(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Register First Patient
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PatientCenteredSimulation;
