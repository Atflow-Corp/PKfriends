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
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  
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
    // 빈 문자열은 허용 (입력 중일 수 있음)
    if (value === '') {
      return { value: '', shouldShowToast: false };
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
    
    let cleaned = value;
    let shouldShowToast = false;
    
    if (hasKorean) {
      // 한글인 경우: 완성형 한글만 허용 (자음/모음만 있는 경우 제거)
      // 완성형 한글: 가-힣 (U+AC00 ~ U+D7A3)
      // 자음: ㄱ-ㅎ (U+3131 ~ U+314E)
      // 모음: ㅏ-ㅣ (U+314F ~ U+3163)
      
      // 자음/모음만 있는지 확인
      const hasOnlyJamo = /^[ㄱ-ㅎㅏ-ㅣ]+$/.test(value);
      if (hasOnlyJamo) {
        // 자음/모음만 있는 경우 이전 값 유지
        return { value: previousValue, shouldShowToast: true };
      }
      
      // 완성형 한글만 남기고 나머지 제거
      cleaned = value.replace(/[^가-힣]/g, '');
      // 자음/모음도 제거
      cleaned = cleaned.replace(/[ㄱ-ㅎㅏ-ㅣ]/g, '');
      
      if (cleaned !== value) {
        shouldShowToast = cleaned !== previousValue && value !== previousValue;
      }
      
      // 한글 길이 제한: 2~10자
      if (cleaned.length > 10) {
        const shouldShowToastForLength = previousValue.length <= 10 && cleaned.length > 10;
        cleaned = cleaned.slice(0, 10);
        shouldShowToast = shouldShowToast || shouldShowToastForLength;
      }
    } else if (hasEnglish) {
      // 영문인 경우: 영문, 띄어쓰기, comma(,), dash(-)만 허용 (숫자 불가)
      const englishPattern = /^[a-zA-Z\s,\-]*$/;
      if (!englishPattern.test(value)) {
        // 허용되지 않는 문자 제거
        cleaned = value.replace(/[^a-zA-Z\s,\-]/g, '');
        shouldShowToast = cleaned !== previousValue && value !== previousValue;
      }
      
      // 영문 길이 제한: 2~50자
      if (cleaned.length > 50) {
        const shouldShowToastForLength = previousValue.length <= 50 && cleaned.length > 50;
        cleaned = cleaned.slice(0, 50);
        shouldShowToast = shouldShowToast || shouldShowToastForLength;
      }
    } else {
      // 한글도 영문도 없는 경우 (숫자나 특수문자만 입력된 경우)
      cleaned = '';
      shouldShowToast = value !== previousValue;
    }
    
    return { value: cleaned, shouldShowToast };
  };

  // 이름 입력 검증 메시지 생성 함수
  const getNameValidationMessage = (value: string): string | null => {
    if (!value || value.trim() === '') {
      return null;
    }
    
    const hasKorean = /[가-힣]/.test(value);
    const hasEnglish = /[a-zA-Z]/.test(value);
    
    // 자음/모음만 입력된 경우
    const hasOnlyJamo = /^[ㄱ-ㅎㅏ-ㅣ]+$/.test(value);
    if (hasOnlyJamo) {
      return "완성된 한글만 입력 가능합니다. (자음/모음만 입력 불가)";
    }
    
    // 국영문 혼용 체크
    if (hasKorean && hasEnglish) {
      return "이름은 한글 또는 영문으로만 입력해 주세요. (혼용 불가)";
    }
    
    // 한글 검증
    if (hasKorean) {
      if (value.length < 2) {
        return "한글 이름은 2자 이상 입력해 주세요.";
      }
      if (value.length > 10) {
        return "한글 이름은 2~10자까지 입력 가능합니다.";
      }
      // 한글에 띄어쓰기, 숫자, 특수문자가 포함된 경우
      if (/[\s0-9]/.test(value) || /[^가-힣]/.test(value)) {
        return "한글 이름은 한글만 입력 가능합니다. (띄어쓰기, 숫자, 특수문자 불가)";
      }
    }
    
    // 영문 검증
    if (hasEnglish) {
      if (value.length < 2) {
        return "영문 이름은 2자 이상 입력해 주세요.";
      }
      if (value.length > 50) {
        return "영문 이름은 2~50자까지 입력 가능합니다.";
      }
      // 영문에 숫자나 허용되지 않는 특수문자가 포함된 경우
      if (/[0-9]/.test(value)) {
        return "영문 이름에는 숫자를 입력할 수 없습니다.";
      }
      // comma, dash 외 특수문자 체크
      if (/[^a-zA-Z\s,\-]/.test(value)) {
        return "영문 이름은 영문, 띄어쓰기, comma(,), dash(-)만 입력 가능합니다.";
      }
    }
    
    // 한글도 영문도 없는 경우
    if (!hasKorean && !hasEnglish && value.length > 0) {
      return "이름은 한글 또는 영문으로 입력해 주세요.";
    }
    
    return null;
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
      
      // 실시간 에러 메시지는 입력창 하단에 표시되므로 토스트 팝업 제거
      
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
    // 기본 필수 항목 체크
    const hasRequiredFields = formData.name.trim() !== '' && 
                              formData.phoneNumber.trim() !== '' && 
                              formData.organization !== '' && 
                              formData.medicalRole !== '';
    
    // 이름 검증 오류가 있는지 체크
    const nameValidationError = getNameValidationMessage(formData.name);
    
    // 필수 항목이 모두 입력되었고, 이름 검증 오류가 없을 때만 true 반환
    return hasRequiredFields && !nameValidationError;
  };

  const handleComplete = () => {
    // isFormValid()가 false면 버튼이 비활성화되어 있어서 여기 도달하지 않지만,
    // 추가 검증을 위해 체크 (입력창 하단 메시지와 버튼 비활성화로 충분하므로 토스트 제거)
    if (!isFormValid()) {
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
      
      setShowWelcomeDialog(false);
      onComplete();
    } catch (error) {
      console.error('회원가입 정보 저장 실패:', error);
      setShowWelcomeDialog(false);
      setShowErrorDialog(true);
    }
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
                {getNameValidationMessage(formData.name) && (
                  <p className="text-xs text-red-500 mt-1">
                    {getNameValidationMessage(formData.name)}
                  </p>
                )}
              </div>

              {/* 휴대폰 번호 */}
              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="text-sm font-medium">
                  휴대폰 번호 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder={formData.phoneNumber ? "" : "로그인 시 입력한 번호가 자동으로 표시됩니다"}
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  휴대폰 번호 변경은 시스템관리자에게 문의해주세요.
                </p>
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

      {/* 에러 메시지 얼럿 */}
      <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-xl font-bold text-red-600">
              오류 발생
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base py-4">
              회원가입 정보 저장 중 오류가 발생했습니다.<br />
              다시 시도해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-center">
            <AlertDialogAction 
              onClick={() => setShowErrorDialog(false)}
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
