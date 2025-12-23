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
import { Camera, Trash2, HeadphonesIcon } from "lucide-react";
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
  const [profile, setProfile] = useState<UserProfile>({
    name: "사용자",
    email: "user@pk-friends.com",
    phone: "",
    organization: "PK 프렌즈 대학병원",
    role: "doctor",
  });
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showCustomerService, setShowCustomerService] = useState(false);

  useEffect(() => {
    if (open) {
      loadProfile();
    }
  }, [open]);

  const loadProfile = () => {
    const savedProfile = storage.getJSON<UserProfile>(STORAGE_KEYS.userProfile);
    if (savedProfile) {
      setProfile(savedProfile);
      if (savedProfile.profileImage) {
        setProfileImage(savedProfile.profileImage);
      }
    }
  };

  const saveProfile = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
    storage.setJSON(STORAGE_KEYS.userProfile, updatedProfile);
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
        setProfileImage(imageDataUrl);
        const updatedProfile = { ...profile, profileImage: imageDataUrl };
        saveProfile(updatedProfile);
      };
      reader.readAsDataURL(file);
    }
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
                        <AvatarImage src={profileImage || profile.profileImage} alt={profile.name} />
                        <AvatarFallback className="text-3xl">
                          {profile.name.charAt(0)}
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
                        <Input value={profile.name} disabled className="bg-muted" />
                      </div>
                      <div className="space-y-2">
                        <Label>이메일</Label>
                        <Input value={profile.email} disabled className="bg-muted" />
                      </div>
                      <div className="space-y-2">
                        <Label>전화번호</Label>
                        <Input value={profile.phone || "-"} disabled className="bg-muted" />
                      </div>
                      <div className="space-y-2">
                        <Label>소속기관</Label>
                        <Input value={profile.organization} disabled className="bg-muted" />
                      </div>
                      <div className="space-y-2">
                        <Label>직무</Label>
                        <Input
                          value={getRoleLabel(profile.role)}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* 고객센터 버튼 */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setShowCustomerService(true)}
                className="w-full"
              >
                <HeadphonesIcon className="h-4 w-4 mr-2" />
                고객센터
              </Button>
            </div>

            <Separator />

            {/* 계정 삭제 버튼 */}
            <div className="flex justify-center">
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                계정 삭제
              </Button>
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
                TDM friends에서는 안정적인 서비스 운영을 위해 계정 삭제를 지원하지 않습니다. 삭제를 원하시는 경우 번거로우시더라도 반드시 시스템 관리자에게
                문의해주세요.
              </p>
              <p className="font-semibold text-destructive">
                ⚠️ 주의: 계정 삭제 시 등록된 모든 환자 정보와 TDM 분석 데이터는 소속 기관 내 다른 관리자에게 위임되어야 합니다.
              </p>
              <div className="pt-2 border-t">
                <p className="font-medium">시스템 관리자 연락처</p>
                <p className="text-sm text-muted-foreground">
                  이메일: admin@pk-friends.com
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
        userName={profile.name}
        userEmail={profile.email}
      />
    </>
  );
};

export default ProfileSettings;

