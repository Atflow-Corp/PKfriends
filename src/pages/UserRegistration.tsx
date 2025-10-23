import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Upload, X, FileText } from 'lucide-react';
import { toast } from "sonner";
import Header from '@/components/ui/Header';
import Footer from '@/components/ui/Footer';

interface UserRegistrationProps {
  onBack: () => void;
  onComplete: () => void;
}

const UserRegistration = ({ onBack, onComplete }: UserRegistrationProps) => {
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    organization: '',
    medicalRole: '',
    // 의료진 구분별 추가 정보
    medicalDepartment: '', // 진료 과목 (의사, 간호사)
    licenseNumber: '', // 면허 번호 (의사, 간호사)
    departmentName: '', // 부서명 (테크니션)
    licenseFile: null as File | null, // 면허증 파일 (의사, 간호사)
    employmentFile: null as File | null // 재직증명서 파일 (테크니션)
  });
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);

  // 사전 등록된 병원 목록
  const organizations = ['앳플로우'];
  
  // 의료진 구분 목록
  const medicalRoles = ['의사', '간호사', '테크니션'];
  
  // 진료 과목 목록
  const medicalDepartments = [
    '내과', '외과', '소아과', '산부인과', '정신과', '신경과', 
    '흉부외과', '정형외과', '신경외과', '비뇨기과', '피부과', 
    '안과', '이비인후과', '마취과', '영상의학과', '병리과', 
    '진단검사의학과', '응급의학과', '재활의학과', '가정의학과'
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = (field: 'licenseFile' | 'employmentFile', file: File | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: file
    }));
  };

  const handleFileButtonClick = (field: 'licenseFile' | 'employmentFile') => {
    const fileInput = document.querySelector(`input[type="file"][data-field="${field}"]`) as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  };

  const handleFileRemove = (field: 'licenseFile' | 'employmentFile') => {
    setFormData(prev => ({
      ...prev,
      [field]: null
    }));
    // 파일 입력 필드도 초기화
    const fileInput = document.querySelector(`input[type="file"][data-field="${field}"]`) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const isFormValid = () => {
    const basicValid = formData.name.trim() !== '' && 
                      formData.phoneNumber.trim() !== '' && 
                      formData.organization !== '' && 
                      formData.medicalRole !== '';
    
    if (!basicValid) return false;
    
    // 의료진 구분별 추가 검증
    if (formData.medicalRole === '의사' || formData.medicalRole === '간호사') {
      return formData.medicalDepartment !== '' && 
             formData.licenseNumber.trim() !== '' && 
             formData.licenseFile !== null;
    } else if (formData.medicalRole === '테크니션') {
      return formData.departmentName.trim() !== '' && 
             formData.employmentFile !== null;
    }
    
    return true;
  };

  const handleComplete = () => {
    if (!isFormValid()) {
      toast.error("모든 필수 항목을 입력해주세요.");
      return;
    }

    setShowWelcomeDialog(true);
  };

  const handleWelcomeConfirm = () => {
    setShowWelcomeDialog(false);
    onComplete();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900">
      <Header />
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">회원정보 입력</CardTitle>
            <CardDescription>회원가입을 위한 정보를 입력해주세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              {/* 이름 */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  이름 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="이름을 입력해주세요"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </div>

              {/* 휴대폰 번호 */}
              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="text-sm font-medium">
                  휴대폰 번호 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="휴대폰 번호를 입력해주세요 ('-' 제외)"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                />
              </div>

              {/* 소속기관 */}
              <div className="space-y-2">
                <Label htmlFor="organization" className="text-sm font-medium">
                  소속기관 <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.organization} onValueChange={(value) => handleInputChange('organization', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="소속기관을 선택해주세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org} value={org}>
                        {org}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 의료진 구분 */}
              <div className="space-y-2">
                <Label htmlFor="medicalRole" className="text-sm font-medium">
                  의료진 구분 <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.medicalRole} onValueChange={(value) => handleInputChange('medicalRole', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="의료진 구분을 선택해주세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {medicalRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 의료진 구분별 추가 정보 */}
              {(formData.medicalRole === '의사' || formData.medicalRole === '간호사') && (
                <>
                  {/* 진료 과목 */}
                  <div className="space-y-2">
                    <Label htmlFor="medicalDepartment" className="text-sm font-medium">
                      진료 과목 <span className="text-red-500">*</span>
                    </Label>
                    <Select value={formData.medicalDepartment} onValueChange={(value) => handleInputChange('medicalDepartment', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="진료 과목을 선택해주세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {medicalDepartments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 면허 번호 */}
                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber" className="text-sm font-medium">
                      {formData.medicalRole} 면허 번호 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="licenseNumber"
                      type="text"
                      placeholder={`${formData.medicalRole} 면허 번호를 입력해주세요`}
                      value={formData.licenseNumber}
                      onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                    />
                  </div>

                  {/* 면허증 파일 첨부 */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      면허증 파일 첨부 <span className="text-red-500">*</span>
                    </Label>
                    <div className="space-y-2">
                      {/* 숨겨진 파일 입력 */}
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload('licenseFile', e.target.files?.[0] || null)}
                        data-field="licenseFile"
                        className="hidden"
                      />
                      
                      {/* 파일 선택 버튼 */}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleFileButtonClick('licenseFile')}
                        className="w-full flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        {formData.licenseFile ? '파일 변경' : '파일 선택'}
                      </Button>
                      
                      {/* 선택된 파일 정보 */}
                      {formData.licenseFile && (
                        <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-md">
                          <span className="text-sm text-green-700 flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            {formData.licenseFile.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFileRemove('licenseFile')}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PDF, JPG, PNG 파일만 업로드 가능합니다.
                    </p>
                  </div>
                </>
              )}

              {formData.medicalRole === '테크니션' && (
                <>
                  {/* 부서명 */}
                  <div className="space-y-2">
                    <Label htmlFor="departmentName" className="text-sm font-medium">
                      부서명 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="departmentName"
                      type="text"
                      placeholder="부서명을 입력해주세요"
                      value={formData.departmentName}
                      onChange={(e) => handleInputChange('departmentName', e.target.value)}
                    />
                  </div>

                  {/* 재직증명서 파일 첨부 */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      재직증명서 파일 첨부 <span className="text-red-500">*</span>
                    </Label>
                    <div className="space-y-2">
                      {/* 숨겨진 파일 입력 */}
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload('employmentFile', e.target.files?.[0] || null)}
                        data-field="employmentFile"
                        className="hidden"
                      />
                      
                      {/* 파일 선택 버튼 */}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleFileButtonClick('employmentFile')}
                        className="w-full flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        {formData.employmentFile ? '파일 변경' : '파일 선택'}
                      </Button>
                      
                      {/* 선택된 파일 정보 */}
                      {formData.employmentFile && (
                        <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-md">
                          <span className="text-sm text-green-700 flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            {formData.employmentFile.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFileRemove('employmentFile')}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PDF, JPG, PNG 파일만 업로드 가능합니다.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* 회원가입 완료 버튼 */}
            <Button 
              onClick={handleComplete} 
              className="w-full"
              disabled={!isFormValid()}
            >
              회원가입 완료
            </Button>

            {/* 로그인으로 돌아가기 버튼 */}
            <Button 
              variant="ghost" 
              onClick={onBack} 
              className="w-full flex items-center gap-2 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              로그인으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
      <Footer />

      {/* 환영 메시지 얼럿 */}
      <AlertDialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-xl font-bold text-green-600">
              환영합니다!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base py-4">
              서비스 홈으로 이동하여<br />
              TDM 진행할 환자 정보를 등록해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-center">
            <AlertDialogAction 
              onClick={handleWelcomeConfirm}
              className="w-full max-w-xs"
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserRegistration;
