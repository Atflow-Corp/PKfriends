import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from "sonner";
import Header from '@/components/ui/Header';
import Footer from '@/components/ui/Footer';

interface LoginPageProps {
  onLogin: () => void;
  onShowTermsAgreement: () => void;
  onPhoneNumberSet?: (phoneNumber: string) => void;
}

// Demo: List of invited phone numbers (임시처리)
const invitedPhoneNumbers = ["01012345678", "01087654321"];

// 임시: 회원가입 완료 여부 확인 (실제로는 API로 확인)
const checkUserRegistered = (phoneNumber: string): boolean => {
  try {
    const registeredUsers = JSON.parse(window.localStorage.getItem('tdmfriends:registeredUsers') || '[]');
    return registeredUsers.includes(phoneNumber);
  } catch {
    return false;
  }
};

const LoginPage = ({ onLogin, onShowTermsAgreement, onPhoneNumberSet }: LoginPageProps) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  // 인증번호 전송 핸들러
  const handleSendVerification = () => {
    if (!phoneNumber) {
      toast.error("휴대폰 번호를 입력해주세요.");
      return;
    }
    
    const phoneRegex = /^010\d{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
      toast.error("올바른 휴대폰 번호 형식을 입력해주세요. (010으로 시작하는 11자리)");
      return;
    }

    // 임시처리: 초대받은 전화번호 데이터를 구축하지 않은 상태이므로
    // 모든 번호를 초대받은 사용자로 처리하고 인증 단계로 진행
    // TODO: 실제 초대받은 번호 데이터 구축 후 아래 주석 처리된 로직으로 교체
    // if (!invitedPhoneNumbers.includes(phoneNumber)) {
    //   toast.error("초대받지 않은 번호입니다. 관리자에게 문의하세요.");
    //   return;
    // }

    // 임시처리: 초대받은 사용자인 경우 별도 알림 없이 즉시 인증 API 호출
    // 실제 앱에서는 여기서 인증번호 발송 API를 호출합니다.
    console.log(`인증번호 발송 API 호출: ${phoneNumber}`);
    setIsVerificationSent(true);
    // 알림 없이 조용히 인증번호 입력창 노출
  };

  // 로그인 핸들러
  const handleLogin = () => {
    if (!verificationCode) {
      toast.error("인증번호를 입력해주세요.");
      return;
    }

    // 임시처리: 인증번호 확인 API 호출
    console.log(`인증번호 확인 API 호출: ${phoneNumber}, 코드: ${verificationCode}`);
    // 실제 앱에서는 여기서 인증번호 검증 API를 호출하고 응답을 확인합니다.
    // 임시처리: 여기서는 항상 성공으로 가정

    // 인증 성공 후 회원가입 여부 확인
    const isRegistered = checkUserRegistered(phoneNumber);

    if (!isRegistered) {
      // 회원가입 안 한 경우: 약관 동의로 이동
      onPhoneNumberSet?.(phoneNumber);
      onShowTermsAgreement();
    } else {
      // 회원가입 한 경우: 서비스 홈으로 이동
      toast.success("로그인되었습니다.");
      onLogin();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900">
      <Header />
      <div className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">TDM Friends</CardTitle>
            <CardDescription>Precision Medicine의 시작</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center text-sm text-muted-foreground space-y-1">
                <p>초대받은 휴대폰 번호를 입력한 후 인증해주세요.</p>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="휴대폰 번호 ('-' 제외)"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="flex-1 h-10"
                  />
                  <Button 
                    variant="outline" 
                    className="text-gray-600 border-gray-300 hover:bg-gray-50 h-10"
                    onClick={handleSendVerification}
                  >
                    인증번호 전송
                  </Button>
                </div>
                {isVerificationSent && (
                  <Input
                    type="text"
                    placeholder="인증번호를 입력하세요"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="h-10"
                    maxLength={6}
                  />
                )}
              </div>
              <Button 
                onClick={handleLogin} 
                className="w-full flex items-center gap-2"
                disabled={!isVerificationSent || !verificationCode}
              >
                로그인
              </Button>
              <div className="text-center space-y-2">
                <div className="text-xs text-muted-foreground pt-2 space-y-1">
                  <p>TDM Friends는 초대 기반으로 운영하고 있습니다.</p>
                  <p>사용에 관심이 있으신 분은 contact@pkfriend.co.kr로 문의주세요.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default LoginPage; 