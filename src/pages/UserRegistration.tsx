import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft } from 'lucide-react';
import { toast } from "sonner";
import Header from '@/components/ui/Header';
import Footer from '@/components/ui/Footer';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import type { UserProfile } from '@/components/ProfileSettings';

interface UserRegistrationProps {
  onBack: () => void;
  onComplete: () => void;
  initialPhoneNumber?: string;
}

const UserRegistration = ({ onBack, onComplete, initialPhoneNumber = '' }: UserRegistrationProps) => {
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: initialPhoneNumber,
    organization: '',
    medicalRole: ''
  });
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);

  // 사전 등록된 병원 목록
  const organizations = ['앳플로우'];
  
  // 의료진 구분 목록
  const medicalRoles = ['의사', '간호사', '기타'];
  
  // initialPhoneNumber가 변경되면 formData 업데이트
  useEffect(() => {
    if (initialPhoneNumber) {
      setFormData(prev => ({
        ...prev,
        phoneNumber: initialPhoneNumber
      }));
    }
  }, [initialPhoneNumber]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };


  const isFormValid = () => {
    return formData.name.trim() !== '' && 
           formData.phoneNumber.trim() !== '' && 
           formData.organization !== '' && 
           formData.medicalRole !== '';
  };

  const handleComplete = () => {
    if (!isFormValid()) {
      toast.error("모든 필수 항목을 입력해주세요.");
      return;
    }

    setShowWelcomeDialog(true);
  };

  const handleWelcomeConfirm = () => {
    try {
      // 회원가입 완료된 전화번호를 localStorage에 저장 (기존 로직 유지)
      const registeredUsers = JSON.parse(window.localStorage.getItem('tdmfriends:registeredUsers') || '[]');
      if (!registeredUsers.includes(formData.phoneNumber)) {
        registeredUsers.push(formData.phoneNumber);
        window.localStorage.setItem('tdmfriends:registeredUsers', JSON.stringify(registeredUsers));
      }
      
      // 사용자 프로필 정보를 localStorage에 저장
      const userProfile: UserProfile = {
        name: formData.name,
        email: '', // 회원가입 시 이메일 입력 없음
        phone: formData.phoneNumber,
        organization: formData.organization,
        role: formData.medicalRole === '의사' ? 'doctor' : 
              formData.medicalRole === '간호사' ? 'nurse' : 'other',
      };
      
      storage.setJSON(STORAGE_KEYS.userProfile, userProfile);
      console.log('회원가입 정보가 저장되었습니다:', userProfile);
    } catch (error) {
      console.error('회원가입 정보 저장 실패:', error);
      toast.error('회원가입 정보 저장 중 오류가 발생했습니다.');
    }
    
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
