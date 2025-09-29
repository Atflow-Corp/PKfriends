import React, { useState, useEffect, useRef } from 'react';

// 주입시간 입력 컴포넌트 (포커스 유지를 위한 독립적인 컴포넌트)
const InjectionTimeInput = ({ row, onUpdate, isDarkMode }) => {
  const [localValue, setLocalValue] = useState(row.injectionTime);
  const [isEditing, setIsEditing] = useState(false);

  // 외부에서 row.injectionTime이 변경되면 로컬 값도 업데이트 (편집 중이 아닐 때만)
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(row.injectionTime);
    }
  }, [row.injectionTime, isEditing]);

  const handleChange = (e) => {
    setLocalValue(e.target.value);
  };

  const handleFocus = (e) => {
    setIsEditing(true);
    // 포커스 시 커서 위치를 끝으로 설정
    e.target.setSelectionRange(e.target.value.length, e.target.value.length);
  };

  const handleBlur = (e) => {
    setIsEditing(false);
    // 포커스 아웃 시에만 실제 데이터 업데이트
    onUpdate(row.id, "injectionTime", e.target.value);
  };

  const handleKeyDown = (e) => {
    // Enter 키로 편집 완료
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={{
        border: "none",
        background: "transparent",
        textAlign: "center",
        width: "100%",
        color: isDarkMode ? "#e0e6f0" : undefined
      }}
    />
  );
};

// 투약 시간 입력 컴포넌트 (포커스 유지를 위한 독립적인 컴포넌트)
const TimeInput = ({ row, onUpdate, isDarkMode }) => {
  const [localValue, setLocalValue] = useState(row.timeStr);
  const [isEditing, setIsEditing] = useState(false);

  // 외부에서 row.timeStr이 변경되면 로컬 값도 업데이트 (편집 중이 아닐 때만)
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(row.timeStr);
    }
  }, [row.timeStr, isEditing]);

  const handleChange = (e) => {
    setLocalValue(e.target.value);
  };

  const handleFocus = (e) => {
    setIsEditing(true);
    // 포커스 시 전체 텍스트 선택
    e.target.select();
  };

  const handleBlur = (e) => {
    setIsEditing(false);
    // 포커스 아웃 시에만 실제 데이터 업데이트
    let cleanValue = e.target.value.toString().replace(/undefined/g, '').trim();
    
    // 연속된 숫자 형식 (YYYYMMDDHHMM) 파싱
    if (/^\d{12}$/.test(cleanValue)) {
      // "20259181200" 형식인 경우
      const year = cleanValue.substring(0, 4);
      const month = cleanValue.substring(4, 6);
      const day = cleanValue.substring(6, 8);
      const hour = cleanValue.substring(8, 10);
      const minute = cleanValue.substring(10, 12);
      cleanValue = `${year}-${month}-${day} ${hour}:${minute}`;
    }
    // 연속된 숫자 형식 (YYYYMMDDHHM) 파싱 (분이 한자리인 경우)
    else if (/^\d{11}$/.test(cleanValue)) {
      // "20259181205" 형식인 경우
      const year = cleanValue.substring(0, 4);
      const month = cleanValue.substring(4, 6);
      const day = cleanValue.substring(6, 8);
      const hour = cleanValue.substring(8, 10);
      const minute = cleanValue.substring(10, 11);
      cleanValue = `${year}-${month}-${day} ${hour}:0${minute}`;
    }
    // 연속된 숫자 형식 (YYYYMMDDHH) 파싱 (분이 없는 경우)
    else if (/^\d{10}$/.test(cleanValue)) {
      // "2025918120" 형식인 경우
      const year = cleanValue.substring(0, 4);
      const month = cleanValue.substring(4, 6);
      const day = cleanValue.substring(6, 8);
      const hour = cleanValue.substring(8, 10);
      cleanValue = `${year}-${month}-${day} ${hour}:00`;
    }
    // "YYYY MM DD HH:MM" 형식을 "YYYY-MM-DD HH:MM" 형식으로 변환
    else if (cleanValue.includes(' ') && cleanValue.includes(':') && !cleanValue.includes('-')) {
      // "YYYY MM DD HH:MM" 형식인 경우
      const parts = cleanValue.split(' ');
      if (parts.length === 4) {
        const [year, month, day, time] = parts;
        cleanValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${time}`;
      }
    }
    
    onUpdate(row.id, "timeStr", cleanValue);
  };

  const handleKeyDown = (e) => {
    // Enter 키로 편집 완료
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="YYYY-MM-DD HH:MM"
      style={{
        border: "none",
        background: "transparent",
        textAlign: "center",
        width: "100%",
        color: isDarkMode ? "#e0e6f0" : undefined
      }}
    />
  );
};

function TablePage(props) {
  // 투약경로를 국문으로 변환하는 헬퍼 함수
  const convertRouteToKorean = (route) => {
    if (route === "IV") return "정맥";
    else if (route === "oral") return "경구";
    else if (route === "subcutaneous") return "피하";
    else if (route === "intramuscular") return "근육";
    return route || "";
  };

  const [currentCondition, setCurrentCondition] = useState({
    route: "",
    dosage: "",
    unit: "mg",
    intervalHours: "",
    injectionTime: "",
    dosageForm: "",
    firstDoseDate: "",
    firstDoseTime: "",
    totalDoses: ""
  });
  
  const [conditions, setConditions] = useState(props.initialConditions || []);
  const [tableData, setTableData] = useState(props.initialTableData || []);
  const [isTableGenerated, setIsTableGenerated] = useState(props.initialIsTableGenerated || false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [draggedRow, setDraggedRow] = useState(null);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [editingCondition, setEditingCondition] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingConditionId, setEditingConditionId] = useState(null);
  // 화면 전환용 state 추가
  const [activePage, setActivePage] = useState('table'); // 'table' 또는 'terms'
  const [errorModal, setErrorModal] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  // 부모 -> 자식 동기화 중 변경 전파(onRecordsChange) 차단 플래그
  const skipPropagateRef = useRef(false);
  // 최신 onRecordsChange 콜백 참조 보관 (의존성으로 인한 재실행 방지)
  const onRecordsChangeRef = useRef(props.onRecordsChange);
  useEffect(() => { onRecordsChangeRef.current = props.onRecordsChange; }, [props.onRecordsChange]);
  
  // 최신 onConditionsChange 콜백 참조 보관
  const onConditionsChangeRef = useRef(props.onConditionsChange);
  useEffect(() => { onConditionsChangeRef.current = props.onConditionsChange; }, [props.onConditionsChange]);
  // 마지막 전송한 records 스냅샷 (불필요한 전파 방지)
  const lastRecordsJsonRef = useRef(null);
  useEffect(() => {
    const updateDark = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    updateDark();
    window.addEventListener('transitionend', updateDark);
    window.addEventListener('click', updateDark);
    window.addEventListener('keydown', updateDark);
    return () => {
      window.removeEventListener('transitionend', updateDark);
      window.removeEventListener('click', updateDark);
      window.removeEventListener('keydown', updateDark);
    };
  }, []);

  // Load initial administrations from parent and render as table
  useEffect(() => {
    const admins = props.initialAdministrations || [];
    if (!admins || admins.length === 0) return;
    try {
      const titleRow = {
        id: "title",
        round: "회차",
        time: "투약 시간",
        amount: "투약용량",
        route: "투약경로",
        injectionTime: "주입시간",
        isTitle: true
      };
      const rows = admins.map((adm, idx) => {
        const timeStr = `${adm.date} ${adm.time}`;
        const dt = new Date(`${adm.date}T${adm.time}`);
        return {
          id: String(adm.id || `${Date.now()}_${idx}`),
          conditionId: null,
          doseIndex: idx + 1,
          totalDoses: admins.length,
          time: dt,
          timeStr,
          amount: `${adm.dose} ${adm.unit || 'mg'}`,
          route: adm.route,
          injectionTime: adm.isIVInfusion ? (adm.infusionTime !== undefined ? String(adm.infusionTime) : '0') : '-',
          isTitle: false
        };
      }).sort((a,b) => a.time - b.time);
      rows.forEach((row, i) => { row.round = `${i + 1} 회차`; });
      // 부모 props 적용으로 인한 변경 전파 차단
      skipPropagateRef.current = true;
      setTableData([titleRow, ...rows]);
      setIsTableGenerated(true);
      // 다음 틱에서 해제
      setTimeout(() => { skipPropagateRef.current = false; }, 0);
    } catch {}
  }, [props.initialAdministrations]);

  // Propagate table changes to parent for persistence
  useEffect(() => {
    if (!onRecordsChangeRef.current) return;
    if (skipPropagateRef.current) { skipPropagateRef.current = false; return; }
    const records = tableData.filter(r => !r.isTitle).map(r => ({
      timeStr: r.timeStr,
      amount: r.amount,
      route: r.route,
      injectionTime: r.injectionTime
    }));
    try {
      const json = JSON.stringify(records);
      if (lastRecordsJsonRef.current === json) return;
      lastRecordsJsonRef.current = json;
    } catch {}
    onRecordsChangeRef.current(records);
  }, [tableData]);

  // Propagate conditions changes to parent
  useEffect(() => {
    if (!onConditionsChangeRef.current) return;
    console.log('Conditions changed:', conditions);
    onConditionsChangeRef.current(conditions);
  }, [conditions]);

  // 초기 로드 완료 후 isInitialLoad를 false로 설정
  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [isInitialLoad]);


  // props가 변경될 때 state 업데이트
  useEffect(() => {
    let changed = false;
    if (props.initialConditions) {
      setConditions(props.initialConditions);
      changed = true;
    }
    if (props.initialTableData) {
      skipPropagateRef.current = true; // 부모에서 내려온 테이블 데이터 적용 시 전파 차단
      
      // 부모로부터 받은 데이터에서 주입시간 보존 로직
      const preservedTableData = props.initialTableData.map(row => {
        if (!row.isTitle && row.route === "정맥" && (!row.injectionTime || row.injectionTime === "-")) {
          // 정맥 투여인데 주입시간이 없거나 "-"인 경우 "0"으로 설정
          return { ...row, injectionTime: "0" };
        } else if (!row.isTitle && row.route !== "정맥" && row.injectionTime === "0") {
          // 정맥이 아닌데 주입시간이 "0"인 경우 "-"로 설정
          return { ...row, injectionTime: "-" };
        }
        return row;
      });
      
      setTableData(preservedTableData);
      changed = true;
    }
    if (props.initialIsTableGenerated !== undefined) {
      setIsTableGenerated(props.initialIsTableGenerated);
      changed = true;
    }
    if (changed) {
      setTimeout(() => { skipPropagateRef.current = false; }, 0);
    }
  }, [props.initialConditions, props.initialTableData, props.initialIsTableGenerated]);

  // 투약 경로 옵션
  const routeOptions = [
    { value: "경구", label: "경구 (oral)" },
    { value: "정맥", label: "정맥 (IV)" },
    { value: "피하", label: "피하 (SC)" }
  ];


  // 약물별 기본 단위 정의
  const getDefaultUnit = (drugName, route) => {
    if (!drugName || !route) return "mg";
    
    const drug = drugName.toLowerCase();
    const routeLower = route.toLowerCase();
    
    if (drug === "vancomycin") {
      return "mg";
    } else if (drug === "cyclosporin") {
      if (routeLower === "정맥" || routeLower === "iv") return "mg";
      else if (routeLower === "경구" || routeLower === "oral") return "mg";
    }
    
    return "mg";
  };
  
  // 단위 옵션
  const unitOptions = ["mg", "g", "mcg"];

  // 조건 요약 텍스트 생성
  const getConditionSummary = (condition) => {
    if (!condition.firstDoseDate || !condition.firstDoseTime) {
      return "날짜와 시간을 입력해주세요";
    }
    const unitText = condition.unit ? condition.unit : "mg";
    return `${condition.totalDoses}회 투약, ${condition.intervalHours}시간 간격, ${condition.firstDoseDate} ${condition.firstDoseTime}, ${condition.dosage} ${unitText}, ${condition.route}${condition.route === "정맥" && condition.injectionTime ? ` (${condition.injectionTime})` : ""}`;
  };

  // 현재 조건 입력값 변경 처리
  const handleCurrentConditionChange = (field, value) => {
    setCurrentCondition(prev => {
      const newCondition = { ...prev, [field]: value };
      
      // 투약 경로가 변경되면 제형만 설정 (투약용량 자동 설정 제거)
      if (field === "route" && props.tdmDrug?.drugName) {
        // Cyclosporin 경구일 때 제형 기본값 지정
        if ((props.tdmDrug.drugName?.toLowerCase() === "cyclosporin" || props.tdmDrug.drugName?.toLowerCase() === "cyclosporine") && (value === "경구" || value === "oral")) {
          if (!newCondition.dosageForm) newCondition.dosageForm = "capsule/tablet";
        } else {
          newCondition.dosageForm = "";
        }
        // 단위만 설정하고 투약용량은 사용자가 직접 입력하도록 함
        const defaultUnit = getDefaultUnit(props.tdmDrug.drugName, value);
        if (defaultUnit) {
          newCondition.unit = defaultUnit;
        }
      }
      
      return newCondition;
    });
  };

  // 조건 추가 또는 수정
  const addOrUpdateCondition = () => {
    // 필수 필드 검증
    if (!currentCondition.firstDoseDate) {
      alert("날짜와 시간을 입력해주세요! (예: 202507251400)");
      return;
    }
    // 입력값 파싱 (YYYYMMDDHHmm 형식만 지원)
    let datePart = "";
    let timePart = "";
    let input = currentCondition.firstDoseDate.trim();
    if (/^\d{8}\d{4}$/.test(input.replace(/[-: ]/g, ""))) {
      // 202507251400
      datePart = input.slice(0, 8);
      timePart = input.slice(8, 12);
      datePart = datePart.slice(0,4) + '-' + datePart.slice(4,6) + '-' + datePart.slice(6,8);
      timePart = timePart.slice(0,2) + ':' + timePart.slice(2,4);
    } else {
      alert("날짜와 시간 형식이 올바르지 않습니다. 예: 202507251400");
      return;
    }
    // 오늘 이후 날짜 입력 방지
    const todayStr = new Date().toISOString().slice(0, 10);
    if (datePart > todayStr) {
      alert("투약 날짜는 오늘 이후로 입력할 수 없습니다.");
      return;
    }
    // 내부 상태에 파싱된 값 저장
    currentCondition.firstDoseDate = datePart;
    currentCondition.firstDoseTime = timePart;
    
    if (!currentCondition.unit) {
      alert("단위를 선택해주세요!");
      return;
    }

    if (isEditMode) {
      // 수정 모드: 기존 조건 업데이트
      setConditions(prev => 
        prev.map(condition => 
          condition.id === editingConditionId 
            ? { ...currentCondition, id: editingConditionId }
            : condition
        )
      );
      
      // 수정 모드 종료
      setIsEditMode(false);
      setEditingConditionId(null);
    } else {
      // 추가 모드: 새 조건 추가
      const newCondition = {
        id: Date.now(), // 고유 ID 생성
        ...currentCondition
      };

      setConditions(prev => [...prev, newCondition]);
    }

    // 현재 조건 초기화
    setCurrentCondition({
      route: "",
      dosage: "",
      unit: "mg",
      intervalHours: "",
      injectionTime: "",
      firstDoseDate: "",
      firstDoseTime: "",
      totalDoses: ""
    });
  };

  // 조건 삭제
  const removeCondition = (conditionId) => {
    setConditions(prev => prev.filter(c => c.id !== conditionId));
  };

  // 조건 수정 모드 시작
  const startEditCondition = (conditionId) => {
    const conditionToEdit = conditions.find(c => c.id === conditionId);
    if (conditionToEdit) {
      // 날짜와 시간을 합쳐서 표시 (YYYYMMDDHHmm 형식)
      const dateStr = conditionToEdit.firstDoseDate.replace(/-/g, '');
      const timeStr = conditionToEdit.firstDoseTime.replace(/:/g, '');
      const combinedDateTime = dateStr + timeStr;
      
      // 조건 입력창에 해당 조건 로드
      setCurrentCondition({
        route: conditionToEdit.route,
        dosage: conditionToEdit.dosage,
        unit: conditionToEdit.unit,
        intervalHours: conditionToEdit.intervalHours,
        injectionTime: conditionToEdit.injectionTime,
        firstDoseDate: combinedDateTime,
        firstDoseTime: conditionToEdit.firstDoseTime,
        totalDoses: conditionToEdit.totalDoses
      });
      
      // 수정 모드 활성화
      setIsEditMode(true);
      setEditingConditionId(conditionId);
    }
  };

  // 테이블 생성 함수
  const generateTable = () => {
    // 조건이 있는지 확인
    if (conditions.length === 0) {
      alert("최소 1개의 조건을 추가해주세요!");
      return;
    }

    // 모든 조건이 유효한지 확인
    for (let condition of conditions) {
      if (!condition.totalDoses || !condition.intervalHours || 
          !condition.firstDoseDate || !condition.firstDoseTime || !condition.dosage || !condition.route || !condition.unit) {
        alert("모든 필드를 입력해주세요!");
        return;
      }
    }

    // 1. 각 조건의 투약 시작~마지막 투약일시(기간) 구하기
    const periods = conditions.map(condition => {
      const totalDoses = parseInt(condition.totalDoses);
      const interval = parseInt(condition.intervalHours);
      const firstDoseDateTime = `${condition.firstDoseDate}T${condition.firstDoseTime}`;
      const start = new Date(firstDoseDateTime);
      const end = new Date(start.getTime() + (totalDoses - 1) * interval * 60 * 60 * 1000);
      return { start, end };
    });
    // 2. 모든 조건의 기간이 서로 겹치는지 검사
    for (let i = 0; i < periods.length; i++) {
      for (let j = i + 1; j < periods.length; j++) {
        // 겹치는지 검사: (A.start <= B.end && B.start <= A.end)
        if (periods[i].start <= periods[j].end && periods[j].start <= periods[i].end) {
          setErrorModal('중복된 투약일정이 있습니다. 투약일시를 다시 확인해주세요.');
          return;
        }
      }
    }

    let newTableData = [];
    
    // 타이틀 행 수정
    newTableData.push({
      id: "title",
      round: "회차",
      time: "투약 시간",
      amount: "투약용량",
      route: "투약경로",
      injectionTime: "주입시간",
      isTitle: true
    });

    // 모든 조건의 투약 일시별로 데이터 생성
    let allDoses = [];
    conditions.forEach(condition => {
      const totalDoses = parseInt(condition.totalDoses);
      const interval = parseInt(condition.intervalHours);
      const unit = condition.unit;
      const firstDoseDateTime = `${condition.firstDoseDate}T${condition.firstDoseTime}`;
      const firstDose = new Date(firstDoseDateTime);
      const route = condition.route;
      const injectionTime = condition.injectionTime;
      for (let i = 0; i < totalDoses; i++) {
        const doseTime = new Date(firstDose.getTime() + (i * interval * 60 * 60 * 1000));
        allDoses.push({
          id: `${condition.id}_${i+1}`,
          conditionId: condition.id,
          doseIndex: i + 1,
          totalDoses,
          time: doseTime,
          timeStr: `${doseTime.getFullYear()}-${String(doseTime.getMonth() + 1).padStart(2, '0')}-${String(doseTime.getDate()).padStart(2, '0')} ${String(doseTime.getHours()).padStart(2, '0')}:${String(doseTime.getMinutes()).padStart(2, '0')}`,
          amount: `${condition.dosage} ${unit}`,
          route,
          injectionTime: route === "정맥" && injectionTime ? injectionTime : "-",
          isTitle: false
        });
      }
    });
    // 중복 투약일시 검사
    const timeSet = new Set();
    for (const dose of allDoses) {
      if (timeSet.has(dose.timeStr)) {
        alert("중복된 투약일정이 있습니다. 투약일시를 다시 확인해주세요.");
        return;
      }
      timeSet.add(dose.timeStr);
    }
    // 3. 투약일시 기준으로 오름차순 정렬
    allDoses.sort((a, b) => a.time - b.time);
    // 회차 표기를 '1 회차', '2 회차', ...로 변경
    allDoses.forEach((dose, idx) => {
      dose.round = `${idx + 1} 회차`;
    });
    newTableData = [newTableData[0], ...allDoses];

    setTableData(newTableData);
    setIsTableGenerated(true);
    if (props.onTableGenerated) props.onTableGenerated();
    setSelectedRows(new Set()); // 선택 상태 초기화
    
    // 초기 로드가 아닐 때만 onSaveRecords 호출 (중복 저장 방지)
    if (props.onSaveRecords && !isInitialLoad) {
      // title row 제외, 실제 투약기록만 전달
      const records = newTableData.filter(row => !row.isTitle).map(row => ({
        timeStr: row.timeStr,
        amount: row.amount,
        route: row.route,
        injectionTime: row.injectionTime
      }));
      props.onSaveRecords(records);
    }
  };

  // 테이블 데이터 수정 함수
  const handleTableEdit = (id, field, value) => {
    setTableData(prev => 
      prev.map(row => {
        if (row.id === id) {
          const updatedRow = { ...row, [field]: value };
          
          // 투약 시간 수정 시 날짜와 시간 정보도 함께 업데이트
          if (field === "timeStr" && value) {
            // "undefined" 문자열 제거 (모든 발생 제거)
            let cleanValue = value.toString().replace(/undefined/g, '').trim();
            
            // 연속된 숫자 형식 (YYYYMMDDHHMM) 파싱
            if (/^\d{12}$/.test(cleanValue)) {
              // "20259181200" 형식인 경우
              const year = cleanValue.substring(0, 4);
              const month = cleanValue.substring(4, 6);
              const day = cleanValue.substring(6, 8);
              const hour = cleanValue.substring(8, 10);
              const minute = cleanValue.substring(10, 12);
              cleanValue = `${year}-${month}-${day} ${hour}:${minute}`;
            }
            // 연속된 숫자 형식 (YYYYMMDDHHM) 파싱 (분이 한자리인 경우)
            else if (/^\d{11}$/.test(cleanValue)) {
              // "20259181205" 형식인 경우
              const year = cleanValue.substring(0, 4);
              const month = cleanValue.substring(4, 6);
              const day = cleanValue.substring(6, 8);
              const hour = cleanValue.substring(8, 10);
              const minute = cleanValue.substring(10, 11);
              cleanValue = `${year}-${month}-${day} ${hour}:0${minute}`;
            }
            // 연속된 숫자 형식 (YYYYMMDDHH) 파싱 (분이 없는 경우)
            else if (/^\d{10}$/.test(cleanValue)) {
              // "2025918120" 형식인 경우
              const year = cleanValue.substring(0, 4);
              const month = cleanValue.substring(4, 6);
              const day = cleanValue.substring(6, 8);
              const hour = cleanValue.substring(8, 10);
              cleanValue = `${year}-${month}-${day} ${hour}:00`;
            }
            // "YYYY MM DD HH:MM" 형식을 "YYYY-MM-DD HH:MM" 형식으로 변환
            else if (cleanValue.includes(' ') && cleanValue.includes(':') && !cleanValue.includes('-')) {
              // "YYYY MM DD HH:MM" 형식인 경우
              const parts = cleanValue.split(' ');
              if (parts.length === 4) {
                const [year, month, day, time] = parts;
                cleanValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${time}`;
              }
            }
            
            // "YYYY-MM-DD HH:MM" 형식인지 확인
            if (cleanValue.includes(' ') && cleanValue.includes('-') && cleanValue.includes(':')) {
              const parts = cleanValue.split(' ');
              if (parts.length === 2) {
                updatedRow.date = parts[0]; // "YYYY-MM-DD"
                updatedRow.time = parts[1]; // "HH:MM"
              }
            } else if (cleanValue.includes(':')) {
              // "HH:MM" 형식만 있는 경우 기존 날짜 유지
              updatedRow.time = cleanValue;
              if (!updatedRow.date) {
                updatedRow.date = new Date().toISOString().split('T')[0];
              }
            }
            
            // 정리된 값으로 업데이트
            updatedRow.timeStr = cleanValue;
          }
          
          // 투약 경로가 변경되면 단위와 주입시간 설정 (투약용량 자동 설정 제거)
          if (field === "route") {
            // 투약용량 자동 설정 제거 - 사용자가 직접 입력하도록 함
            
            // 정맥으로 변경 시 주입시간을 0으로 자동 설정
            if (value === "정맥") {
              updatedRow.injectionTime = "0";
            } else {
              // 정맥이 아닌 경우 주입시간을 "-"로 설정
              updatedRow.injectionTime = "-";
            }
            
            // 디버깅용 로그
            console.log(`투약 경로 변경: ${row.route} → ${value}, 주입시간: ${row.injectionTime} → ${updatedRow.injectionTime}`);
          }
          
          return updatedRow;
        }
        return row;
      })
    );
  };

  // 투약 시간 조정 함수 (1분 단위)
  const adjustTime = (id, direction) => {
    setTableData(prev => 
      prev.map(row => {
        if (row.id === id && !row.isTitle) {
          // 현재 timeStr에서 날짜와 시간 분리
          let currentTimeStr = row.timeStr || '';
          currentTimeStr = currentTimeStr.toString().replace(/undefined/g, '').trim();
          
          let currentDate, currentTime;
          
          // "YYYY-MM-DD HH:MM" 형식인지 확인
          if (currentTimeStr.includes(' ') && currentTimeStr.includes('-') && currentTimeStr.includes(':')) {
            const parts = currentTimeStr.split(' ');
            if (parts.length === 2) {
              currentDate = parts[0]; // "YYYY-MM-DD"
              currentTime = parts[1]; // "HH:MM"
            }
          } else if (currentTimeStr.includes(':')) {
            // "HH:MM" 형식만 있는 경우
            currentTime = currentTimeStr;
            // 기존 날짜 정보가 있으면 사용, 없으면 오늘 날짜 사용
            currentDate = row.date || new Date().toISOString().split('T')[0];
          } else {
            // 유효하지 않은 형식이면 기본값 설정
            currentDate = new Date().toISOString().split('T')[0];
            currentTime = '09:00';
          }
          
          // 시간 파싱 (HH:MM 형식)
          const timeParts = currentTime.split(':');
          if (timeParts.length >= 2) {
            let hours = parseInt(timeParts[0], 10);
            let minutes = parseInt(timeParts[1], 10);
            
            // NaN 체크 및 범위 검증
            if (isNaN(hours) || isNaN(minutes)) {
              hours = 9;
              minutes = 0;
            }
            
            // 시간 범위 검증 (0-23, 0-59)
            hours = Math.max(0, Math.min(23, hours));
            minutes = Math.max(0, Math.min(59, minutes));
            
            // 현재 날짜와 시간으로 Date 객체 생성
            const currentDateTime = new Date(`${currentDate}T${currentTime}`);
            
            // 1분 추가 또는 감소
            const adjustedDateTime = new Date(currentDateTime);
            adjustedDateTime.setMinutes(adjustedDateTime.getMinutes() + (direction === 'plus' ? 1 : -1));
            
            // 새로운 날짜와 시간 정보 추출
            const newYear = adjustedDateTime.getFullYear();
            const newMonth = (adjustedDateTime.getMonth() + 1).toString().padStart(2, '0');
            const newDay = adjustedDateTime.getDate().toString().padStart(2, '0');
            const newHours = adjustedDateTime.getHours().toString().padStart(2, '0');
            const newMinutes = adjustedDateTime.getMinutes().toString().padStart(2, '0');
            
            // 새로운 날짜와 시간 문자열
            const newDateStr = `${newYear}-${newMonth}-${newDay}`;
            const newTimeStr = `${newHours}:${newMinutes}`;
            const newFullTimeStr = `${newDateStr} ${newTimeStr}`;
            
            return { 
              ...row, 
              timeStr: newFullTimeStr,
              date: newDateStr,
              time: newTimeStr
            };
          } else {
            // 시간 형식이 맞지 않으면 기본값 설정
            const today = new Date();
            const defaultDate = today.toISOString().split('T')[0];
            const defaultTime = '09:00';
            return { 
              ...row, 
              timeStr: `${defaultDate} ${defaultTime}`,
              date: defaultDate,
              time: defaultTime
            };
          }
        }
        return row;
      })
    );
  };

  // 행 추가 함수
  const addRow = () => {
    const newId = Math.max(0, ...tableData.filter(row => !row.isTitle).map(row => parseInt(row.id) || 0)) + 1;
    
    // 기존 투약 기록에서 마지막 투약 시간 찾기
    const lastDoseRow = tableData
      .filter(row => !row.isTitle && row.timeStr)
      .sort((a, b) => {
        // timeStr을 기준으로 정렬 (YYYY-MM-DD HH:MM 형식)
        if (a.timeStr && b.timeStr) {
          const dateA = new Date(a.timeStr);
          const dateB = new Date(b.timeStr);
          return dateB.getTime() - dateA.getTime(); // 최신순 정렬
        }
        return 0;
      })[0];
    
    let nextDateTime;
    if (lastDoseRow && lastDoseRow.timeStr) {
      // 마지막 투약 시간에서 12시간 후로 계산 (기본 간격)
      const lastDateTime = new Date(lastDoseRow.timeStr);
      nextDateTime = new Date(lastDateTime.getTime() + 12 * 60 * 60 * 1000); // 12시간 추가
    } else {
      // 기존 투약 기록이 없으면 오늘 오전 9시로 설정
      nextDateTime = new Date();
      nextDateTime.setHours(9, 0, 0, 0);
    }
    
    const nextDate = nextDateTime.toISOString().split('T')[0];
    const nextTime = nextDateTime.toTimeString().slice(0, 5);
    
    // 기존 투약 기록에서 가장 많이 사용된 투약 용량 찾기
    const existingAmounts = tableData
      .filter(row => !row.isTitle && row.amount && row.amount !== "0")
      .map(row => row.amount);
    
    let defaultAmount = "500 mg"; // 기본값
    if (existingAmounts.length > 0) {
      // 가장 많이 사용된 용량을 기본값으로 설정
      const amountCounts = {};
      existingAmounts.forEach(amount => {
        amountCounts[amount] = (amountCounts[amount] || 0) + 1;
      });
      const mostCommonAmount = Object.keys(amountCounts).reduce((a, b) => 
        amountCounts[a] > amountCounts[b] ? a : b
      );
      defaultAmount = mostCommonAmount;
    }
    
    const newRow = {
      id: String(newId),
        round: `${newId}회차`,
      date: nextDate,
      time: nextTime,
      timeStr: `${nextDate} ${nextTime}`,
      amount: defaultAmount,
        route: "경구",
        injectionTime: "-",
        isTitle: false
    };
    
    setTableData(prev => [...prev, newRow]);
  };

  // 체크박스 선택 처리
  const handleRowSelect = (rowId) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  // 선택된 행들 삭제
  const deleteSelectedRows = () => {
    if (selectedRows.size === 0) {
      alert("삭제할 행을 선택해주세요!");
      return;
    }
    
    if (window.confirm(`선택된 ${selectedRows.size}개 행을 삭제하시겠습니까?`)) {
      setTableData(prev => prev.filter(row => !selectedRows.has(row.id)));
      setSelectedRows(new Set());
    }
  };

  // 테이블 데이터만 삭제 (투약 서머리 데이터는 유지)
  const resetTableData = () => {
    if (window.confirm("투약 기록 테이블을 전체 삭제하시겠습니까? 처방 내역은 유지됩니다.")) {
      setTableData([]);
      setIsTableGenerated(false);
      setSelectedRows(new Set());
      setCurrentCondition({
        route: "",
        dosage: "",
        unit: "mg",
        intervalHours: "",
        injectionTime: "",
        firstDoseDate: "",
        firstDoseTime: "",
        totalDoses: ""
      });
      setIsEditMode(false);
      setEditingConditionId(null);
    }
  };

  // 드래그 시작
  const handleDragStart = (e, rowId) => {
    setDraggedRow(rowId);
  };

  // 드래그 오버
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // 드롭
  const handleDrop = (e, targetRowId) => {
    e.preventDefault();
    if (draggedRow === targetRowId || draggedRow === "title") return;

    const draggedIndex = tableData.findIndex(row => row.id === draggedRow);
    const targetIndex = tableData.findIndex(row => row.id === targetRowId);
    
    if (draggedIndex ===-1|| targetIndex === -1) return;

    const newTableData = [...tableData];
    const draggedItem = newTableData[draggedIndex];
    
    // 드래그된 아이템 제거
    newTableData.splice(draggedIndex,1);
    // 타겟 위치에 삽입
    newTableData.splice(targetIndex, 0, draggedItem);
    
    // 회차 번호 재정렬
    newTableData.forEach((row, index) => {
      if (!row.isTitle) {
        row.round = `${index + 1}`;
      }
    });

    setTableData(newTableData);
    setDraggedRow(null);
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div
      style={{
        padding: "0",
        fontFamily: "Arial, sans-serif",
        background: isDarkMode ? "#181e29" : "#f4f6fa",
        color: isDarkMode ? "#e0e6f0" : "#333"
      }}
    >
      <div style={{ width: "100%", margin: 0, padding: "0 0 40px 0" }}>
        <div>
          {/* 이하 기존 테이블 입력 UI 코드 유지 */}
          {/* 1단계: 개선된 조건 입력 UI */}
          <div style={{
            background: isDarkMode ? "#23293a" : "#f8f9fa",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "30px",
            border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6"
          }}>
            <h1 style={{ marginBottom: 20, color: isDarkMode ? "#e0e6f0" : "#495057" }}>1단계: 처방 내역을 입력하세요</h1>
            <div style={{ 
              marginBottom: 20, 
              color: isDarkMode ? '#9ca3af' : '#6b7280', 
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              <div style={{ marginBottom: '8px' }}>
                • 처방 내역을 입력한 후 [처방 내역 입력 완료] 버튼을 클릭하면 하단에 자동으로 ‘상세 투약 기록’ 테이블이 생성됩니다.
              </div>
              <div>
                • 처방 내역 변경이 있었다면 실제 처방에 일치하도록 새로운 처방 내역을 입력해야 합니다. (예: 1월 4일은 경구 투약, 1월 5일부터는 정맥 주입한 경우 처방 내역을 2개 등록)
                </div>
            </div>

                       {/* 현재 조건 입력 박스 */}
            <div style={{
              border: "2px solid #e0e7ff",
              padding: "20px",
              marginBottom: "20px",
              borderRadius: "8px",
              background: "white"
            }}>
              
              {/* 1행: 모든 항목을 한 줄에 배치 (새로운 순서) */}
              <div style={{ display: "flex", gap: "15px", marginBottom: "15px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: "bold", color: "#495057", fontSize: "13px" }}>
                    투약 경로
                  </label>
                  <select
                    value={currentCondition.route}
                    onChange={(e) => handleCurrentConditionChange("route", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #ced4da",
                      borderRadius: "6px",
                      fontSize: "14px",
                      backgroundColor: "#fff",
                      height: "40px",
                      boxSizing: "border-box",
                      color: "#495057"
                    }}
                  >
                    <option value="">투약 경로를 선택해주세요</option>
                    {routeOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

            {props.tdmDrug?.drugName && (props.tdmDrug.drugName.toLowerCase() === "cyclosporin" || props.tdmDrug.drugName.toLowerCase() === "cyclosporine") && (currentCondition.route === "경구" || currentCondition.route === "oral") && (
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: "bold", color: "#495057", fontSize: "13px" }}>
                  제형
                </label>
                <select
                  value={currentCondition.dosageForm}
                  onChange={(e) => handleCurrentConditionChange("dosageForm", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ced4da",
                    borderRadius: "6px",
                    fontSize: "14px",
                    backgroundColor: "#fff",
                    height: "40px",
                    boxSizing: "border-box",
                    color: "#495057"
                  }}
                >
                  <option value="">제형을 선택해주세요</option>
                  <option value="capsule/tablet">캡슐/정제</option>
                  <option value="oral liquid">경구현탁/액제</option>
                </select>
              </div>
            )}

                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: "bold", color: "#495057", fontSize: "13px" }}>
                    투약 용량
                  </label>
                  <input
                    type="number"
                    value={currentCondition.dosage}
                    onChange={(e) => handleCurrentConditionChange("dosage", e.target.value)}
                    placeholder="예: 500"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #ced4da",
                      borderRadius: "6px",
                      fontSize: "14px",
                      backgroundColor: "#fff",
                      height: "40px",
                      boxSizing: "border-box",
                      color: "#495057"
                    }}
                  />
                </div>

                <div style={{ width: "5%" }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: "bold", color: "#495057", fontSize: "13px" }}>
                    단위
                  </label>
                  <select
                    value={currentCondition.unit}
                    onChange={(e) => handleCurrentConditionChange("unit", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #ced4da",
                      borderRadius: "6px",
                      fontSize: "14px",
                      backgroundColor: "#fff",
                      height: "40px",
                      boxSizing: "border-box",
                      color: "#495057"
                    }}
                  >
                    {unitOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: "bold", color: "#495057", fontSize: "13px" }}>
                    투약 간격(시간)
                  </label>
                  <input
                    type="number"
                    value={currentCondition.intervalHours}
                    onChange={(e) => handleCurrentConditionChange("intervalHours", e.target.value)}            
                    placeholder="예: 8"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #ced4da",
                      borderRadius: "6px",
                      fontSize: "14px",
                      backgroundColor: "#fff",
                      height: "40px",
                      boxSizing: "border-box",
                      color: "#495057"
                    }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: "bold", color: "#495057", fontSize: "13px" }}>
                    주입시간 (분)
                  </label>
                  <input
                    type="text"
                    value={currentCondition.injectionTime}
                    onChange={(e) => handleCurrentConditionChange("injectionTime", e.target.value)}
                    placeholder="bolus 투여 시 0 입력"
                    disabled={currentCondition.route !== "정맥"}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #ced4da",
                      borderRadius: "6px",
                      fontSize: "14px",
                      backgroundColor: currentCondition.route !== "정맥" ? "#f8f9fa" : "#fff",
                      height: "40px",
                      boxSizing: "border-box",
                      color: "#495057"
                    }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: "bold", color: "#495057", fontSize: "13px" }}>
                    최초 투약 날짜/시간
                  </label>
                  <input
                    type="text"
                    value={currentCondition.firstDoseDate}
                    onChange={e => handleCurrentConditionChange("firstDoseDate", e.target.value)}
                    placeholder="예: 202507251400"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #ced4da",
                      borderRadius: "6px",
                      fontSize: "14px",
                      backgroundColor: "#fff",
                      height: "40px",
                      boxSizing: "border-box",
                      color: "#495057"
                    }}
                    max={todayStr + ' 23:59'}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: "bold", color: "#495057", fontSize: "13px" }}>
                    총 투약 횟수
                  </label>
                  <input
                    type="number"
                    value={currentCondition.totalDoses}
                    onChange={(e) => handleCurrentConditionChange("totalDoses", e.target.value)}
                    placeholder="예: 10"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #ced4da",
                      borderRadius: "6px",
                      fontSize: "14px",
                      backgroundColor: "#fff",
                      height: "40px",
                      boxSizing: "border-box",
                      color: "#495057"
                    }}
                  />
                </div>
              </div>



              {/* 조건 추가/수정 버튼 */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                <button
                  onClick={addOrUpdateCondition}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#eaf0fd",
                    border: "none",
                    color: "#1B44C8",
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: "pointer",
                    padding: "8px 32px",
                    margin: 0,
                    outline: "none",
                    borderRadius: "12px",
                    transition: "background 0.2s, color 0.2s"
                  }}
                  onMouseOver={e => { e.target.style.backgroundColor = "#dbeafe"; }}
                  onMouseOut={e => { e.target.style.backgroundColor = "#eaf0fd"; }}
                >
                  <span style={{ fontSize: 20, marginRight: 6, fontWeight: 600, background: "transparent" }}>
                    {isEditMode ? "✓" : "+"}
                  </span>
                  {isEditMode ? "처방 내역 수정" : "처방 내역 추가"}
                </button>
              </div>
            </div>

            {/* 투약 기록 summary */}
            <div style={{ marginTop: "20px" }}>
              <h3 style={{ marginBottom: "10px", color: "#495057" }}>
                처방 내역 summary
              </h3>
              <div style={{
                border: "1px solid #dee2e6",
                borderRadius: "8px",
                padding: "15px",
                background: "white",
                maxHeight: "200px",
                overflowY: "auto"
              }}>
                {conditions.length === 0 ? (
                  <div style={{ color: "#6c757d", fontStyle: "italic" }}>
                    처방 내역을 추가해주세요.
                  </div>
                ) : (
                  conditions.map((condition, index) => (
                  <div key={condition.id} style={{
                    borderBottom: "1px dashed #eee",
                    paddingBottom: "10px",
                    marginBottom: "10px",
                    fontSize: "13px",
                    color: "#6c757d",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <div>
                      <span style={{ 
                        fontWeight: "bold", 
                        color: "#007bff",
                        marginRight: "10px"
                      }}>
                        기록 {index + 1}:
                      </span>
                      {getConditionSummary(condition)}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => startEditCondition(condition.id)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#17a2b8",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px"
                        }}
                      >
                        수정
                      </button>
                      <button
                        onClick={() => removeCondition(condition.id)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#dc3545",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px"
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  ))
                )}
              </div>
            </div>

            {/* 테이블 생성 버튼 */}
            <button
              onClick={generateTable}
              disabled={conditions.length === 0}
              style={{
                width: "100%",
                padding: "10px 0",
                backgroundColor: isDarkMode ? (conditions.length === 0 ? "#334155" : "#1B44C8") : "#fff",
                color: isDarkMode ? "#fff" : "#1B44C8",
                border: isDarkMode ? "2px solid #1B44C8" : "2px solid #1B44C8",
                borderRadius: "12px",
                fontSize: 18,
                fontWeight: 700,
                cursor: conditions.length === 0 ? "not-allowed" : "pointer",
                marginTop: "20px",
                transition: "background 0.2s, color 0.2s"
              }}
              onMouseOver={e => {
                if (conditions.length > 0) {
                  if (isDarkMode) {
                    e.target.style.backgroundColor = "#274fcf";
                  } else {
                    e.target.style.backgroundColor = "#eaf0fd";
                  }
                }
              }}
              onMouseOut={e => {
                if (conditions.length > 0) {
                  if (isDarkMode) {
                    e.target.style.backgroundColor = "#1B44C8";
                  } else {
                    e.target.style.backgroundColor = "#fff";
                  }
                }
              }}
            >
              처방 내역 입력 완료
            </button>
          </div>

          {/*2 생성된 테이블 */}
          <div style={{ 
            background: isDarkMode ? "#23293a" : "white", 
            padding: "20px",
            borderRadius: "8px",
            border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6"
          }}>
            <h2 style={{ marginBottom: 10, color: isDarkMode ? '#e0e6f0' : '#495057' }}>2단계: 투약 기록을 확인하세요</h2>
            <div style={{ 
              marginBottom: 20, 
              color: isDarkMode ? '#9ca3af' : '#6b7280', 
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              <div style={{ marginBottom: '8px' }}>
                • 투약 기록 정보를 정확히 입력할 수록 분석의 정확도가 높아집니다.
              </div>
              <div>
                • 투약 시간을 선택해서 정확한 시간으로 수정할 수 있습니다.
              </div>
            </div>
              
              <div style={{ overflowX: "auto" }}>
                <table style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6",
                  tableLayout: "fixed",
                  background: isDarkMode ? "#23293a" : "white"
                }}>
                  <tbody>
                  {tableData.length > 0 ? tableData.map((row) => (
                      <tr 
                        key={row.id} 
                        draggable={!row.isTitle}
                        onDragStart={(e) => !row.isTitle && handleDragStart(e, row.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => !row.isTitle && handleDrop(e, row.id)}
                        style={{
                          backgroundColor: row.isTitle ? (isDarkMode ? "#2d3650" : "#e9ecef") : (isDarkMode ? "#23293a" : "white"),
                          fontWeight: row.isTitle ? "bold" : "normal",
                          cursor: row.isTitle ? "default" : "grab",
                          color: isDarkMode ? "#e0e6f0" : undefined
                        }}
                      >
                        {/* 회차 */}
                        <td style={{
                          padding: "12px",
                          border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6",
                          textAlign: "center",
                          width: "12%",
                          color: isDarkMode ? "#e0e6f0" : undefined,
                          background: isDarkMode && row.isTitle ? "#2d3650" : undefined
                        }}>
                          {row.isTitle ? (
                            row.round
                          ) : (
                            <input
                              type="text"
                              value={row.round}
                              onChange={(e) => handleTableEdit(row.id, "round", e.target.value)}
                              style={{
                                border: "none",
                                background: "transparent",
                                textAlign: "center",
                                width: "100%",
                                color: isDarkMode ? "#e0e6f0" : undefined
                              }}
                            />
                          )}
                        </td>
                        {/* 투약 시간 */}
                        <td style={{
                          padding: "12px",
                          border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6",
                          textAlign: "center",
                          width: "25%",
                          color: isDarkMode ? "#e0e6f0" : undefined,
                          background: isDarkMode && row.isTitle ? "#2d3650" : undefined
                        }}>
                          {row.isTitle ? (
                            row.time
                          ) : (
                            <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
                            <div style={{ flex: 1 }}>
                              <TimeInput
                                row={row}
                                onUpdate={handleTableEdit}
                                isDarkMode={isDarkMode}
                              />
                            </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                                <button
                                  type="button"
                                  onClick={() => adjustTime(row.id, 'plus')}
                                  style={{
                                    width: "20px",
                                    height: "14px",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "2px 2px 0 0",
                                    background: isDarkMode ? "#374151" : "#f9fafb",
                                    color: isDarkMode ? "#e0e6f0" : "#374151",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "10px",
                                    fontWeight: "bold",
                                    padding: "0"
                                  }}
                                  onMouseOver={(e) => {
                                    e.target.style.background = isDarkMode ? "#4b5563" : "#e5e7eb";
                                  }}
                                  onMouseOut={(e) => {
                                    e.target.style.background = isDarkMode ? "#374151" : "#f9fafb";
                                  }}
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustTime(row.id, 'minus')}
                                  style={{
                                    width: "20px",
                                    height: "14px",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "0 0 2px 2px",
                                    background: isDarkMode ? "#374151" : "#f9fafb",
                                    color: isDarkMode ? "#e0e6f0" : "#374151",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "10px",
                                    fontWeight: "bold",
                                    padding: "0"
                                  }}
                                  onMouseOver={(e) => {
                                    e.target.style.background = isDarkMode ? "#4b5563" : "#e5e7eb";
                                  }}
                                  onMouseOut={(e) => {
                                    e.target.style.background = isDarkMode ? "#374151" : "#f9fafb";
                                  }}
                                >
                                  ▼
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                        {/* 투약 용량 */}
                        <td style={{
                          padding: "12px",
                          border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6",
                          textAlign: "center",
                          width: "18%",
                          color: isDarkMode ? "#e0e6f0" : undefined,
                          background: isDarkMode && row.isTitle ? "#2d3650" : undefined
                        }}>
                          {row.isTitle ? (
                            row.amount
                          ) : (
                            <input
                              type="text"
                              value={row.amount}
                              onChange={(e) => handleTableEdit(row.id, "amount", e.target.value)}
                              style={{
                                border: "none",
                                background: "transparent",
                                textAlign: "center",
                                width: "100%",
                                color: isDarkMode ? "#e0e6f0" : undefined
                              }}
                            />
                          )}
                        </td>
                        {/* 투약 경로 */}
                        <td style={{
                          padding: "12px",
                          border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6",
                          textAlign: "center",
                          width: "18%",
                          color: isDarkMode ? "#e0e6f0" : undefined,
                          background: isDarkMode && row.isTitle ? "#2d3650" : undefined
                        }}>
                          {row.isTitle ? (
                            row.route
                          ) : (
                            <select
                              value={row.route}
                              onChange={(e) => handleTableEdit(row.id, "route", e.target.value)}
                              style={{
                                border: "none",
                                background: "transparent",
                                textAlign: "center",
                                width: "100%",
                                color: isDarkMode ? "#e0e6f0" : undefined,
                                backgroundColor: isDarkMode ? "#23293a" : undefined
                              }}
                            >
                              {routeOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        {/* 주입 시간 */}
                        <td style={{
                          padding: "12px",
                          border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6",
                          textAlign: "center",
                          width: "18%",
                          color: isDarkMode ? "#e0e6f0" : undefined,
                          background: isDarkMode && row.isTitle ? "#2d3650" : undefined
                        }}>
                          {row.isTitle ? (
                            row.injectionTime
                          ) : (
                            <InjectionTimeInput
                              row={row}
                              onUpdate={handleTableEdit}
                              isDarkMode={isDarkMode}
                            />
                          )}
                        </td>
                        {/* 삭제 체크박스 */}
                        <td style={{
                          padding: "12px",
                          border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6",
                          textAlign: "center",
                          width: "10%",
                          color: isDarkMode ? "#e0e6f0" : undefined,
                          background: isDarkMode && row.isTitle ? "#2d3650" : undefined
                        }}>
                          {row.isTitle ? (
                            "삭제"
                          ) : (
                            <input
                              type="checkbox"
                              checked={selectedRows.has(row.id)}
                              onChange={() => handleRowSelect(row.id)}
                              style={{
                                width: "16px",
                                height: "16px",
                                cursor: "pointer",
                                accentColor: isDarkMode ? "#1B44C8" : undefined
                              }}
                            />
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="6" style={{
                          padding: "40px",
                          textAlign: "center",
                          color: isDarkMode ? "#6b7280" : "#6b7280",
                          fontStyle: "italic"
                        }}>
                          처방 내역을 입력하고 "처방 내역 입력 완료" 버튼을 클릭하여 테이블을 생성하세요.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "15px" }}>
                <button
                  onClick={resetTableData}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#fff",
                    color: "#dc2626",
                    border: "1px solid #fecaca",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: 400,
                    fontSize: "15px",
                    transition: "background 0.2s, color 0.2s"
                  }}
                  onMouseOver={e => { e.target.style.backgroundColor = "#fef2f2"; }}
                  onMouseOut={e => { e.target.style.backgroundColor = "#fff"; }}
                >
                  🗑️ 전체 삭제
                </button>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={addRow}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#fff",
                      color: "#222",
                      border: "1px solid #dee2e6",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: 400,
                      fontSize: "15px",
                      transition: "background 0.2s, color 0.2s"
                    }}
                    onMouseOver={e => { e.target.style.backgroundColor = "#f4f6fa"; }}
                    onMouseOut={e => { e.target.style.backgroundColor = "#fff"; }}
                  >
                    + 행추가
                  </button>
                  
                  <button
                    onClick={deleteSelectedRows}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#fff",
                      color: "#fb7185",
                      border: "1px solid #ffe4e6",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: 400,
                      fontSize: "15px",
                      transition: "background 0.2s, color 0.2s"
                    }}
                    onMouseOver={e => { e.target.style.backgroundColor = "#f4f6fa"; }}
                    onMouseOut={e => { e.target.style.backgroundColor = "#fff"; }}
                  >
                    선택 삭제
                  </button>
                </div>
              </div>
            </div>
        </div>
      </div>
      {/* 에러 모달 */}
      {errorModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.3)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px 32px',
            boxShadow: '0 4px 24px #0002',
            minWidth: '320px',
            textAlign: 'center',
            border: '1.5px solid #222',
            color: '#222',
            fontWeight: 600
          }}>
            <div style={{ fontSize: '17px', marginBottom: '18px', whiteSpace: 'pre-line' }}>
              {`중복된 투약일정이 있습니다.\n투약일시를 다시 확인해주세요.`}
            </div>
            <button
              onClick={() => setErrorModal("")}
              style={{
                background: '#222',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 28px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >확인</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TablePage;