
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Patient, BloodTest } from "@/pages/Index";
import { FlaskConical, Plus, TrendingUp } from "lucide-react";

interface BloodTestResultsProps {
  patients: Patient[];
  bloodTests: BloodTest[];
  onAddBloodTest: (bloodTest: BloodTest) => void;
  selectedPatient: Patient | null;
}

const BloodTestResults = ({ patients, bloodTests, onAddBloodTest, selectedPatient }: BloodTestResultsProps) => {
  const [formData, setFormData] = useState({
    patientId: selectedPatient?.id || "",
    drugName: "",
    concentration: "",
    unit: "ng/mL",
    timeAfterDose: "",
    testDate: "",
    notes: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newBloodTest: BloodTest = {
      id: Date.now().toString(),
      patientId: formData.patientId,
      drugName: formData.drugName,
      concentration: parseFloat(formData.concentration),
      unit: formData.unit,
      timeAfterDose: parseFloat(formData.timeAfterDose),
      testDate: new Date(formData.testDate),
      notes: formData.notes
    };

    onAddBloodTest(newBloodTest);
    setFormData({
      patientId: selectedPatient?.id || "",
      drugName: "",
      concentration: "",
      unit: "ng/mL",
      timeAfterDose: "",
      testDate: "",
      notes: ""
    });
  };

  const filteredBloodTests = selectedPatient 
    ? bloodTests.filter(b => b.patientId === selectedPatient.id)
    : bloodTests;

  const commonDrugs = [
    "Amoxicillin", "Metformin", "Atorvastatin", "Lisinopril", "Levothyroxine",
    "Omeprazole", "Amlodipine", "Warfarin", "Digoxin", "Theophylline"
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Blood Test Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Record Blood Test Result
            </CardTitle>
            <CardDescription>
              Enter drug concentration and timing data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="patientSelect">Patient *</Label>
                <Select
                  value={formData.patientId}
                  onValueChange={(value) => setFormData({...formData, patientId: value})}
                  required
                >
                  <SelectTrigger>
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

              <div>
                <Label htmlFor="drugName">Drug Name *</Label>
                <Select
                  value={formData.drugName}
                  onValueChange={(value) => setFormData({...formData, drugName: value})}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select or type drug name" />
                  </SelectTrigger>
                  <SelectContent>
                    {commonDrugs.map((drug) => (
                      <SelectItem key={drug} value={drug}>
                        {drug}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="concentration">Concentration *</Label>
                  <Input
                    id="concentration"
                    type="number"
                    step="0.01"
                    value={formData.concentration}
                    onChange={(e) => setFormData({...formData, concentration: e.target.value})}
                    placeholder="12.5"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="unit">Unit *</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData({...formData, unit: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ng/mL">ng/mL</SelectItem>
                      <SelectItem value="μg/mL">μg/mL</SelectItem>
                      <SelectItem value="mg/L">mg/L</SelectItem>
                      <SelectItem value="μg/L">μg/L</SelectItem>
                      <SelectItem value="nmol/L">nmol/L</SelectItem>
                      <SelectItem value="μmol/L">μmol/L</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="timeAfterDose">Time After Dose (hours) *</Label>
                <Input
                  id="timeAfterDose"
                  type="number"
                  step="0.1"
                  value={formData.timeAfterDose}
                  onChange={(e) => setFormData({...formData, timeAfterDose: e.target.value})}
                  placeholder="2.0"
                  required
                />
              </div>

              <div>
                <Label htmlFor="testDate">Test Date *</Label>
                <Input
                  id="testDate"
                  type="datetime-local"
                  value={formData.testDate}
                  onChange={(e) => setFormData({...formData, testDate: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional observations or notes"
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full">
                Record Blood Test
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Blood Test Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Test Summary
            </CardTitle>
            <CardDescription>
              {selectedPatient 
                ? `Blood tests for ${selectedPatient.name}` 
                : "Overview of all blood tests"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {filteredBloodTests.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Tests
                  </div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {new Set(filteredBloodTests.map(b => b.drugName)).size}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Drugs Tested
                  </div>
                </div>
              </div>

              {filteredBloodTests.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Recent Tests</h4>
                  <div className="space-y-2">
                    {filteredBloodTests
                      .sort((a, b) => b.testDate.getTime() - a.testDate.getTime())
                      .slice(0, 5)
                      .map((test) => (
                        <div key={test.id} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{test.drugName}</div>
                              <div className="text-sm text-muted-foreground">
                                {test.concentration} {test.unit}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {test.timeAfterDose}h after dose
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {test.testDate.toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {filteredBloodTests.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Concentration Trends</h4>
                  <div className="space-y-2">
                    {Array.from(new Set(filteredBloodTests.map(b => b.drugName))).map(drugName => {
                      const drugTests = filteredBloodTests.filter(b => b.drugName === drugName);
                      const avgConcentration = drugTests.reduce((sum, test) => sum + test.concentration, 0) / drugTests.length;
                      const lastTest = drugTests.sort((a, b) => b.testDate.getTime() - a.testDate.getTime())[0];
                      
                      return (
                        <div key={drugName} className="flex justify-between items-center p-2 border rounded">
                          <span className="font-medium">{drugName}</span>
                          <div className="text-right">
                            <div className="text-sm">Avg: {avgConcentration.toFixed(2)} {lastTest.unit}</div>
                            <div className="text-xs text-muted-foreground">{drugTests.length} tests</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blood Test Results Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Blood Test Results
          </CardTitle>
          <CardDescription>
            Complete blood test records 
            {selectedPatient && ` for ${selectedPatient.name}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredBloodTests.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Drug Name</TableHead>
                    <TableHead>Concentration</TableHead>
                    <TableHead>Time After Dose</TableHead>
                    <TableHead>Test Date</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBloodTests
                    .sort((a, b) => b.testDate.getTime() - a.testDate.getTime())
                    .map((test) => {
                      const patient = patients.find(p => p.id === test.patientId);
                      return (
                        <TableRow key={test.id}>
                          <TableCell className="font-medium">
                            <span title={patient?.name || "Unknown"}>
                              {patient?.name && patient.name.length > 5 
                                ? `${patient.name.slice(0, 4)}...` 
                                : (patient?.name || "Unknown")}
                            </span>
                          </TableCell>
                          <TableCell>{test.drugName}</TableCell>
                          <TableCell>
                            {test.concentration} {test.unit}
                          </TableCell>
                          <TableCell>{test.timeAfterDose}h</TableCell>
                          <TableCell>
                            {test.testDate.toLocaleDateString()} {test.testDate.toLocaleTimeString()}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {test.notes || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No blood test results recorded yet</p>
              <p className="text-sm text-muted-foreground">
                Record your first blood test using the form above
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BloodTestResults;
