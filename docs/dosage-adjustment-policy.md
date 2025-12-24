# 용량 조정 옵션 제공 정책 변경사항

## 개요

TDM 시뮬레이션에서 "용량 조정하기" 및 "용량&시간 조정하기" 옵션 선택 시, 환자의 현재 TDM 결과 상태에 따라 적절한 용량 옵션을 제공하는 정책이 구현되었습니다.

## 주요 변경사항

### 1. API 호출 시점 변경

**이전:**
- 카드 생성 시점에 옵션 버튼이 즉시 표시됨
- 사용자가 옵션 버튼을 클릭할 때 API 호출

**변경 후:**
- 카드 생성 시점에 즉시 API 호출 시작
- 현재 TDM 결과를 분석하여 시나리오별로 적절한 용량 옵션 생성
- API 호출 완료 후 옵션 버튼 표시
- **이미 호출된 TDM 결과가 있으면 즉시 차트 렌더링** (추가 API 호출 없음)

### 2. 시나리오별 옵션 제공 정책

현재 TDM 결과의 목표치 도달 여부와 항정상태에 따라 4가지 시나리오로 분기합니다.

#### 시나리오 1: 목표치 미도달

**조건:**
- 현재 TDM 결과의 목표치가 목표 범위 미만

**동작:**
1. 현재 용량부터 시작하여 용법 조정 단위(step)씩 증가하며 API 호출
2. 목표치에 도달하는 첫 번째 용량을 찾을 때까지 반복 (최대 20단계)
3. 첫 도달 용량을 기준으로 상향 조정 옵션 12개에 대해 **API 호출하여 목표 도달 여부 검증**
   - 목표치 도달 시: 옵션으로 제공
   - 목표치 초과 시: 해당 옵션부터 상향 옵션의 API 호출 중단 및 옵션 제공 안 함
4. **현용법 용량을 첫 번째 옵션으로 추가** (중복 제거)
   - 예: 현재 용량이 345mg, 첫 도달 용량이 500mg이고 step이 10mg인 경우
   - 후보 옵션: 500mg, 510mg, 520mg, ..., 610mg (12개)
   - 각 옵션에 대해 API 호출하여 목표치 도달 여부 검증
   - 500mg 도달, 510mg 도달, 520mg 도달, 530mg 초과 확인 시 → 530mg 이후 옵션 검증 중단
   - 최종 옵션: 345mg (현용법), 500mg, 510mg, 520mg (총 4개)

**API 호출:**
- 목표치 도달 검색: 최대 20단계까지 시도
  - **제한 이유**: 
    - 무한 루프 방지 및 성능 최적화
    - 과도한 API 호출로 인한 서버 부하 방지
    - 사용자 대기 시간 최소화
    - 실용성 고려: 20단계를 넘어서도 목표치에 도달하지 못한다면, 그 정도로 큰 용량 차이는 비현실적일 가능성이 높음
    - 예: step이 10mg인 경우 최대 200mg 증가/감소 (현재 용량 ±200mg 범위 내에서 검색)
- 옵션 검증: 첫 도달 용량 기준 상향 12개 옵션에 대해 개별 API 호출하여 목표치 도달 여부 검증
  - **성능 최적화**: 상향 검증 중 목표치 초과 확인 시 해당 옵션부터 상향 검증 중단
  - **검증된 옵션 결과는 캐시에 저장** (`dosageSuggestionResults[cardId][amount]`)

**정렬 방식:**
- 현용법(1순위, 하이라이트) + API 검증된 추천 옵션 오름차순 정렬
- 목표치 초과 옵션은 제외되므로 실제 제공되는 옵션 수는 12개보다 적을 수 있음

#### 시나리오 2: 목표치 초과

**조건:**
- 현재 TDM 결과의 목표치가 목표 범위 초과

**동작:**
1. 현재 용량부터 시작하여 용법 조정 단위(step)씩 감소하며 API 호출
2. 목표치에 도달하는 첫 번째 용량을 찾을 때까지 반복 (최대 20단계)
3. 첫 도달 용량을 기준으로 하향 조정 옵션 12개에 대해 **API 호출하여 목표 도달 여부 검증**
   - 목표치 도달 시: 옵션으로 제공
   - 목표치 미도달 시: 해당 옵션부터 하향 옵션의 API 호출 중단 및 옵션 제공 안 함
4. **현용법 용량을 첫 번째 옵션으로 추가** (중복 제거)
   - 예: 현재 용량이 800mg, 첫 도달 용량이 400mg이고 step이 10mg인 경우
   - 후보 옵션: 400mg, 390mg, 380mg, ..., 290mg (12개)
   - 각 옵션에 대해 API 호출하여 목표치 도달 여부 검증
   - 400mg 도달, 390mg 도달, 380mg 도달, 370mg 미도달 확인 시 → 370mg 이후 옵션 검증 중단
   - 최종 옵션: 400mg, 390mg, 380mg, 800mg (현용법) (총 4개)

**API 호출:**
- 목표치 도달 검색: 최대 20단계까지 시도
  - **제한 이유**: 시나리오 1과 동일
- 옵션 검증: 첫 도달 용량 기준 하향 12개 옵션에 대해 개별 API 호출하여 목표치 도달 여부 검증
  - **성능 최적화**: 하향 검증 중 목표치 미도달 확인 시 해당 옵션부터 하향 검증 중단
  - **검증된 옵션 결과는 캐시에 저장** (`dosageSuggestionResults[cardId][amount]`)

**정렬 방식:**
- 현용법(1순위, 하이라이트) + API 검증된 추천 옵션 내림차순 정렬
- 목표치 미도달 옵션은 제외되므로 실제 제공되는 옵션 수는 12개보다 적을 수 있음

#### 시나리오 3: 목표치 도달, 항정상태 미도달

**조건:**
- 현재 TDM 결과의 목표치는 도달했으나 항정상태는 미도달

**동작:**
1. 현재 용량을 중심으로 하향 6개, 상향 6개 옵션 생성 (총 12개)
2. **모든 옵션을 개별적으로 API 호출하여 목표치 도달 여부 검증**
3. **목표치 도달하지 않는 옵션은 제외**
4. **현용법 용량은 항상 포함** (이미 목표치 도달 확인됨)
5. 오름차순 정렬하여 표시
   - 예: 현재 용량이 500mg이고 step이 10mg인 경우
   - 후보: 440mg, 450mg, 460mg, 470mg, 480mg, 490mg, 500mg (현용법), 510mg, 520mg, 530mg, 540mg, 550mg
   - API 검증 후 목표치 도달한 옵션만 표시

**API 호출:**
- **모든 후보 옵션(하향 6개 + 현용법 + 상향 6개)에 대해 개별 API 호출**
- **성능 최적화: 상향/하향 검증 중 목표치를 벗어나면 해당 방향 검증 중단**
  - 하향 검증 중 목표치 미도달 확인 시: 하향 검증 중단 (더 작은 용량은 더 미도달할 것)
  - 상향 검증 중 목표치 초과 확인 시: 상향 검증 중단 (더 큰 용량은 더 초과할 것)
- **검증된 옵션 결과는 캐시에 저장** (`dosageSuggestionResults[cardId][amount]`)
- 검증 순서:
  1. 하향 6개 검증 (큰 용량부터 작은 용량 순서: i=6 → 1)
  2. 현용법 추가 (이미 목표치 도달 확인됨)
  3. 상향 6개 검증 (작은 용량부터 큰 용량 순서: i=1 → 6)

**정렬 방식:**
- 하향 6개 + 현용법(하이라이트) + 상향 6개 오름차순 정렬

#### 시나리오 4: 목표치 및 항정상태 모두 도달

**조건:**
- 현재 TDM 결과의 목표치와 항정상태 모두 도달

**동작:**
- 시나리오 3과 동일 (현재 용량 중심으로 하향 6개, 상향 6개 옵션, 모두 API 검증)

**API 호출:**
- 시나리오 3과 동일

### 3. 용법 조정 단위(Step) 계산

투약 경로와 제형에 따라 용법 조정 단위가 결정됩니다.

**기본값:**
- 대부분의 약물: 10mg

**Cyclosporin 예외:**
- 경구 투약 + Capsule/Tablet 제형: 25mg
- 그 외: 10mg

**계산 로직:**
```typescript
let step = 10; // 기본값

if (drug === "cyclosporin" || drug === "cyclosporine") {
  // localStorage에서 제형 정보 확인
  const form = getDosageFormFromStorage(patient.id);
  if (form === "capsule/tablet") {
    step = 25;
  } else {
    step = 10;
  }
}
```

### 4. 옵션 버튼 표시 조건

**이전:**
- 카드 생성 즉시 옵션 버튼 표시

**변경 후:**
- `dosageLoading[cardId]`가 `false`이고
- `dosageSuggestions[cardId]`가 존재할 때만 표시
- 로딩 중에는 "제안을 계산 중..." 메시지 표시
- 모든 버튼의 높이를 70px로 고정하여 일관된 UI 제공

**현용법 표기:**
- 옵션 버튼에서 현용법 용량과 일치하는 경우 "현용법" 표기
- 버튼 하단 텍스트에 "현용법" 또는 "mg" 표시
- 툴팁에도 "(현용법)" 표기 추가

**버튼 표기 방식 통일:**
- "용량 조정하기" 카드와 "용량&시간 조정하기" 카드의 투약 용량 선택 옵션 버튼 표기 방식 통일
- 위쪽: 용량 + 단위정보 (예: "345 mg")
- 아래쪽: 현용법인 경우 "현용법", 아니면 빈 문자열
- 모든 버튼의 높이를 70px로 고정 (`h-[70px]`)

**자동 하이라이트:**
- 카드 생성 후 옵션 생성 완료 시 현용법 용량 버튼 자동 하이라이트
- `setSelectedDosage((prev) => ({ ...prev, [cardId]: currentDoseLabel }))` 호출
- "용량&시간 조정하기" 카드의 경우 현용법 간격도 자동 하이라이트
  - `setSelectedIntervalOption((prev) => ({ ...prev, [cardId]: matchedOption.label }))` 호출

### 5. 차트 표시 로직

**최초 차트 표시:**
- 카드 생성 시 `cardChartData[cardId]`를 `true`로 설정하여 현용법 차트 표시
- `loadCurrentMethodForCard` 함수에서 현용법 데이터 로드 및 차트 표시
- **이미 호출된 TDM 결과(`tdmResult`)가 있으면 즉시 사용하여 차트 렌더링** (추가 API 호출 없음)
- **최초에는 현용법 차트만 표시** (용법조정 결과 없음)
- `isEmptyChart` 조건: `currentMethodSeries`가 있으면 차트가 비어있지 않음으로 판단

**사용자 선택 시 차트 업데이트:**
- 사용자가 **현용법 용량을 선택한 경우**: 용법조정 결과를 추가하지 않고 현용법만 표시 (API 호출 없음)
- 사용자가 **추천 옵션을 선택한 경우**: 현용법 + 용법조정 결과를 함께 표시
- `handleDosageSelect` 함수에서 선택된 용량이 현용법 용량과 일치하는지 확인하여 분기 처리

### 6. 사용자 선택 시 API 호출

**정책:**
- 사용자가 옵션 버튼을 선택하거나 직접 입력 옵션을 입력할 때마다 해당 옵션에 대한 API를 **1회만** 호출
- 결과는 캐시에 저장되어 동일 옵션 재선택 시 API 호출 없이 캐시 사용
- **현용법 용량 선택 시**: API 호출 없이 현용법만 표시

**구현:**
- `handleDosageSelect` 함수에서 선택된 용량이 현용법 용량과 일치하는지 확인
- 현용법 용량과 일치하면 용법조정 결과를 제거하고 현용법만 표시
- **캐시 확인**: `dosageSuggestionResults[cardId][amountMg]` 확인
- 캐시가 있으면 API 호출 없이 즉시 반영
- 캐시가 없으면 `applyDoseScenarioForCard` 호출 후 결과 캐싱

**"용량&시간 조정하기" 카드의 경우:**
- `handleDosagePresetSelectV2` 또는 `handleDosageSelect`에서 용량 선택 시
- 시간이 선택되었으면 `applyDosageAndIntervalScenarioForCard` 호출
- 시간이 선택되지 않았으면 기본 시간(현용법 간격 또는 12시간)으로 `applyDosageAndIntervalScenarioForCard` 호출

### 7. 옵션 재사용 정책

**카드 간 옵션 공유:**
- "용량 조정하기" 카드와 "용량&시간 조정하기" 카드 간 옵션 재사용
- 한 카드에서 이미 적정 용량을 찾은 경우, 다른 카드 추가 시 API 재호출 없이 옵션 재사용
- **재사용 조건:**
  - `existingDosageAndIntervalCard` 또는 `existingDosageCard` 존재
  - 해당 카드의 `dosageSuggestions[cardId]`가 존재하고
  - 현용법을 제외한 옵션이 12개 이상 있는 경우
- **재사용 시 캐시도 함께 복사:**
  - `dosageSuggestionResults[sourceCardId]`를 `dosageSuggestionResults[targetCardId]`로 복사
  - 이렇게 하면 사용자가 옵션 선택 시 API 호출 없이 즉시 차트 표시 가능

**재사용 로직 위치:**
- `handleDosageAdjustmentV2`: `existingDosageAndIntervalCard` 확인
- `handleDosageAndIntervalAdjustment`: `existingDosageCard` 확인
- 두 함수 모두 시나리오 1, 2, 3, 4 모든 경우에 재사용 로직 적용

### 8. 에러 처리 개선

#### 503 에러 처리

**재시도 로직:**
- 각 API 호출마다 최대 7회 재시도 (용량 조정 시)
- 지수 백오프 적용: 1초 → 2초 → 4초 → 8초 → 10초 (최대)
- 503 에러 발생 시 자동 재시도

**연속 실패 처리:**
- 목표치 검색 중 연속 5회 실패 시 조기 중단
- 실패 시 2초 추가 대기 후 다음 시도 (서버 부하 완화)

**에러 상태 표시:**
- `dosageError[cardId]` 상태로 에러 표시
- 사용자에게 명확한 에러 메시지 제공

#### 네트워크 에러 처리

- "Failed to fetch" 에러 감지 및 처리
- CORS 에러 감지 및 처리
- 사용자에게 적절한 피드백 제공

## 코드 구조

### 주요 함수

#### `handleDosageAdjustmentV2()`
- "용량 조정하기" 버튼 클릭 시 호출
- 현재 TDM 결과 분석
- 시나리오별 옵션 생성
- 현용법 용량을 첫 번째 옵션으로 추가
- 최초 차트는 현용법만 표시
- **옵션 생성 완료 후 현용법 용량 자동 하이라이트**
- **옵션 재사용 로직 포함** (`existingDosageAndIntervalCard` 확인)

**시나리오 3, 4 구현 세부사항:**
```typescript
// 목표치 범위 파싱
const targetNums = (prescription.tdmTargetValue || "").match(/\d+\.?\d*/g) || [];
const targetMin = targetNums[0] ? parseFloat(targetNums[0]) : undefined;
const targetMax = targetNums[1] ? parseFloat(targetNums[1]) : undefined;

// 목표치 범위 상태 확인 헬퍼 함수
const getTargetRangeStatus = (resp: TdmApiResponse): '초과' | '미달' | '도달' | null => {
  if (!targetMin || !targetMax) return null;
  const targetValue = getTdmTargetValue(/* ... */);
  if (!targetValue.numericValue) return null;
  const currentValue = targetValue.numericValue;
  if (currentValue > targetMax) return '초과';
  if (currentValue < targetMin) return '미달';
  return '도달';
};

let downwardStopped = false; // 하향 호출 중단 플래그
let upwardStopped = false; // 상향 호출 중단 플래그

// 하향 6개 검증 (큰 용량부터 작은 용량 순서)
for (let i = 6; i >= 1; i--) {
  if (downwardStopped) break;
  const optionDose = currentDose - (step * i);
  if (optionDose < 1) continue;
  
  const result = await callApiForAmount(optionDose);
  
  // 결과를 캐시에 저장
  setDosageSuggestionResults((prev) => {
    const next = { ...(prev || {}) };
    if (!next[newCardNumber]) next[newCardNumber] = {};
    next[newCardNumber][optionDose] = {
      data: result.resp,
      dataset: result.dataset
    };
    return next;
  });
  
  const rangeStatus = getTargetRangeStatus(result.resp);
  
  if (result.isTargetReached) {
    dosageOptions.push(optionDose);
  } else if (rangeStatus === '미달') {
    downwardStopped = true;
    break; // 하향 검증 중단
  }
}

// 현용법 추가
dosageOptions.push(currentDose);

// 상향 6개 검증 (작은 용량부터 큰 용량 순서)
for (let i = 1; i <= 6; i++) {
  if (upwardStopped) break;
  const optionDose = currentDose + (step * i);
  
  const result = await callApiForAmount(optionDose);
  
  // 결과를 캐시에 저장 (동일 로직)
  
  const rangeStatus = getTargetRangeStatus(result.resp);
  
  if (result.isTargetReached) {
    dosageOptions.push(optionDose);
  } else if (rangeStatus === '초과') {
    upwardStopped = true;
    break; // 상향 검증 중단
  }
}

// 오름차순 정렬
dosageOptions.sort((a, b) => a - b);
```

#### `handleDosageAndIntervalAdjustment()`
- "용량&시간 조정하기" 버튼 클릭 시 호출
- 용량 옵션 생성 로직은 `handleDosageAdjustmentV2`와 동일
- 시간은 현재 값 유지
- **옵션 생성 완료 후 현용법 용량 및 간격 자동 하이라이트**
- **옵션 재사용 로직 포함** (`existingDosageCard` 확인)

**현용법 간격 하이라이트 로직:**
```typescript
// 현용법 투약 간격 정보
const currentIntervalHours = lastDose?.intervalHours;

if (currentIntervalHours) {
  const intervalHours = currentIntervalHours;
  const matchedOption = intervalOptions.find(opt => {
    const optHours = getIntervalHours(opt.label);
    return optHours === intervalHours;
  });
  
  if (matchedOption) {
    setSelectedIntervalOption((prev) => ({ ...prev, [newCardNumber]: matchedOption.label }));
  } else {
    // 직접 입력 형식으로 처리
    const customLabel = `${currentIntervalHours}시간`;
    setCustomIntervalInputs((prev) => ({ ...prev, [newCardNumber]: customLabel }));
  }
}
```

#### `callApiForAmount(amt: number, retries: number)`
- 특정 용량에 대한 API 호출 헬퍼 함수
- 재시도 로직 포함
- 에러 처리 및 로깅
- `isWithinTargetRange` 및 `Steady_state` 확인하여 `isTargetReached`, `isSteadyState` 반환

#### `loadCurrentMethodForCard(cardId: number)`
- 현용법 차트 데이터 로드
- **이미 호출된 TDM 결과(`tdmResult`)가 있으면 즉시 사용** (추가 API 호출 없음)
- `cardTdmExtraSeries[cardId].currentMethodSeries` 설정

#### `handleDosageSelect(cardId: number, label: string)`
- 사용자가 용량 옵션 선택 시 호출
- 캐시 확인: `dosageSuggestionResults[cardId][amountMg]`
- 캐시가 있으면 API 호출 없이 즉시 차트 업데이트
- 캐시가 없으면 `applyDoseScenarioForCard` 호출

#### `applyDosageAndIntervalScenarioForCard(cardId: number, amountMg: number, tauHours: number)`
- "용량&시간 조정하기" 카드에서 용량과 시간 선택 시 호출
- **캐시 확인**: `dosageSuggestionResults[cardId][amountMg]` 확인
- **캐시 재사용 조건**: 현재 요청 시간(`tauHours`)이 목표치 도달 케이스에서 사용한 `currentInterval`과 같으면 재사용
- 캐시가 있으면 API 호출 없이 즉시 차트 업데이트
- 캐시가 없으면 API 호출 후 결과를 캐시에 저장

### 상태 관리

```typescript
// 로딩 상태
dosageLoading: { [cardId: number]: boolean }

// 에러 상태
dosageError: { [cardId: number]: boolean }

// 생성된 옵션 목록
dosageSuggestions: { [cardId: number]: number[] }

// API 호출 결과 캐시
dosageSuggestionResults: {
  [cardId: number]: {
    [amount: number]: {
      data: TdmApiResponse;
      dataset: TdmDatasetRow[];
    };
  };
}

// 선택된 용량
selectedDosage: { [cardId: number]: string }

// 선택된 간격 (용량&시간 조정 카드)
selectedIntervalOption: { [cardId: number]: string }

// 현용법 차트 데이터
cardTdmExtraSeries: {
  [cardId: number]: {
    currentMethodSeries: Array<{ time: number; value: number }>;
    ipredSeries: Array<{ time: number; value: number }>;
    predSeries: Array<{ time: number; value: number }>;
    observedSeries: Array<{ time: number; value: number }>;
  };
}
```

## 사용자 플로우

### "용량 조정하기" 선택 시

1. 카드 생성
2. **현용법 차트 즉시 표시** (`cardChartData[cardId] = true`, `loadCurrentMethodForCard` 호출)
3. 로딩 상태 표시 ("제안을 계산 중...")
4. **옵션 재사용 확인**: `existingDosageAndIntervalCard` 확인
   - 재사용 가능하면 옵션 및 캐시 복사 후 8단계로 이동
5. 현재 TDM 결과 확인
6. 목표치 상태 분석
7. 시나리오별 API 호출 (목표치 검색)
   - 시나리오 1, 2: 목표치 도달 용량 검색
   - 시나리오 3, 4: 모든 후보 옵션 API 검증 (상향/하향 중단 로직 적용)
8. 옵션 생성: **현용법 용량 + 추천 옵션 최대 12개** (총 최대 13개)
9. **현용법 용량 자동 하이라이트** (`setSelectedDosage` 호출)
10. 옵션 버튼 표시 (현용법 용량에는 "현용법" 표기)
11. 사용자가 옵션 선택 시:
    - **현용법 용량 선택**: 캐시 확인 후 API 호출 없이 현용법만 표시
    - **추천 옵션 선택**: 캐시 확인 후 필요 시 API 호출 (1회만), 현용법 + 용법조정 결과 함께 표시

### "용량&시간 조정하기" 선택 시

1. 카드 생성
2. **현용법 차트 즉시 표시** (`cardChartData[cardId] = true`, `loadCurrentMethodForCard` 호출)
3. 로딩 상태 표시 ("제안을 계산 중...")
4. **옵션 재사용 확인**: `existingDosageCard` 확인
   - 재사용 가능하면 옵션 및 캐시 복사 후 9단계로 이동
5. 현재 TDM 결과 확인
6. 목표치 상태 분석
7. 시나리오별 API 호출 (목표치 검색, 시간은 현재 값 유지)
   - 시나리오 1, 2: 목표치 도달 용량 검색
   - 시나리오 3, 4: 모든 후보 옵션 API 검증 (상향/하향 중단 로직 적용)
8. 용량 옵션 생성: **현용법 용량 + 추천 옵션 최대 12개** (총 최대 13개)
9. **현용법 용량 및 간격 자동 하이라이트** (`setSelectedDosage`, `setSelectedIntervalOption` 호출)
10. 옵션 버튼 표시 (현용법 용량에는 "현용법" 표기)
11. 사용자가 용량과 시간 모두 선택 시:
    - **현용법 용량 선택**: 캐시 확인 후 API 호출 없이 현용법만 표시
    - **추천 옵션 선택**: 캐시 확인 후 필요 시 API 호출, 현용법 + 용법조정 결과 함께 표시

## 주의사항

1. **API 호출 최적화**
   - 옵션 생성 시: 시나리오 1, 2는 목표치 검색만, 시나리오 3, 4는 모든 옵션 검증
   - 사용자 선택 시에만 API 호출 (1회, 캐시 있으면 생략)
   - 캐시를 활용하여 중복 호출 방지
   - 목표치 도달 케이스에서 상향/하향 검증 중 목표치 벗어나면 즉시 중단

2. **에러 처리**
   - 503 에러는 자동 재시도 (최대 7회, 지수 백오프)
   - 연속 실패 시 조기 중단
   - 사용자에게 명확한 피드백 제공

3. **성능 고려**
   - 목표치 검색은 최대 20단계까지만 시도
     - 무한 루프 방지 및 성능 최적화
     - 과도한 API 호출로 인한 서버 부하 방지
     - 사용자 대기 시간 최소화 (각 API 호출마다 재시도 로직 포함)
     - 실용성: 20단계를 넘어서도 목표치에 도달하지 못한다면, 그 정도로 큰 용량 차이는 비현실적일 가능성이 높음
     - 예: step이 10mg인 경우 최대 200mg 증가/감소 (현재 용량 ±200mg 범위 내에서 검색)
   - 연속 실패 시 추가 대기 시간으로 서버 부하 완화
   - 목표치 도달 케이스에서 상향/하향 검증 중단으로 불필요한 API 호출 감소

4. **옵션 재사용**
   - 카드 간 옵션 재사용 시 캐시도 함께 복사 필수
   - 재사용된 옵션 선택 시 API 호출 없이 즉시 차트 표시 가능하도록 보장

5. **현용법 하이라이트**
   - 카드 생성 후 옵션 생성 완료 시 자동으로 현용법 용량 하이라이트
   - "용량&시간 조정하기" 카드의 경우 현용법 간격도 자동 하이라이트

## 테스트 시나리오

### 시나리오 1 테스트
- 현재 용량: 345mg (반코마이신)
- 목표치: 400-600 mg·h/L
- 현재 AUC: 350 mg·h/L (미도달)
- 예상 동작: 
  - 345mg부터 증가하여 목표치 도달 용량 찾기
  - 옵션: 345mg (현용법, 하이라이트), 500mg, 510mg, ..., 610mg (총 최대 13개, 오름차순)
  - 최초 차트는 현용법만 표시
  - 현용법 용량 선택 시 현용법만 표시, 추천 옵션 선택 시 현용법 + 용법조정 결과 표시

### 시나리오 2 테스트
- 현재 용량: 800mg
- 목표치: 400-600 mg·h/L
- 현재 AUC: 700 mg·h/L (초과)
- 예상 동작: 
  - 800mg부터 감소하여 목표치 도달 용량 찾기
  - 옵션: 400mg, 390mg, ..., 290mg, 800mg (현용법, 하이라이트) (총 최대 13개, 내림차순)
  - 최초 차트는 현용법만 표시
  - 현용법 용량 선택 시 현용법만 표시, 추천 옵션 선택 시 현용법 + 용법조정 결과 표시

### 시나리오 3, 4 테스트
- 현재 용량: 500mg
- 목표치: 400-600 mg·h/L
- 현재 AUC: 500 mg·h/L (도달)
- 예상 동작: 
  - 후보: 440mg, 450mg, 460mg, 470mg, 480mg, 490mg, 500mg (현용법), 510mg, 520mg, 530mg, 540mg, 550mg
  - 모든 후보에 대해 API 호출하여 목표치 도달 여부 검증
  - 목표치 도달한 옵션만 표시 (예: 440mg, 450mg, ..., 500mg (현용법, 하이라이트), 510mg, 520mg, ...)
  - 상향 검증 중 175mg에서 목표치 초과 확인 시 175mg 이후 옵션 검증 중단
  - 하향 검증 중 125mg에서 목표치 미도달 확인 시 125mg 이후 옵션 검증 중단
  - 최초 차트는 현용법만 표시
  - 현용법 용량 선택 시 현용법만 표시, 추천 옵션 선택 시 현용법 + 용법조정 결과 표시

## 구현 체크리스트

### 필수 구현 사항
- [ ] 시나리오 1, 2: 목표치 도달 용량 검색 (최대 20단계)
- [ ] 시나리오 3, 4: 모든 후보 옵션 API 검증
- [ ] 시나리오 3, 4: 상향/하향 검증 중 목표치 벗어나면 중단
- [ ] 모든 시나리오: 현용법 용량을 첫 번째 옵션으로 추가
- [ ] 모든 시나리오: 현용법 용량 자동 하이라이트
- [ ] "용량&시간 조정하기": 현용법 간격 자동 하이라이트
- [ ] 옵션 재사용 로직 (카드 간 옵션 공유)
- [ ] 옵션 재사용 시 캐시도 함께 복사
- [ ] 검증된 옵션 결과 캐시 저장
- [ ] 사용자 선택 시 캐시 확인 후 재사용
- [ ] 최초 차트는 현용법만 표시
- [ ] 이미 호출된 TDM 결과가 있으면 즉시 차트 렌더링

### 정렬 정책
- [ ] 시나리오 1: 현용법(1순위) + 추천 12개 오름차순
- [ ] 시나리오 2: 현용법(1순위) + 추천 12개 내림차순
- [ ] 시나리오 3, 4: 하향 6개 + 현용법 + 상향 6개 오름차순
