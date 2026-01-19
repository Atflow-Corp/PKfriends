import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Camera } from "lucide-react";
import { storage, STORAGE_KEYS } from "@/lib/storage";

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  organization: string;
  role: "doctor" | "nurse" | "other";
  profileImage?: string;
}

interface ProfileSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProfileSettings = ({ open, onOpenChange }: ProfileSettingsProps) => {
  const [savedProfile, setSavedProfile] = useState<UserProfile>({
    name: "사용자",
    email: "user@pk-friends.com",
    phone: "",
    organization: "PK 프렌즈 대학병원",
    role: "doctor",
  });
  const [tempProfile, setTempProfile] = useState<UserProfile>({
    name: "사용자",
    email: "user@pk-friends.com",
    phone: "",
    organization: "PK 프렌즈 대학병원",
    role: "doctor",
  });
  
  // 한글 입력 조합 중인지 확인하는 상태
  const [isComposing, setIsComposing] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [tempProfileImage, setTempProfileImage] = useState<string | null>(null);

  // 사전 등록된 소속기관 목록 (나에게 지정된 소속기관)
  const baseOrganizations = ['앳플로우'];
  
  // 현재 프로필의 소속기관을 포함한 목록 생성
  const getOrganizations = () => {
    const orgSet = new Set(baseOrganizations);
    if (tempProfile.organization && tempProfile.organization.trim() !== '') {
      orgSet.add(tempProfile.organization);
    }
    return Array.from(orgSet);
  };
  const organizations = getOrganizations();

  useEffect(() => {
    if (open) {
      loadProfile();
    }
  }, [open]);

  const loadProfile = () => {
    const saved = storage.getJSON<UserProfile>(STORAGE_KEYS.userProfile);
    if (saved) {
      setSavedProfile(saved);
      setTempProfile(saved);
      if (saved.profileImage) {
        setProfileImage(saved.profileImage);
        setTempProfileImage(saved.profileImage);
      } else {
        setProfileImage(null);
        setTempProfileImage(null);
      }
    }
  };

  const handleSave = () => {
    // 이름 검증 오류가 있으면 저장하지 않음 (입력창 하단 메시지와 버튼 비활성화로 충분)
    const nameValidationError = getNameValidationMessage(tempProfile.name);
    if (nameValidationError) {
      return;
    }
    
    const updatedProfile = { ...tempProfile, profileImage: tempProfileImage || undefined };
    setSavedProfile(updatedProfile);
    setProfileImage(tempProfileImage);
    storage.setJSON(STORAGE_KEYS.userProfile, updatedProfile);
    // 부모 컴포넌트에 변경 사항 알림 (필요한 경우)
    onOpenChange(false);
  };

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

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 한글 입력 조합 중이면 검증 건너뛰기
    if (isComposing) {
      setTempProfile({ ...tempProfile, name: e.target.value });
      return;
    }
    
    const previousValue = tempProfile.name;
    const result = validateNameInput(e.target.value, previousValue);
    
    // 실시간 에러 메시지는 입력창 하단에 표시되므로 토스트 팝업 제거
    
    setTempProfile({ ...tempProfile, name: result.value });
  };
  
  // 한글 입력 조합 시작
  const handleCompositionStart = () => {
    setIsComposing(true);
  };
  
  // 한글 입력 조합 종료
  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    // 조합 종료 후 최종 검증
    handleNameChange(e as any);
  };


  const handleOrganizationChange = (value: string) => {
    setTempProfile({ ...tempProfile, organization: value });
  };

  const handleRoleChange = (value: string) => {
    const roleMap: Record<string, "doctor" | "nurse" | "other"> = {
      "의사": "doctor",
      "간호사": "nurse",
      "기타": "other",
    };
    setTempProfile({ ...tempProfile, role: roleMap[value] || "other" });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 파일 크기 검증 (5MB 제한)
      if (file.size > 5 * 1024 * 1024) {
        alert("파일 크기는 5MB 이하여야 합니다.");
        return;
      }

      // 이미지 파일 타입 검증
      if (!file.type.startsWith("image/")) {
        alert("이미지 파일만 업로드 가능합니다.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const imageDataUrl = reader.result as string;
        setTempProfileImage(imageDataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  // 변경사항이 있는지 확인
  const hasChanges = () => {
    return (
      tempProfile.name !== savedProfile.name ||
      tempProfile.organization !== savedProfile.organization ||
      tempProfile.role !== savedProfile.role ||
      tempProfileImage !== (savedProfile.profileImage || null)
    );
  };


  const getRoleLabel = (role: string) => {
    switch (role) {
      case "doctor":
        return "의사";
      case "nurse":
        return "간호사";
      case "other":
        return "기타";
      default:
        return role;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&>button]:h-10 [&>button]:w-10 [&>button_svg]:h-6 [&>button_svg]:w-6">
          <DialogHeader>
            <DialogTitle>프로필 설정</DialogTitle>
            <DialogDescription>
              사용자 정보를 확인하고 프로필을 관리할 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 프로필 사진 및 사용자 정보 - 좌우 2단 구조 */}
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* 왼쪽: 프로필 사진 */}
                  <div className="space-y-4">
                    {/* <div>
                      <h3 className="text-lg font-semibold mb-1">프로필 사진</h3>
                      <p className="text-sm text-muted-foreground">프로필 사진을 변경할 수 있습니다.</p>
                    </div> */}
                    <div className="flex flex-col items-center gap-4">
                      <Avatar className="h-32 w-32">
                        <AvatarImage src={tempProfileImage || tempProfile.profileImage} alt={tempProfile.name} />
                        <AvatarFallback className="text-3xl">
                          {tempProfile.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-2 w-full">
                        <Label htmlFor="profile-image" className="cursor-pointer">
                          <Button variant="outline" asChild className="w-full">
                            <span>
                              <Camera className="h-4 w-4 mr-2" />
                              사진 변경
                            </span>
                          </Button>
                        </Label>
                        <Input
                          id="profile-image"
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                        <p className="text-xs text-muted-foreground text-center">
                          JPG, PNG, BMP 형식 지원 (최대 5MB)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 오른쪽: 사용자 정보 */}
                  <div className="space-y-4">
                    {/* <div>
                      <h3 className="text-lg font-semibold mb-1">사용자 정보</h3>
                      <p className="text-sm text-muted-foreground">사용자 정보를 확인할 수 있습니다.</p>
                    </div> */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>이름</Label>
                        <Input 
                          type="text"
                          value={tempProfile.name} 
                          onChange={handleNameChange}
                          onCompositionStart={handleCompositionStart}
                          onCompositionEnd={handleCompositionEnd}
                          maxLength={100}
                        />
                        {getNameValidationMessage(tempProfile.name) && (
                          <p className="text-xs text-red-500 mt-1">
                            {getNameValidationMessage(tempProfile.name)}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>전화번호</Label>
                        <Input 
                          value={tempProfile.phone || ""} 
                          disabled
                          className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">
                          전화번호 변경은 고객센터로 문의주세요.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>소속기관</Label>
                        <Select 
                          value={tempProfile.organization} 
                          onValueChange={handleOrganizationChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="소속기관을 선택하세요" />
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
                      <div className="space-y-2">
                        <Label>직무</Label>
                        <Select 
                          value={getRoleLabel(tempProfile.role)} 
                          onValueChange={handleRoleChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="직무를 선택하세요" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="의사">의사</SelectItem>
                            <SelectItem value="간호사">간호사</SelectItem>
                            <SelectItem value="기타">기타</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="pt-2">
                        <Button
                          onClick={handleSave}
                          disabled={!hasChanges() || !!getNameValidationMessage(tempProfile.name)}
                          className="w-full"
                        >
                          저장
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
};

export default ProfileSettings;

