TDM 시뮬레이션 API 통합 가이드

개요
- 앱에서 입력한 환자/투약/혈액검사 정보를 바탕으로 TDM 시뮬레이션 API(`/tdm`)를 호출하고, 결과를 로컬 스토리지에 저장합니다.

엔드포인트
- POST `http://tdm-tdm-1b97e-108747164-7c031844d2ae.kr.lb.naverncp.com/tdm`

요청 본문
- 전역 파라미터: `input_tau`, `input_amount`, `input_WT`, `input_CRCL`, `input_AGE`, `input_SEX`, `input_TOXI`, `input_AUC`, `input_CTROUGH`, `model_name`
- dataset: 최소 1개의 투여 이벤트(EVID:1)와 1개의 관찰 이벤트(EVID:0) 포함

예시
```
{
  "input_tau": 12,
  "input_amount": 1000,
  "input_WT": 70,
  "input_CRCL": 90,
  "input_AGE": 65,
  "input_SEX": 1,
  "input_TOXI": 1,
  "input_AUC": 400,
  "input_CTROUGH": 10,
  "model_name": "vancomycin1_1",
  "dataset": [
    { "ID": "1", "TIME": 0.0, "DV": null, "AMT": 1000, "RATE": 500, "CMT": 1, "WT": 70, "SEX": 1, "AGE": 65, "CRCL": 90, "TOXI": 1, "EVID": 1 },
    { "ID": "1", "TIME": 2.0, "DV": 25.3, "AMT": 0, "RATE": 0, "CMT": 1, "WT": 70, "SEX": 1, "AGE": 65, "CRCL": 90, "TOXI": 1, "EVID": 0 }
  ]
}
```

응답 본문
- 요약 지표: `AUC_before`, `CMAX_before`, `CTROUGH_before`, `AUC_after`, `CMAX_after`, `CTROUGH_after`
- 농도–시간 프로파일: `PRED_CONC`, `IPRED_CONC` (예: `{ "time": 1.5, "IPRED": 14.32 }`)

앱 통합 포인트
- 로컬 스토리지 유틸: `src/lib/storage.ts`
- 호출/저장: `src/components/PKSimulation.tsx` 내 `callTdmApi()`
- 저장 키: `tdmfriends:tdmResult:<patientId>`
- UI: 시뮬레이션 화면 상단에 실행 버튼과 최근 저장 결과 표시

주의 사항
- 현재 CRCL 등 일부 파라미터는 직접 입력 항목이 없어 기본값(예: 90 mL/min)을 사용합니다. 추후 신기능 입력에서 파생 값으로 대체 가능.
- 최소 요건(투여 이벤트 1개, 관찰 이벤트 1개)을 보장하기 위해 투여력/혈액검사에 데이터가 없을 경우 기본 관찰 이벤트를 생성합니다.

향후 개선
- 신기능 입력으로부터 Cockcroft-Gault/CKD-EPI 계산값을 사용하여 `input_CRCL` 채우기
- 다회 투여 기록을 `dataset`으로 확장
- API 실패/지연 시 UI 알림과 재시도 정책
