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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Camera } from "lucide-react";
import { storage, STORAGE_KEYS } from "@/lib/storage";
import CustomerService from "./CustomerService";

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
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [tempProfileImage, setTempProfileImage] = useState<string | null>(null);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showCustomerService, setShowCustomerService] = useState(false);

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
    const updatedProfile = { ...tempProfile, profileImage: tempProfileImage || undefined };
    setSavedProfile(updatedProfile);
    setProfileImage(tempProfileImage);
    storage.setJSON(STORAGE_KEYS.userProfile, updatedProfile);
    // 부모 컴포넌트에 변경 사항 알림 (필요한 경우)
    onOpenChange(false);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempProfile({ ...tempProfile, name: e.target.value });
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

  const handleDeleteAccount = () => {
    setShowDeleteAlert(true);
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
                          value={tempProfile.name} 
                          onChange={handleNameChange}
                        />
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
                          disabled={!hasChanges()}
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

            <Separator />

            {/* 계정 삭제 및 고객문의 링크 */}
            <div className="flex justify-center items-center gap-2 text-sm text-muted-foreground">
              <button
                onClick={handleDeleteAccount}
                className="underline hover:text-primary cursor-pointer"
              >
                계정삭제
              </button>
              <span>|</span>
              <button
                onClick={() => setShowCustomerService(true)}
                className="underline hover:text-primary cursor-pointer"
              >
                고객센터
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 계정 삭제 확인 AlertDialog */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>계정 삭제 안내</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
              TDM friends는 계정 삭제 전 데이터 위임 및 이관 확인 절차를 거치고 있습니다. 번거로우시더라도 관리자에게 문의해 주시면 안전하게 처리를 도와드리겠습니다.
              </p>
              <p className="font-semibold text-destructive">
                ⚠️ 주의: 계정 삭제 시 등록된 모든 환자 정보와 TDM 분석 데이터는 소속 기관 내 다른 관리자에게 위임되어야 합니다.
              </p>
              <div className="pt-2 border-t">
                <p className="font-medium">시스템 관리자 연락처</p>
                <p className="text-sm text-muted-foreground">
                  이메일: admin@tdmfriends.com
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>확인</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 고객센터 모달 */}
      <CustomerService
        open={showCustomerService}
        onOpenChange={setShowCustomerService}
        userName={tempProfile.name}
        userEmail={tempProfile.email}
      />
    </>
  );
};

export default ProfileSettings;

