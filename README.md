# PKfriends
PK_friends의 프론트 페이지입니다.

## Persistence

- 앱의 핵심 데이터는 `localStorage`에 저장되어 새로고침 후에도 유지됩니다.
- 구현 위치: `src/lib/storage.ts` 와 `STORAGE_KEYS` 상수.

## TDM Simulation API

- 외부 TDM 시뮬레이션 API와의 연동을 추가하였습니다.
- 결과는 환자별로 `localStorage` 키 `tdmfriends:tdmResult:<patientId>` 로 저장됩니다.
- 자세한 사용 가이드는 `docs/tdm-api.md`를 확인하세요.
