# Backend Modeling & API Spec (Draft)

> 프론트에서 기존에 localStorage에 저장하던 구조를 기준으로, Django + DRF 구현을 위한 **DB 모델 초안**과 **API 목록**을 정리한 문서입니다.
> 
> 핵심 권장사항: 프론트는 `patientId + drugName`으로 renal/conditions/tdmResult 등을 저장해 충돌 가능성이 있으므로, 백엔드에서는 **TDM 케이스(`TdmCase`) 단위**로 스코프를 잡는 것을 권장합니다.

---

## 1. 도메인/관계 요약

현재 프론트가 다루는 데이터는 크게 아래로 묶입니다.

- **환자(Patient)**: 환자 기본정보
- **TDM 케이스(프론트의 Prescription 역할)**: 환자 + 약물 + 적응증/목표치/추가정보 등
- **신기능(RenalInfo)**: 환자+약물 단위로 입력/선택
- **혈중농도(BloodTest)**: 환자+약물 단위로 입력
- **처방 내역 summary(conditions)**: 반복 투약 구간(시작시간/간격/횟수/경로/주입시간 등)
- **개별 투약 기록(DrugAdministration)**: 실제 dose 이벤트(시간/용량/경로/주입시간 등)
- **TDM 실행 결과(TDM result / history)**: 시뮬레이션 결과 + 히스토리(최대 5개)
- **TDM 시계열(series)**: ipred/pred/observed
- **(임시) 로그인/회원가입**: 로컬에 registeredUsers, isAuthenticated

---

## 2. DB 모델링 초안 (Django ORM 설계용)

아래는 “현재 프론트 타입/필드”를 최대한 반영한 모델 제안입니다.

### 2.1 사용자/인증 (현재 프론트 흐름 기준 최소)

#### Organization (선택)
- id: UUID/BigAutoField
- name: string (unique)
- created_at

#### User (phone 기반 커스텀 유저 권장)
- id
- phone_number: string (unique, `010########`)
- name: string
- organization: FK -> Organization (nullable)
- medical_role: choice (`doctor`, `nurse`, `other`)  
- is_active / is_staff
- created_at / updated_at / last_login

#### PhoneVerification (선택: 실제 인증 구현 시)
- id
- phone_number
- code_hash (원문 저장 금지)
- sent_at / expires_at / verified_at
- attempt_count
- status: choice (`sent`, `verified`, `expired`, `locked`)

#### TermsAgreement (선택: 약관 동의 기록 필요 시)
- id
- user: FK -> User
- terms_version / privacy_version
- agreed_at
- ip_address / user_agent (선택)

---

### 2.2 환자/케이스

#### Patient
프론트 `Patient` 기반
- id: UUID 권장
- owner: FK -> User (멀티유저 대비)
- name: string
- birth_date: date
- age_years: int (선택: 파생 가능하지만 프론트 입력값 유지 목적)
- sex: choice (`male`, `female`, `unknown`)
- weight_kg: Decimal
- height_cm: Decimal
- medical_history: Text
- allergies: Text
- created_at / updated_at

권장 인덱스
- (owner, created_at)

#### TdmCase  (프론트의 Prescription 역할: “TDM 진행 단위”)
프론트 `Prescription` 기반
- id: UUID/BigAutoField
- patient: FK -> Patient
- drug_name: string (예: Vancomycin, Cyclosporin)
- indication: string
- additional_info: string
- tdm_target_type: string (예: AUC, Trough Concentration)
- tdm_target_value_text: string (예: 400-600 mg·h/L)
- started_at: datetime
- ended_at: datetime (nullable)

(프론트에 있으나 현재 빈값이 많은 필드 → nullable로 시작)
- dosage: Decimal (nullable)
- unit: string (nullable)
- frequency: string (nullable)
- route_text: string (nullable)
- prescribed_by: string (nullable)

운영 필드
- status: choice (`draft`, `active`, `archived`)
- created_at / updated_at

권장 제약/인덱스
- (patient, drug_name, status)
- 정책이 필요하면 “동일 patient+drug에 active 1개만”을 UniqueConstraint로 강제 가능

---

### 2.3 신기능

#### RenalFunctionRecord
프론트 `RenalInfo` 기반
- id
- tdm_case: FK -> TdmCase
- measured_date: date
- scr_mg_dl: Decimal
- formula: choice (`cockcroft_gault`, `mdrd`, `ckd_epi`)
- result_text: string (프론트의 `CRCL = ...`, `eGFR = ...` 텍스트)
- crcl_ml_min: Decimal (nullable)  # 파싱/계산 값 캐싱
- egfr_ml_min: Decimal (nullable)
- dialysis: choice (`Y`, `N`)
- renal_replacement: string (예: CRRT)
- race_is_black: bool
- is_selected: bool
- created_at / updated_at

권장 규칙
- 같은 `tdm_case` 내에서 `is_selected=True`는 1개만 유지(저장 시 트랜잭션)

---

### 2.4 Lab(혈중 농도)

#### BloodSample
프론트 `BloodTest` 기반
- id
- tdm_case: FK -> TdmCase
- collected_at: datetime
- concentration_value: Decimal
- concentration_unit: string (`mg/L`, `ng/mL` 등)
- measurement_type: choice (`trough`, `peak`, `other`)

(선택) 신기능 연결/스냅샷
- renal_record: FK -> RenalFunctionRecord (nullable)
- renal_snapshot_text: string (nullable)

- created_at / updated_at

권장 인덱스
- (tdm_case, collected_at)

---

### 2.5 처방내역 summary(conditions) + 개별 투약 기록

프론트에서 확인된 conditions 필드:
- `route`, `dosage`, `unit`, `intervalHours`, `injectionTime`, `dosageForm`, `firstDoseDate`, `firstDoseTime`, `totalDoses`
- 각 condition은 내부적으로 `id: Date.now()` 같은 숫자 ID로 생성됨
- 테이블 row는 `conditionId`로 condition과 연결됨

#### DosingRegimenSegment (conditions)
- id
- tdm_case: FK -> TdmCase
- route: choice (`iv`, `oral`)  # 프론트(정맥/경구)를 서버에서 정규화
- dose_amount: Decimal
- dose_unit: string (`mg`, `g`, `mcg`)
- interval_hours: Decimal
- total_doses: int
- first_dose_at: datetime
- infusion_time_min: int (nullable)  # 정맥일 때 필수(볼루스 0)
- dosage_form: string/choice (nullable)  # 경구일 때 `capsule/tablet`, `oral liquid` 등
- created_at / updated_at

#### DoseAdministration (개별 투약 이벤트)
프론트 `DrugAdministration` + table row 기반
- id
- tdm_case: FK -> TdmCase
- segment: FK -> DosingRegimenSegment (nullable)
- administered_at: datetime
- route: choice (`iv`, `oral`)
- dose_amount: Decimal
- dose_unit: string
- is_iv_infusion: bool
- infusion_time_min: int (nullable)
- interval_hours: Decimal (nullable)  # 프론트 row에 포함
- dosage_form: string (nullable)
- source: choice (`generated`, `manual`, `imported`) (선택)
- created_at / updated_at

권장 인덱스
- (tdm_case, administered_at)

---

### 2.6 TDM 실행/결과/시계열

#### TdmRun
- id
- tdm_case: FK -> TdmCase
- model_name: string (nullable)
- request_payload: JSONField  # buildTdmRequestBody 결과 저장 가능
- result_payload: JSONField   # 외부 API 응답 raw

(조회 최적화를 위한 요약 컬럼화 권장)
- auc_tau_before / auc_24_before / cmax_before / ctrough_before
- auc_tau_after / auc_24_after / cmax_after / ctrough_after
- steady_state: bool/string (nullable)

- created_at

#### TdmRunSeries (선택)
- id
- tdm_run: OneToOne/FK
- ipred_series: JSONField (array of {time, value})
- pred_series: JSONField
- observed_series: JSONField

#### TdmCaseLatestPrescriptionSnapshot (선택: 프론트 savePrescriptionInfo 대응)
프론트 저장값: {amount, tau, cmt, route, infusionTime?, timestamp}
- tdm_case: OneToOne
- amount: Decimal
- tau_hours: Decimal
- cmt: int (1=IV, 2=oral)
- route_text: string
- infusion_time_min: int (nullable)
- captured_at: datetime

---

## 3. API 목록 (DRF 설계 초안)

베이스 URL 예시: `/api/v1/`

### 3.1 인증/회원

- POST `/auth/phone/send-code/`
  - req: `{ "phone_number": "01012345678" }`
  - res: `204` 또는 `{ "expires_in": 180 }`

- POST `/auth/phone/verify-code/`
  - req: `{ "phone_number": "01012345678", "code": "123456" }`
  - res: `{ "verification_token": "..." }` (또는 바로 JWT 발급)

- POST `/auth/register/`
  - req: `{ "verification_token": "...", "name": "...", "organization": "...", "medical_role": "doctor" }`
  - res: `{ "user": {...}, "access": "...", "refresh": "..." }`

- POST `/auth/login/`
  - req: `{ "verification_token": "..." }`
  - res: `{ "user": {...}, "access": "...", "refresh": "..." }`

- GET `/me/`

(선택) 약관 동의
- POST `/terms/agree/`

---

### 3.2 환자

- GET `/patients/`
- POST `/patients/`
- GET `/patients/{patient_id}/`
- PATCH `/patients/{patient_id}/`
- DELETE `/patients/{patient_id}/`

---

### 3.3 TDM 케이스

- GET `/patients/{patient_id}/tdm-cases/`
- POST `/patients/{patient_id}/tdm-cases/`
  - req 핵심: `{ "drug_name": "Vancomycin", "indication": "...", "additional_info": "...", "tdm_target_type": "AUC", "tdm_target_value_text": "400-600 mg·h/L" }`

- GET `/tdm-cases/{case_id}/`
- PATCH `/tdm-cases/{case_id}/`
- DELETE `/tdm-cases/{case_id}/`

(선택) 활성 상태
- POST `/tdm-cases/{case_id}/set-active/`
  - req: `{ "active": true }`

---

### 3.4 신기능

- GET `/tdm-cases/{case_id}/renal-records/`
- POST `/tdm-cases/{case_id}/renal-records/`
- PATCH `/renal-records/{renal_id}/`
- DELETE `/renal-records/{renal_id}/`
- (선택) POST `/renal-records/{renal_id}/select/`

---

### 3.5 Lab(혈중 농도)

- GET `/tdm-cases/{case_id}/blood-samples/`
- POST `/tdm-cases/{case_id}/blood-samples/`
  - req: `{ "collected_at": "...", "concentration_value": 12.3, "concentration_unit": "mg/L", "measurement_type": "trough", "renal_record_id": "..." }`
- DELETE `/blood-samples/{sample_id}/`

---

### 3.6 처방내역 summary(segments)

- GET `/tdm-cases/{case_id}/regimen-segments/`
- POST `/tdm-cases/{case_id}/regimen-segments/`
- PATCH `/regimen-segments/{segment_id}/`
- DELETE `/regimen-segments/{segment_id}/`

(권장) segments 기반 투약기록 재생성
- POST `/tdm-cases/{case_id}/regimen-segments/generate-administrations/`

---

### 3.7 개별 투약 기록

- GET `/tdm-cases/{case_id}/dose-administrations/`

(권장) bulk 저장(프론트 테이블 UX에 적합)
- PUT `/tdm-cases/{case_id}/dose-administrations/bulk/`
  - req: `[{ administered_at, route, dose_amount, dose_unit, infusion_time_min, interval_hours, segment_id?, dosage_form? }, ...]`

(선택) 단건
- POST `/tdm-cases/{case_id}/dose-administrations/`
- PATCH `/dose-administrations/{dose_id}/`
- DELETE `/dose-administrations/{dose_id}/`

---

### 3.8 TDM 시뮬레이션 실행/결과

- POST `/tdm-cases/{case_id}/simulate/`
  - 서버에서 케이스/환자/renal(선택)/blood/dose를 모아 request body 구성
  - 외부 모델 API 호출 후 `TdmRun` 저장
  - res: `{ "run_id": "...", "result": {...}, "series": {...} }`

- GET `/tdm-cases/{case_id}/runs/`
- GET `/tdm-runs/{run_id}/`
- GET `/tdm-cases/{case_id}/runs/latest/`

---

### 3.9 리포트(프론트 report 페이지 대응)

- GET `/tdm-cases/{case_id}/report/`
  - res 권장 묶음:
    - patient
    - tdm_case
    - renal_selected (또는 목록)
    - blood_samples
    - dose_administrations
    - latest_run + series
    - latest_prescription_snapshot

---

## 4. CSV 기반 “TDM 모델 카탈로그” (동적 폼/모델코드/용량옵션 제공)

프론트에서 약물/적응증/추가정보/제형/필수 공변량/용량 조정 옵션을 **하드코딩하지 않고**, CSV(혹은 DB)의 카탈로그 데이터를 조회해 동적으로 UI를 구성할 수 있도록 별도의 “설정 데이터 모델”을 둡니다.

### 4.1 모델링 의도

- **TDM 약물 선택 UI 구성**: 약물 목록, 적응증 목록, 추가정보 질문(label/description) 및 선택 옵션 제공
- **기본 TDM 목표/목표치 제공**: AUC/Ctrough/Peak 등의 default 및 표시용 텍스트
- **제형/투여경로/용량단위/용량조정단위 제공**: IV/PO + capsule/tablet 등 표시 및 입력 제약
- **필수 공변량( CRCL/WT/AGE/SEX/TOXI ) 표시/검증**: 특정 모델에서만 요구되는 입력을 프론트가 자동으로 강제
- **모델 code 결정(Resolve)**: 케이스 입력값을 기반으로 어떤 model_code를 사용할지 서버가 결정(또는 후보 목록 제공)

### 4.2 DB 모델링 초안 (Catalog)

정규화를 과도하게 하면 관리/이관이 복잡해지므로, 초기에 구현 난이도와 운영 편의성을 위해 **핵심 키는 정규화**, 나머지는 **JSONField**를 적극 활용하는 구성을 권장합니다.

#### DrugCatalog
- id
- name: string (unique)  # 예: Vancomycin, Cyclosporin
- is_active: bool
- created_at / updated_at

#### TdmModelCatalogItem  (CSV의 “한 줄” = 하나의 모델 항목)
CSV 컬럼을 대부분 1:1로 담는 “원장(원본에 가까운) 테이블” 역할입니다.

- id
- drug: FK -> DrugCatalog
- model_code: string (unique)  # 예: Vancomycin1-1
- modeling_condition_text: string  # 예: Not specified/Korean&CRRT
- indication_text: string  # 예: Not specified/Korean

추가정보(없을 수도 있음)
- extra_info_label: string (nullable)  # 예: 투석여부(신 대체요법)
- extra_info_description: Text (nullable)
- extra_info_options: JSONField (nullable)  # 예: [\"투석 안 함\", \"CRRT\"] 또는 [\"네\",\"아니오\"]

TDM 목표/단위/제형/용량
- target_specs: JSONField  # 표시/기본값 포함. 예: [{type, value_text, is_default}, ...]
- concentration_unit: string  # 예: mg/L, ng/mL
- dosage_forms: JSONField  # 예: [\"IV\", \"PO-capsule/tablet\", \"PO-oral liquid\"]
- dose_unit: string  # 예: mg
- dose_adjustment_unit_map: JSONField  # 예: {\"IV\": 10, \"PO-capsule\": 25, \"PO-oral liquid\": 10}

필수 공변량 플래그
- requires_crcl: bool
- requires_wt: bool
- requires_age: bool
- requires_sex: bool
- requires_toxi: bool

투약 용량 조정 옵션(프론트에서 버튼/셀렉트로 제공할 값)
- dose_adjustment_options: JSONField  # 예: [125,250,375,...]

레퍼런스
- reference_text: Text (nullable)

운영/버전 관리
- is_active: bool
- source_version: string (nullable)  # CSV 버전/업데이트 태그(예: 2025-12-18)
- created_at / updated_at

권장 제약/인덱스
- (drug, indication_text)
- (drug, model_code)

> 참고: `target_specs`, `dose_adjustment_unit_map`, `dosage_forms`, `dose_adjustment_options`는 CSV의 `|` 구분 데이터를 파싱해 넣는 것을 전제로 합니다.

### 4.3 API (Catalog 제공 + 모델코드 Resolve)

베이스 URL 예시: `/api/v1/`

#### 4.3.1 카탈로그 조회 (프론트 폼 동적 구성용)

- GET `/catalog/drugs/`
  - 설명: 활성화된 약물 목록
  - res 예: `[{ \"name\": \"Vancomycin\" }, { \"name\": \"Cyclosporin\" }]`

- GET `/catalog/models/`
  - 설명: 모델 항목 목록(필터 가능)
  - query:
    - `drug_name=Vancomycin`
    - `indication=Not specified/Korean`
    - `is_active=true`
  - res: `TdmModelCatalogItem` 리스트

- GET `/catalog/models/{model_code}/`
  - 설명: 특정 model_code 상세(추가정보/목표/용량옵션/필수공변량 포함)

- GET `/catalog/drugs/{drug_name}/form-schema/`
  - 설명: 프론트가 “TDM 선택 화면”을 그리기 위한 최소 스키마(약물→적응증→추가정보 질문/옵션/기본목표)를 서버에서 조합해 제공
  - res 예(권장):
    - `drug_name`
    - `indications: [{ indication, extra_info_label, extra_info_description, extra_info_options, default_targets, concentration_unit, dosage_forms, dose_unit, dose_adjustment_unit_map, required_covariates, dose_adjustment_options }]`

#### 4.3.2 모델코드 결정(Resolve)

프론트는 현재 하드코딩 테이블로 `model_name`을 추론하고 있는데, 이를 CSV 기반으로 서버가 결정하도록 합니다.

- POST `/catalog/model-code/resolve/`
  - 설명: 입력(약물/적응증/추가정보/환자상태)을 기반으로 사용할 `model_code`를 결정
  - req 예:
    - `{ \"drug_name\": \"Vancomycin\", \"indication\": \"Not specified/Korean\", \"extra_info\": \"CRRT\", \"last_dose_at\": \"2025-12-18T08:00:00Z\", \"renal_replacement\": \"CRRT\" }`
  - res 예:
    - `{ \"model_code\": \"Vancomycin1-2\" }`

> 구현 메모(권장): resolve 로직은 (1) `drug_name + indication` 후보를 좁히고, (2) `extra_info`/CRRT 여부/within72h 등 조건을 적용해 단일 model_code를 선택합니다. 조건 필드가 더 늘어날 가능성이 크므로, `modeling_condition_text`를 단순 문자열로만 두기보다 추후 `condition_rules`(JSONField)로 확장할 수 있게 설계하는 것을 권장합니다.

> 카탈로그 데이터 적재/수정은 별도 API 없이도 `django-import-export`(또는 Django Admin)로 충분히 운영 가능합니다.

