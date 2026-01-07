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
  
  // 한글 입력 조합 중인지 확인하는 상태
  const [isComposing, setIsComposing] = useState(false);

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

  // 이름 입력 검증 함수
  const validateNameInput = (value: string, previousValue: string): { value: string; shouldShowToast: boolean } => {
    // 허용 문자: 한글, 영문, 띄어쓰기, 하이픈(-), 아포스트로피(')
    const allowedPattern = /^[가-힣a-zA-Z\s\-']*$/;
    
    // 허용 문자 외 입력 체크
    if (!allowedPattern.test(value)) {
      // 허용되지 않는 문자 제거
      const cleaned = value.replace(/[^가-힣a-zA-Z\s\-']/g, '');
      // 제거된 문자가 실제로 있었는지 확인 (이전 값과 다를 때만 알림)
      const shouldShowToast = cleaned !== previousValue && value !== previousValue;
      // 제거 후 다시 검증 (한글/영문 혼용 체크)
      const result = validateNameInput(cleaned, previousValue);
      return { value: result.value, shouldShowToast: shouldShowToast || result.shouldShowToast };
    }
    
    // 한글과 영문 혼용 여부 확인
    const hasKorean = /[가-힣]/.test(value);
    const hasEnglish = /[a-zA-Z]/.test(value);
    const prevHasKorean = /[가-힣]/.test(previousValue);
    const prevHasEnglish = /[a-zA-Z]/.test(previousValue);
    
    // 실제로 혼용이 발생했을 때만 알림 (이전에는 혼용이 없었고, 현재 혼용이 있는 경우)
    if (hasKorean && hasEnglish && !(prevHasKorean && prevHasEnglish)) {
      return { value: previousValue, shouldShowToast: true }; // 이전 값 반환
    }
    
    // 글자 수 제한
    if (hasKorean) {
      // 한글인 경우 최대 50자
      if (value.length > 50) {
        // 이전 값이 50자 이하이고 현재 값이 50자 초과인 경우에만 알림 표시
        const shouldShowToast = previousValue.length <= 50 && value.length > 50;
        return { value: value.slice(0, 50), shouldShowToast };
      }
    } else if (hasEnglish) {
      // 영문인 경우 최대 100자
      if (value.length > 100) {
        // 이전 값이 100자 이하이고 현재 값이 100자 초과인 경우에만 알림 표시
        const shouldShowToast = previousValue.length <= 100 && value.length > 100;
        return { value: value.slice(0, 100), shouldShowToast };
      }
    }
    // 띄어쓰기만 있거나 빈 문자열도 허용 (trim() 체크 제거)
    
    return { value, shouldShowToast: false };
  };

  const handleInputChange = (field: string, value: string) => {
    // 이름 필드인 경우 검증 로직 적용
    if (field === 'name') {
      // 한글 입력 조합 중이면 검증 건너뛰기
      if (isComposing) {
        setFormData(prev => ({
          ...prev,
          [field]: value
        }));
        return;
      }
      
      const previousValue = formData.name;
      const result = validateNameInput(value, previousValue);
      
      // 알림 표시
      if (result.shouldShowToast) {
        // 글자 수 초과인지 확인
        const hasKorean = /[가-힣]/.test(value);
        const hasEnglish = /[a-zA-Z]/.test(value);
        
        if (hasKorean && value.length > 50) {
          toast.error("한글 이름은 최대 50자까지 입력 가능합니다.");
        } else if (hasEnglish && value.length > 100) {
          toast.error("영문 이름은 최대 100자까지 입력 가능합니다.");
        } else {
          toast.error("이름은 한글 또는 영문으로 입력해 주세요. \n (띄어쓰기, 하이픈(-), 아포스트로피(') 사용 가능)");
        }
      }
      
      setFormData(prev => ({
        ...prev,
        [field]: result.value
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };
  
  // 한글 입력 조합 시작
  const handleCompositionStart = () => {
    setIsComposing(true);
  };
  
  // 한글 입력 조합 종료
  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    // 조합 종료 후 최종 검증
    handleInputChange('name', e.currentTarget.value);
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
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                  maxLength={100}
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
