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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { X, Upload, FileImage, CheckCircle2, Clock, ChevronDown } from "lucide-react";
import { storage, STORAGE_KEYS } from "@/lib/storage";

export interface Inquiry {
  id: string;
  title: string;
  errorType: string;
  content: string;
  images: string[]; // base64 encoded images
  status: "received" | "answered";
  createdAt: string;
  response?: string;
  respondedAt?: string;
}

interface CustomerServiceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  userEmail: string;
}

const CustomerService = ({ open, onOpenChange, userName, userEmail }: CustomerServiceProps) => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [title, setTitle] = useState("");
  const [errorType, setErrorType] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [expandedInquiryId, setExpandedInquiryId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadInquiries();
    }
  }, [open]);

  const loadInquiries = () => {
    const savedInquiries = storage.getJSON<any[]>(STORAGE_KEYS.inquiries, []);
    // 기존 데이터 마이그레이션: 3단계 → 2단계
    const migratedInquiries: Inquiry[] = (savedInquiries || []).map((inquiry: any) => {
      // 기존 상태를 새 상태로 변환
      if (inquiry.status === "pending" || inquiry.status === "in_progress") {
        return { ...inquiry, status: "received" as const };
      } else if (inquiry.status === "resolved") {
        return { ...inquiry, status: "answered" as const };
      }
      // 이미 새 형식이면 그대로 반환
      return inquiry as Inquiry;
    });
    setInquiries(migratedInquiries);
    // 마이그레이션이 필요한 경우 저장
    if (savedInquiries && savedInquiries.some((inq: any) => inq.status === "pending" || inq.status === "in_progress" || inq.status === "resolved")) {
      storage.setJSON(STORAGE_KEYS.inquiries, migratedInquiries);
    }
  };

  const saveInquiries = (newInquiries: Inquiry[]) => {
    setInquiries(newInquiries);
    storage.setJSON(STORAGE_KEYS.inquiries, newInquiries);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // 최대 5장 제한
    if (images.length + files.length > 5) {
      alert("이미지는 최대 5장까지 업로드 가능합니다.");
      return;
    }

    const validFiles: File[] = [];
    const previewPromises: Promise<string>[] = [];

    files.forEach((file) => {
      // 파일 타입 검증 (jpg, png, bmp)
      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/bmp"];
      if (!validTypes.includes(file.type)) {
        alert(`${file.name}은(는) 지원하지 않는 형식입니다. (JPG, PNG, BMP만 가능)`);
        return;
      }

      // 파일 크기 검증 (5MB 제한)
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name}의 크기가 5MB를 초과합니다.`);
        return;
      }

      validFiles.push(file);
      
      // 미리보기 생성 Promise
      const previewPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
      previewPromises.push(previewPromise);
    });

    // 모든 미리보기가 완료되면 상태 업데이트
    Promise.all(previewPromises).then((previews) => {
      setImages([...images, ...validFiles]);
      setImagePreviews([...imagePreviews, ...previews]);
    });

    // input 초기화
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImages(newImages);
    setImagePreviews(newPreviews);
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      alert("문의 제목을 입력해주세요.");
      return;
    }
    if (!errorType) {
      alert("오류 유형을 선택해주세요.");
      return;
    }
    if (!content.trim()) {
      alert("문의 내용을 입력해주세요.");
      return;
    }

    // 이미지를 base64로 변환
    const imagePromises = images.map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(imagePromises).then((base64Images) => {
      const newInquiry: Inquiry = {
        id: `inquiry-${Date.now()}`,
        title,
        errorType,
        content,
        images: base64Images,
        status: "received",
        createdAt: new Date().toISOString(),
      };

      const updatedInquiries = [newInquiry, ...inquiries];
      saveInquiries(updatedInquiries);

      // 폼 초기화
      setTitle("");
      setErrorType("");
      setContent("");
      setImages([]);
      setImagePreviews([]);

      alert("문의가 등록되었습니다.");
    });
  };

  const getStatusBadge = (status: Inquiry["status"]) => {
    switch (status) {
      case "received":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Clock className="h-3 w-3 mr-1" />
            접수완료
          </Badge>
        );
      case "answered":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            답변완료
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStatusLabel = (status: Inquiry["status"]) => {
    switch (status) {
      case "received":
        return "문의가 접수되었습니다. 빠른 시일 내에 답변드리겠습니다.";
      case "answered":
        return "문의에 대한 답변이 완료되었습니다.";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col [&>button]:h-10 [&>button]:w-10 [&>button_svg]:h-6 [&>button_svg]:w-6">
        <DialogHeader>
          <DialogTitle>고객센터</DialogTitle>
          <DialogDescription>
            문의사항을 등록하거나 처리 내역을 확인할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="inquiry" className="w-full flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="inquiry">문의하기</TabsTrigger>
            <TabsTrigger value="history">처리내역</TabsTrigger>
          </TabsList>

          {/* 문의하기 탭 */}
          <TabsContent value="inquiry" className="space-y-4 flex-1 overflow-y-auto mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">문의 등록</CardTitle>
                <CardDescription>
                  문의사항을 작성해주세요. 빠른 시일 내에 답변드리겠습니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>이름</Label>
                    <Input value={userName} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>이메일</Label>
                    <Input value={userEmail} disabled className="bg-muted" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">문의 제목 *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="문의 제목을 입력해주세요"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="error-type">오류 유형 *</Label>
                  <Select value={errorType} onValueChange={setErrorType}>
                    <SelectTrigger id="error-type">
                      <SelectValue placeholder="오류 유형을 선택해주세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bug">버그/오류</SelectItem>
                      <SelectItem value="feature">기능 개선 요청</SelectItem>
                      <SelectItem value="usage">사용법 문의</SelectItem>
                      <SelectItem value="account">계정 관련</SelectItem>
                      <SelectItem value="other">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">문의 내용 *</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="문의 내용을 상세히 작성해주세요"
                    rows={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="images">이미지 첨부 (최대 5장)</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="image-upload" className="cursor-pointer">
                      <Button variant="outline" asChild>
                        <span>
                          <Upload className="h-4 w-4 mr-2" />
                          이미지 선택
                        </span>
                      </Button>
                    </Label>
                    <Input
                      id="image-upload"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/bmp"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG, BMP 형식 지원 (각 파일 최대 5MB)
                    </p>
                  </div>

                  {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={preview}
                            alt={`미리보기 ${index + 1}`}
                            className="w-full h-24 object-cover rounded border"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeImage(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button onClick={handleSubmit} className="w-full">
                  문의 등록
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 처리내역 탭 */}
          <TabsContent value="history" className="space-y-4 flex-1 overflow-y-auto mt-4">
            {inquiries.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  등록된 문의가 없습니다.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {inquiries.map((inquiry) => {
                  const isExpanded = expandedInquiryId === inquiry.id;
                  return (
                    <Card
                      key={inquiry.id}
                      className="cursor-pointer hover:shadow-md transition-all"
                      onClick={() => {
                        // 같은 카드를 클릭하면 닫기, 다른 카드를 클릭하면 해당 카드 열기
                        setExpandedInquiryId(isExpanded ? null : inquiry.id);
                      }}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base">{inquiry.title}</CardTitle>
                            <CardDescription className="mt-1">
                              {new Date(inquiry.createdAt).toLocaleString("ko-KR")}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(inquiry.status)}
                            <ChevronDown
                              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </div>
                      </CardHeader>
                      {!isExpanded && (
                        <CardContent>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {inquiry.content}
                          </p>
                          {inquiry.images.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              <FileImage className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                이미지 {inquiry.images.length}장
                              </span>
                            </div>
                          )}
                        </CardContent>
                      )}
                      {isExpanded && (
                        <CardContent className="space-y-4 pt-0">
                          <Separator />
                          <div>
                            <Label className="text-sm font-semibold">오류 유형</Label>
                            <p className="mt-1 text-sm">
                              {inquiry.errorType === "bug"
                                ? "버그/오류"
                                : inquiry.errorType === "feature"
                                ? "기능 개선 요청"
                                : inquiry.errorType === "usage"
                                ? "사용법 문의"
                                : inquiry.errorType === "account"
                                ? "계정 관련"
                                : "기타"}
                            </p>
                          </div>

                          <Separator />

                          <div>
                            <Label className="text-sm font-semibold">문의 내용</Label>
                            <p className="mt-1 text-sm whitespace-pre-wrap">{inquiry.content}</p>
                          </div>

                          {inquiry.images.length > 0 && (
                            <>
                              <Separator />
                              <div>
                                <Label className="text-sm font-semibold">첨부 이미지</Label>
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                  {inquiry.images.map((image, index) => (
                                    <img
                                      key={index}
                                      src={image}
                                      alt={`첨부 이미지 ${index + 1}`}
                                      className="w-full h-32 object-cover rounded border"
                                    />
                                  ))}
                                </div>
                              </div>
                            </>
                          )}

                          <Separator />

                          <div>
                            <Label className="text-sm font-semibold">처리 현황</Label>
                            <div className="mt-2 p-3 bg-muted rounded-md">
                              <p className="text-sm">{getStatusLabel(inquiry.status)}</p>
                            </div>
                          </div>

                          {inquiry.response && (
                            <>
                              <Separator />
                              <div>
                                <Label className="text-sm font-semibold">처리 답변</Label>
                                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                                  <p className="text-sm whitespace-pre-wrap">{inquiry.response}</p>
                                  {inquiry.respondedAt && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                      {new Date(inquiry.respondedAt).toLocaleString("ko-KR")}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerService;

