import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft } from 'lucide-react';
import { toast } from "sonner";
import { Link } from 'react-router-dom';
import Header from '@/components/ui/Header';
import Footer from '@/components/ui/Footer';

interface TermsAgreementProps {
  onBack: () => void;
  onAgree: () => void;
}

const TermsAgreement = ({ onBack, onAgree }: TermsAgreementProps) => {
  const [agreements, setAgreements] = useState({
    allAgreed: true,
    ageCheck: true,
    serviceTerms: true,
    privacyPolicy: true
  });

  const handleAllAgreementChange = (checked: boolean) => {
    setAgreements({
      allAgreed: checked,
      ageCheck: checked,
      serviceTerms: checked,
      privacyPolicy: checked
    });
  };

  const handleIndividualAgreementChange = (key: keyof typeof agreements, checked: boolean) => {
    const newAgreements = {
      ...agreements,
      [key]: checked
    };
    
    // 전체 동의 체크박스 상태 업데이트
    newAgreements.allAgreed = newAgreements.ageCheck && newAgreements.serviceTerms && newAgreements.privacyPolicy;
    
    setAgreements(newAgreements);
  };

  const handleConfirm = () => {
    if (!agreements.ageCheck || !agreements.serviceTerms || !agreements.privacyPolicy) {
      toast.error("필수 약관에 동의해주세요.");
      return;
    }
    
    toast.success("약관에 동의하셨습니다.");
    onAgree();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900">
      <Header />
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">약관 동의</CardTitle>
            <CardDescription>서비스 이용을 위한 약관에 동의해주세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 약관 동의 박스 */}
            <div className="border rounded-lg p-4 space-y-4 bg-gray-50 dark:bg-gray-800">
              {/* 전체 동의 */}
              <div className="flex items-center space-x-2 border-b pb-3">
                <Checkbox
                  id="all-agreed"
                  checked={agreements.allAgreed}
                  onCheckedChange={handleAllAgreementChange}
                />
                <label
                  htmlFor="all-agreed"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  서비스 이용약관에 모두 동의합니다.
                </label>
              </div>

              {/* 개별 약관들 */}
              <div className="space-y-3 pl-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="age-check"
                    checked={agreements.ageCheck}
                    onCheckedChange={(checked) => handleIndividualAgreementChange('ageCheck', checked as boolean)}
                  />
                  <label
                    htmlFor="age-check"
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    <span className="text-red-500">(필수)</span> 만 14세 이상입니다.
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="service-terms"
                    checked={agreements.serviceTerms}
                    onCheckedChange={(checked) => handleIndividualAgreementChange('serviceTerms', checked as boolean)}
                  />
                  <label
                    htmlFor="service-terms"
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    <span className="text-red-500">(필수)</span> 서비스 이용약관 동의
                  </label>
                  <Link 
                    to="/terms" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 underline ml-1"
                  >
                    전문보기
                  </Link>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="privacy-policy"
                    checked={agreements.privacyPolicy}
                    onCheckedChange={(checked) => handleIndividualAgreementChange('privacyPolicy', checked as boolean)}
                  />
                  <label
                    htmlFor="privacy-policy"
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    <span className="text-red-500">(필수)</span> 개인정보 처리방침 동의
                  </label>
                  <Link 
                    to="/privacy" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 underline ml-1"
                  >
                    전문보기
                  </Link>
                </div>
              </div>
            </div>

            {/* 확인 버튼 */}
            <Button 
              onClick={handleConfirm} 
              className="w-full"
              disabled={!agreements.ageCheck || !agreements.serviceTerms || !agreements.privacyPolicy}
            >
              확인
            </Button>

            {/* 뒤로가기 버튼 */}
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
    </div>
  );
};

export default TermsAgreement;
