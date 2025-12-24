
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Patient, Prescription, BloodTest } from "@/pages/Index";
import { User, Pill, FlaskConical, Activity, Calendar, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface DashboardProps {
  patients: Patient[];
  prescriptions: Prescription[];
  bloodTests: BloodTest[];
  selectedPatient: Patient | null;
  setSelectedPatient: (patient: Patient | null) => void;
}

const Dashboard = ({ patients, prescriptions, bloodTests, selectedPatient, setSelectedPatient }: DashboardProps) => {
  const selectedPatientPrescriptions = selectedPatient 
    ? prescriptions.filter(p => p.patientId === selectedPatient.id)
    : [];

  const selectedPatientBloodTests = selectedPatient 
    ? bloodTests.filter(b => b.patientId === selectedPatient.id)
    : [];

  // Generate sample PK data for visualization
  const pkData = selectedPatientBloodTests.length > 0 
    ? selectedPatientBloodTests
        .sort((a, b) => a.timeAfterDose - b.timeAfterDose)
        .map(test => ({
          time: test.timeAfterDose,
          concentration: test.concentration,
          drug: test.drugName
        }))
    : [
        { time: 0, concentration: 0, drug: "Sample" },
        { time: 1, concentration: 15, drug: "Sample" },
        { time: 2, concentration: 22, drug: "Sample" },
        { time: 4, concentration: 18, drug: "Sample" },
        { time: 8, concentration: 12, drug: "Sample" },
        { time: 12, concentration: 8, drug: "Sample" },
        { time: 24, concentration: 3, drug: "Sample" }
      ];

  const recentActivity = [
    ...prescriptions.slice(-3).map(p => ({
      type: "Prescription",
      patient: patients.find(patient => patient.id === p.patientId)?.name || "Unknown",
      details: `${p.drugName} ${p.dosage}${p.unit}`,
      date: p.startDate
    })),
    ...bloodTests.slice(-3).map(b => ({
      type: "Blood Test",
      patient: patients.find(patient => patient.id === b.patientId)?.name || "Unknown",
      details: `${b.drugName} - ${b.concentration}${b.unit}`,
      date: b.testDate
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{patients.length}</div>
            <p className="text-xs text-muted-foreground">
              Registered in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Prescriptions</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{prescriptions.length}</div>
            <p className="text-xs text-muted-foreground">
              Currently prescribed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blood Tests</CardTitle>
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bloodTests.length}</div>
            <p className="text-xs text-muted-foreground">
              Tests recorded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PK Studies</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(bloodTests.map(b => b.patientId)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Patients with PK data
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Selection and PK Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Pharmacokinetic Overview
                </CardTitle>
                <CardDescription>
                  Drug concentration over time for selected patient
                </CardDescription>
              </div>
              <Select
                value={selectedPatient?.id || ""}
                onValueChange={(value) => {
                  const patient = patients.find(p => p.id === value);
                  setSelectedPatient(patient || null);
                }}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.name} (Age: {patient.age})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80 min-h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pkData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    label={{ value: 'Time (hours)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    label={{ value: 'Concentration (ng/mL)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value, name) => [`${value} ng/mL`, 'Concentration']}
                    labelFormatter={(value) => `Time: ${value} hours`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="concentration" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    dot={{ fill: "#2563eb", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest prescriptions and blood tests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${
                      activity.type === 'Prescription' ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                      {activity.type === 'Prescription' ? 
                        <Pill className="h-4 w-4 text-blue-600" /> : 
                        <FlaskConical className="h-4 w-4 text-green-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {activity.patient}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {activity.type}: {activity.details}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(activity.date).toLocaleDateString()}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Patient Summary */}
        {selectedPatient && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient Summary
              </CardTitle>
              <CardDescription>
                {selectedPatient.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Age:</span>
                  <span className="text-sm font-medium">{selectedPatient.age} years</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Weight:</span>
                  <span className="text-sm font-medium">{selectedPatient.weight} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Gender:</span>
                  <span className="text-sm font-medium">{selectedPatient.gender}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Prescriptions:</span>
                  <span className="text-sm font-medium">{selectedPatientPrescriptions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Blood Tests:</span>
                  <span className="text-sm font-medium">{selectedPatientBloodTests.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
