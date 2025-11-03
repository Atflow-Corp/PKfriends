import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Smartphone, ArrowLeft } from 'lucide-react';
import { toast } from "sonner";
import Header from '@/components/ui/Header';
import Footer from '@/components/ui/Footer';

interface LoginPageProps {
  onLogin: () => void;
  onShowTermsAgreement: () => void;
  onPhoneNumberSet?: (phoneNumber: string) => void;
}

// Demo: List of invited phone numbers
const invitedPhoneNumbers = ["01012345678", "01087654321"];

const LoginPage = ({ onLogin, onShowTermsAgreement, onPhoneNumberSet }: LoginPageProps) => {
  const [view, setView] = useState<'login' | 'signup' | 'invitation-check'>('login');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const handleLogin = () => {
    if (!verificationCode) {
      toast.error("인증번호를 입력해주세요.");
      return;
    }
    // 실제 앱에서는 여기서 인증번호 검증 API를 호출합니다.
    console.log(`인증번호 검증: ${verificationCode}`);
    toast.success("로그인되었습니다.");
    onLogin();
  };

  const handleInvitationCheck = () => {
    if (!phoneNumber) {
      toast.error("휴대폰 번호를 입력해주세요.");
      return;
    }

    if (!verificationCode) {
      toast.error("인증번호를 입력해주세요.");
      return;
    }

    // 임시: 전화번호 형식이 올바르면 통과 (010으로 시작하고 11자리)
    const phoneRegex = /^010\d{8}$/;
    if (phoneRegex.test(phoneNumber)) {
      // 실제 앱에서는 여기서 인증번호 검증 API를 호출합니다.
      console.log(`인증번호 검증: ${verificationCode}`);
      // 휴대폰 번호를 상위 컴포넌트로 전달
      onPhoneNumberSet?.(phoneNumber);
      toast.success("초대된 사용자입니다. 약관 동의를 진행합니다.");
      onShowTermsAgreement();
    } else {
      toast.error("올바른 휴대폰 번호 형식을 입력해주세요. (010으로 시작하는 11자리)");
    }
  };

  const handleSignupCheck = () => {
    if (!phoneNumber) {
      toast.error("휴대폰 번호를 입력해주세요.");
      return;
    }

    if (invitedPhoneNumbers.includes(phoneNumber)) {
      toast.success("초대된 사용자입니다. 본인 인증을 진행합니다.");
      // In a real app, you would proceed to the actual identity verification process.
      // For demo, we'll just log it.
      console.log(`Proceeding with verification for ${phoneNumber}`);
    } else {
      toast.error("초대받지 않은 번호입니다. 관리자에게 문의하세요.");
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
            {view === 'login' && (
              <div className="space-y-4">
                 <div className="text-center text-sm text-muted-foreground space-y-1">
                  
                  <p>초대받은 휴대폰 번호를 입력한 후 인증해주세요.</p>
                </div>
                <div className="space-y-2">
                 {/*} <label htmlFor="phone" className="text-sm font-medium">
                    본인 인증 후 서비스를 이용할 수 있습니다.
                  </label>*/}
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
                      onClick={() => {
                        if (!phoneNumber) {
                          toast.error("휴대폰 번호를 입력해주세요.");
                          return;
                        }
                        const phoneRegex = /^010\d{8}$/;
                        if (!phoneRegex.test(phoneNumber)) {
                          toast.error("올바른 휴대폰 번호 형식을 입력해주세요. (010으로 시작하는 11자리)");
                          return;
                        }
                        setIsVerificationSent(true);
                        toast.success("인증번호가 전송되었습니다.");
                      }}
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
                  <Button variant="link" className="text-blue-600 hover:text-blue-800" onClick={() => setView('invitation-check')}>
                    회원가입
                  </Button>
                  <div className="text-xs text-muted-foreground pt-2 space-y-1">
                    <p>TDM Friends는 초대 기반으로 운영하고 있습니다.</p>
                    <p>사용에 관심이 있으신 분은 contact@pkfriend.co.kr로 문의주세요.</p>
                  </div>
                </div>
              </div>
            )}

            {view === 'invitation-check' && (
              <div className="space-y-4">
                <div className="text-center text-sm text-muted-foreground space-y-1">
                  <p>초대받은 휴대폰 번호를 입력해주세요.</p>
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="tel"
                      placeholder="휴대폰 번호 ('-' 제외)"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="flex-1 h-10"
                    />
                    <Button 
                      variant="outline" 
                      className="text-gray-600 border-gray-300 hover:bg-gray-50 h-10"
                      onClick={() => {
                        if (!phoneNumber) {
                          toast.error("휴대폰 번호를 입력해주세요.");
                          return;
                        }
                        const phoneRegex = /^010\d{8}$/;
                        if (!phoneRegex.test(phoneNumber)) {
                          toast.error("올바른 휴대폰 번호 형식을 입력해주세요. (010으로 시작하는 11자리)");
                          return;
                        }
                        setIsVerificationSent(true);
                        toast.success("인증번호가 전송되었습니다.");
                      }}
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
                  onClick={handleInvitationCheck} 
                  className="w-full"
                  disabled={!isVerificationSent || !verificationCode}
                >
                  확인
                </Button>
                <Button variant="ghost" onClick={() => setView('login')} className="w-full flex items-center gap-2 text-sm">
                  <ArrowLeft className="h-4 w-4" />
                  로그인으로 돌아가기
                </Button>
              </div>
            )}

            {view === 'signup' && (
              <div className="space-y-4">
                <p className="text-center text-sm text-muted-foreground">
                  초대 받은 휴대폰 번호를 입력해주세요.
                </p>
                <Input
                  type="tel"
                  placeholder="휴대폰 번호 ('-' 제외)"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <Button onClick={handleSignupCheck} className="w-full">
                  확인
                </Button>
                
                <Button variant="ghost" onClick={() => setView('login')} className="w-full flex items-center gap-2 text-sm">
                  <ArrowLeft className="h-4 w-4" />
                  로그인으로 돌아가기
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default LoginPage; 