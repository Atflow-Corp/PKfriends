import React, { useState, useEffect, useRef, useCallback } from 'react';
import { savePrescriptionInfo } from '../../lib/tdm';
import DateTimePicker from 'react-datetime-picker';
import 'react-datetime-picker/dist/DateTimePicker.css';
import 'react-calendar/dist/Calendar.css';
import 'react-clock/dist/Clock.css';

// 주입시간 입력 컴포넌트 (포커스 유지를 위한 독립적인 컴포넌트)
const InjectionTimeInput = ({ row, onUpdate, isDarkMode, readOnly = false }) => {
  if (readOnly) {
    return (
      <div
        style={{
          textAlign: "center",
          width: "100%",
          color: isDarkMode ? "#e0e6f0" : undefined,
          minHeight: "24px",
          lineHeight: "24px",
        }}
      >
        {row.injectionTime ?? "-"}
      </div>
    );
  }

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
  
  // localStorage 키 생성
  const getStorageKey = useCallback(() => {
    if (!props.selectedPatient || !props.tdmDrug?.drugName) return null;
    return `tdmfriends:conditions:${props.selectedPatient.id}:${props.tdmDrug.drugName}`;
  }, [props.selectedPatient, props.tdmDrug?.drugName]);

  // localStorage에서 conditions 복원
  const restoreConditionsFromStorage = useCallback(() => {
    const storageKey = getStorageKey();
    if (!storageKey) return null;
    
    try {
      const savedConditions = localStorage.getItem(storageKey);
      if (savedConditions) {
        return JSON.parse(savedConditions);
      }
    } catch (error) {
      console.error('Failed to restore conditions from localStorage:', error);
    }
    return null;
  }, [getStorageKey]);

  // 초기 conditions: localStorage에서 복원하거나 props.initialConditions 사용
  const firstDosePickerRef = useRef(null);

  const [conditions, setConditions] = useState(() => {
    const restored = restoreConditionsFromStorage();
    return restored || props.initialConditions || [];
  });
  
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
  const lastGeneratedConditionsSignatureRef = useRef(null);
  const lastAttemptedConditionsSignatureRef = useRef(null);
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
        injectionTime: "주입시간(분)",
        isTitle: true
      };
      const rows = admins.map((adm, idx) => {
        const timeStr = `${adm.date} ${adm.time}`;
        const dt = new Date(`${adm.date}T${adm.time}`);
        // dosageForm은 adm에 있을 수도 있고, 없을 수도 있음 (DrugAdministration 타입에는 없지만 확장 가능)
        const dosageForm = adm.dosageForm || "";
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
          dosageForm: (adm.route === "경구" || adm.route === "oral") ? dosageForm : "",
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
    const records = tableData.filter(r => !r.isTitle).map(r => {
      // conditionId로 해당 조건 찾기
      const condition = r.conditionId ? conditions.find(c => c.id === r.conditionId) : null;
      return {
        timeStr: r.timeStr,
        amount: r.amount,
        route: r.route,
        injectionTime: r.injectionTime,
        conditionId: r.conditionId,
        intervalHours: condition ? Number(condition.intervalHours) : undefined
      };
    });
    try {
      const json = JSON.stringify(records);
      if (lastRecordsJsonRef.current === json) return;
      lastRecordsJsonRef.current = json;
    } catch {}
    onRecordsChangeRef.current(records);
  }, [tableData, conditions]);

  // 이전 테이블 row 개수와 conditions 총 투약 횟수를 추적 (무한 루프 방지)
  const lastSyncCheckRef = useRef({ tableRowCount: 0, conditionsTotalDoses: 0 });
  
  // 업데이트 필요 여부 추적
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const updateInfoRef = useRef({ tableRowCount: 0, conditionsTotalDoses: 0 });

  // 테이블 row 개수와 처방내역 summary(conditions) 개수 비교 및 업데이트 필요 여부 확인
  useEffect(() => {
    // 테이블이 생성되지 않았거나 conditions가 없으면 스킵
    if (!isTableGenerated || conditions.length === 0) return;
    if (skipPropagateRef.current) return;
    
    const tableRowCount = tableData.filter(r => !r.isTitle).length;
    const conditionsTotalDoses = conditions.reduce((sum, c) => {
      const totalDoses = parseInt(c.totalDoses) || 0;
      return sum + totalDoses;
    }, 0);
    
    const countsAreSame = 
      lastSyncCheckRef.current.tableRowCount === tableRowCount &&
      lastSyncCheckRef.current.conditionsTotalDoses === conditionsTotalDoses;
    
    if (countsAreSame) {
      if (needsUpdate && tableRowCount === conditionsTotalDoses) {
        setNeedsUpdate(false);
      }
      return;
    }
    
    lastSyncCheckRef.current = {
      tableRowCount,
      conditionsTotalDoses
    };
    
    if (tableRowCount !== conditionsTotalDoses && tableRowCount > 0) {
      setNeedsUpdate(true);
      updateInfoRef.current = {
        tableRowCount,
        conditionsTotalDoses
      };
    } else {
      setNeedsUpdate(false);
    }
  }, [tableData, conditions, isTableGenerated, needsUpdate]);

  // 처방 내역 Summary 업데이트 함수 (외부에서 호출)
  const performUpdate = useCallback(() => {
    if (!needsUpdate) return false;
    
    const tableRowCount = updateInfoRef.current.tableRowCount;
    const conditionsTotalDoses = updateInfoRef.current.conditionsTotalDoses;
    
    // 테이블 데이터를 기반으로 conditions 업데이트
    const updatedConditions = updateConditionsFromTableData(tableData, conditions);
    
    if (updatedConditions && updatedConditions.length > 0) {
      // 업데이트 전에 플래그 설정하여 무한 루프 방지
      skipPropagateRef.current = true;
      setConditions(updatedConditions);
      
      // 이전 값 업데이트
      lastSyncCheckRef.current = {
        tableRowCount: tableRowCount,
        conditionsTotalDoses: updatedConditions.reduce((sum, c) => sum + (parseInt(c.totalDoses) || 0), 0)
      };
      
      // 다음 틱에서 플래그 해제
      setTimeout(() => { skipPropagateRef.current = false; }, 0);
      
      // 업데이트 필요 플래그 해제
      setNeedsUpdate(false);
      
      // 시계열상 가장 최근 투약 기록의 정보로 savePrescriptionInfo 업데이트
      if (props.selectedPatient && props.tdmDrug) {
        const sortedRows = tableData
          .filter(r => !r.isTitle && r.timeStr)
          .sort((a, b) => {
            const dateA = new Date(a.timeStr);
            const dateB = new Date(b.timeStr);
            return dateB.getTime() - dateA.getTime();
          });
        
        if (sortedRows.length > 0) {
          const latestRow = sortedRows[0];
          const latestCondition = updatedConditions.find(c => {
            // latestRow의 시간이 해당 condition의 범위 내에 있는지 확인
            if (!c.firstDoseDate || !c.firstDoseTime) return false;
            const conditionStart = new Date(`${c.firstDoseDate}T${c.firstDoseTime}`);
            const interval = parseInt(c.intervalHours) || 12;
            const totalDoses = parseInt(c.totalDoses) || 1;
            const conditionEnd = new Date(conditionStart.getTime() + (totalDoses - 1) * interval * 60 * 60 * 1000);
            const rowTime = new Date(latestRow.timeStr);
            return rowTime >= conditionStart && rowTime <= conditionEnd;
          }) || updatedConditions[updatedConditions.length - 1];
          
          if (latestCondition) {
            const routeKorean = convertRouteToKorean(latestCondition.route);
            const cmt = routeKorean === "정맥" ? 1 : 2;
            
            savePrescriptionInfo(
              props.selectedPatient.id,
              props.tdmDrug.drugName,
              {
                amount: parseFloat(latestCondition.dosage) || 0,
                tau: parseFloat(latestCondition.intervalHours) || 12,
                cmt: cmt,
                route: routeKorean,
                infusionTime: parseFloat(latestCondition.injectionTime) || undefined
              }
            );
          }
        }
      }
      
      return true;
    }
    
    return false;
  }, [needsUpdate, tableData, conditions, props.selectedPatient, props.tdmDrug]);

  // 업데이트 필요 여부 및 정보를 외부에 노출
  useEffect(() => {
    if (props.onUpdateNeeded) {
      props.onUpdateNeeded(needsUpdate, updateInfoRef.current, performUpdate);
    }
  }, [needsUpdate, performUpdate, props.onUpdateNeeded]);

  // 테이블 데이터를 기반으로 conditions 업데이트하는 함수
  const updateConditionsFromTableData = (tableData, existingConditions) => {
    const rows = tableData.filter(r => !r.isTitle && r.timeStr);
    if (rows.length === 0) return existingConditions;
    
    const tableRowCount = rows.length;
    const conditionsTotalDoses = existingConditions.reduce((sum, c) => {
      const totalDoses = parseInt(c.totalDoses) || 0;
      return sum + totalDoses;
    }, 0);
    
    // conditions를 시간순으로 정렬
    const sortedConditions = [...existingConditions].sort((a, b) => {
      if (!a.firstDoseDate || !a.firstDoseTime || !b.firstDoseDate || !b.firstDoseTime) return 0;
      const dateA = new Date(`${a.firstDoseDate}T${a.firstDoseTime}`);
      const dateB = new Date(`${b.firstDoseDate}T${b.firstDoseTime}`);
      return dateA.getTime() - dateB.getTime();
    });
    
    // 시간순으로 정렬된 rows
    const sortedRows = [...rows].sort((a, b) => {
      const dateA = new Date(a.timeStr);
      const dateB = new Date(b.timeStr);
      return dateA.getTime() - dateB.getTime();
    });
    
    // 각 condition에 속하는 row 개수를 계산하여 totalDoses 업데이트
    const updatedConditions = sortedConditions.map((condition) => {
      if (!condition.firstDoseDate || !condition.firstDoseTime) return condition;
      
      const conditionStart = new Date(`${condition.firstDoseDate}T${condition.firstDoseTime}`);
      const interval = parseInt(condition.intervalHours) || 12;
      const originalTotalDoses = parseInt(condition.totalDoses) || 1;
      const conditionEnd = new Date(conditionStart.getTime() + (originalTotalDoses - 1) * interval * 60 * 60 * 1000);
      
      // 이 condition 범위에 속하는 row 개수 계산 (시간 범위 내)
      const rowsInCondition = sortedRows.filter(row => {
        const rowTime = new Date(row.timeStr);
        return rowTime >= conditionStart && rowTime <= conditionEnd;
      }).length;
      
      // row 개수가 있으면 totalDoses 업데이트
      if (rowsInCondition > 0) {
        return {
          ...condition,
          totalDoses: String(rowsInCondition)
        };
      }
      
      return condition;
    });
    
    // 전체 row 개수와 conditions의 총 투약 횟수가 여전히 다르면
    // 마지막 condition의 totalDoses를 조정
    const updatedTotalDoses = updatedConditions.reduce((sum, c) => sum + (parseInt(c.totalDoses) || 0), 0);
    const difference = tableRowCount - updatedTotalDoses;
    
    if (difference !== 0 && updatedConditions.length > 0) {
      const lastCondition = updatedConditions[updatedConditions.length - 1];
      const lastConditionDoses = parseInt(lastCondition.totalDoses) || 0;
      const newTotalDoses = Math.max(1, lastConditionDoses + difference);
      
      updatedConditions[updatedConditions.length - 1] = {
        ...lastCondition,
        totalDoses: String(newTotalDoses)
      };
    }
    
    return updatedConditions;
  };

  // selectedPatient나 tdmDrug가 변경될 때 localStorage에서 conditions 복원
  // 의존성에서 restoreConditionsFromStorage와 props.initialConditions 제거하여 무한 루프 방지
  useEffect(() => {
    const storageKey = getStorageKey();
    if (!storageKey) {
      // storageKey가 없으면 초기화
      if (props.initialConditions && props.initialConditions.length > 0) {
        setConditions(props.initialConditions);
      } else {
        setConditions([]);
      }
      return;
    }
    
    try {
      const savedConditions = localStorage.getItem(storageKey);
      if (savedConditions) {
        const parsed = JSON.parse(savedConditions);
        if (parsed && parsed.length > 0) {
          setConditions(parsed);
          return;
        }
      }
    } catch (error) {
      console.error('Failed to restore conditions from localStorage:', error);
    }
    
    // localStorage에 없고 props.initialConditions가 있으면 사용
    if (props.initialConditions && props.initialConditions.length > 0) {
      setConditions(props.initialConditions);
    }
  }, [props.selectedPatient?.id, props.tdmDrug?.drugName, getStorageKey]);

  // conditions 변경 시 localStorage에 저장
  // 단, 현재 localStorage의 값과 동일하면 저장하지 않아 무한 루프 방지
  useEffect(() => {
    const storageKey = getStorageKey();
    if (!storageKey) return;
    
    try {
      const currentSaved = localStorage.getItem(storageKey);
      const currentSavedParsed = currentSaved ? JSON.parse(currentSaved) : null;
      const conditionsJson = JSON.stringify(conditions);
      
      // 현재 저장된 값과 동일하면 저장하지 않음 (무한 루프 방지)
      if (currentSavedParsed && JSON.stringify(currentSavedParsed) === conditionsJson) {
        return;
      }
      
      localStorage.setItem(storageKey, conditionsJson);
    } catch (error) {
      console.error('Failed to save conditions to localStorage:', error);
    }
  }, [conditions, getStorageKey]);

  // Propagate conditions changes to parent
  useEffect(() => {
    if (!onConditionsChangeRef.current) return;
    onConditionsChangeRef.current(conditions);
  }, [conditions]);

  // 초기 로드 완료 후 isInitialLoad를 false로 설정
  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [isInitialLoad]);


  // props가 변경될 때 state 업데이트
  // 단, localStorage에 저장된 값이 있으면 우선 사용
  // 이 useEffect는 props.initialConditions가 변경될 때만 실행되지만,
  // localStorage에 저장된 값이 있으면 무시 (무한 루프 방지)
  useEffect(() => {
    let changed = false;
    // localStorage에서 복원된 값이 없을 때만 props.initialConditions 사용
    const storageKey = getStorageKey();
    if (storageKey) {
      try {
        const savedConditions = localStorage.getItem(storageKey);
        if (savedConditions) {
          const parsed = JSON.parse(savedConditions);
          if (parsed && parsed.length > 0) {
            // localStorage에 저장된 값이 있으면 props.initialConditions 무시
            return;
          }
        }
      } catch (error) {
        console.error('Failed to check localStorage:', error);
      }
    }
    
    // localStorage에 없고 props.initialConditions가 있으면 사용
    if (props.initialConditions && props.initialConditions.length > 0) {
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
  // 반코마이신(Vancomycin)의 경우 경구 옵션 비활성화 (현재 사용 가능한 모델이 모두 정맥 투약 모델)
  // 피하(SC)는 모델링에서 사용하지 않으므로 임시 비노출 처리
  const isVancomycin = props.tdmDrug?.drugName?.toLowerCase() === "vancomycin";
  const routeOptions = [
    { value: "경구", label: "경구 (oral)", disabled: isVancomycin },
    { value: "정맥", label: "정맥 (IV)" }
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
    
    // 약물명
    const drugName = props.tdmDrug?.drugName || "약물";
    
    // 용량과 단위
    const unitText = condition.unit ? condition.unit : "mg";
    const dosageText = condition.dosage ? `${condition.dosage} ${unitText}` : `0 ${unitText}`;
    
    // 투약 경로 변환 (경구 -> PO, 정맥 -> IV)
    let routeText = "";
    if (condition.route === "경구" || condition.route === "oral") {
      routeText = "PO";
      // 경구 투약이고 dosageForm이 있는 경우 함께 표시
      if (condition.dosageForm) {
        const formLabel = condition.dosageForm === "capsule/tablet" ? "Cap/Tab" : 
                         condition.dosageForm === "oral liquid" ? "현탁/액제" : 
                         condition.dosageForm;
        routeText = `PO (${formLabel})`;
      }
    } else if (condition.route === "정맥" || condition.route === "IV") {
      routeText = "IV";
      // 정맥 투약이고 주입시간이 있는 경우 함께 표시
      if (condition.injectionTime && condition.injectionTime !== "-" && condition.injectionTime !== "") {
        routeText = `IV (${condition.injectionTime}분 주입)`;
      }
    } else {
      routeText = condition.route || "-";
    }
    
    // 간격 (12h 간격 형식)
    const intervalText = condition.intervalHours ? `${condition.intervalHours}h 간격` : "간격 정보 없음";
    
    // 총 횟수
    const dosesText = condition.totalDoses ? `총 ${condition.totalDoses}회` : "횟수 정보 없음";
    
    // 시작 날짜/시간
    const startDate = condition.firstDoseDate || "날짜 정보 없음";
    const startTime = condition.firstDoseTime || "";
    const startDateTime = `${startDate} ${startTime}`;

    // 형식: 약물명 용량 단위 | 투약경로 (제형정보 또는 주입시간) | 간격 | 총 횟수 (시작: 날짜 시간)
    return `${drugName} ${dosageText} | ${routeText} | ${intervalText} | ${dosesText} (시작: ${startDateTime})`.trim();
  };

  const isConditionComplete = (condition) => {
    if (
      !condition.route ||
      !condition.dosage ||
      !condition.unit ||
      !condition.intervalHours ||
      !condition.firstDoseDate ||
      !condition.firstDoseTime ||
      !condition.totalDoses
    ) {
      return false;
    }

    if (condition.route === "정맥" || condition.route === "IV") {
      const injectionTime = (condition.injectionTime ?? "").toString().trim();
      if (!injectionTime || injectionTime === "-" ) {
        return false;
      }
    }

    return true;
  };

  const buildConditionsSignature = (conditionList) => {
    const normalized = conditionList.map(condition => ({
      id: String(condition.id ?? ""),
      route: condition.route ?? "",
      dosage: condition.dosage ?? "",
      unit: condition.unit ?? "",
      intervalHours: condition.intervalHours ?? "",
      injectionTime: (condition.route === "정맥" || condition.route === "IV") ? (condition.injectionTime ?? "") : "",
      firstDoseDate: condition.firstDoseDate ?? "",
      firstDoseTime: condition.firstDoseTime ?? "",
      totalDoses: condition.totalDoses ?? ""
    }));

    normalized.sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify(normalized);
  };

  // 현재 조건 입력값 변경 처리
  const focusDateTimePickerInput = (ref) => {
    if (!ref?.current) return;
    const input = ref.current.querySelector("input");
    if (input) {
      input.focus();
    }
  };

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

  const handleFirstDoseDateTimeChange = (value) => {
    if (!value) {
      setCurrentCondition(prev => ({
        ...prev,
        firstDoseDate: "",
        firstDoseTime: ""
      }));
      return;
    }

    // DateTimePicker는 Date 객체를 반환
    const dateObj = value instanceof Date ? value : new Date(value);
    if (isNaN(dateObj.getTime())) {
      return;
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    const datePart = `${year}-${month}-${day}`;
    const timePart = `${hours}:${minutes}`;

    setCurrentCondition(prev => ({
      ...prev,
      firstDoseDate: datePart,
      firstDoseTime: timePart
    }));
  };

  // 조건 추가 또는 수정
  const addOrUpdateCondition = () => {
    // 1. 투약 경로 검증
    if (!currentCondition.route || currentCondition.route.trim() === "") {
      alert("투약 경로를 선택해주세요.");
      return;
    }

    // 2. 투약 용량 검증
    if (!currentCondition.dosage || currentCondition.dosage.trim() === "") {
      alert("투약 용량을 입력해주세요.");
      return;
    }
    const dosageNum = parseFloat(currentCondition.dosage);
    if (isNaN(dosageNum) || dosageNum <= 0) {
      alert("투약 용량은 0보다 큰 숫자로 입력해주세요.");
      return;
    }

    // 3. 단위 검증
    if (!currentCondition.unit || currentCondition.unit.trim() === "") {
      alert("단위를 선택해주세요.");
      return;
    }

    // 4. 투약 간격 검증
    if (!currentCondition.intervalHours || currentCondition.intervalHours.trim() === "") {
      alert("투약 간격(시간)을 입력해주세요.");
      return;
    }
    const intervalNum = parseFloat(currentCondition.intervalHours);
    if (isNaN(intervalNum) || intervalNum <= 0) {
      alert("투약 간격은 0보다 큰 숫자로 입력해주세요.");
      return;
    }

    // 5. 총 투약 횟수 검증
    if (!currentCondition.totalDoses || currentCondition.totalDoses.trim() === "") {
      alert("총 투약 횟수를 입력해주세요.");
      return;
    }
    const totalDosesNum = parseInt(currentCondition.totalDoses);
    if (isNaN(totalDosesNum) || totalDosesNum <= 0) {
      alert("총 투약 횟수는 1 이상의 정수로 입력해주세요.");
      return;
    }

    // 6. 최초 투약 날짜/시간 검증
    const datePart = (currentCondition.firstDoseDate || "").trim();
    const timePart = (currentCondition.firstDoseTime || "").trim();

    if (!datePart || !timePart) {
      alert("최초 투약 날짜와 시간을 모두 입력해주세요.");
      return;
    }

    const combinedDateTime = `${datePart}T${timePart}`;
    const selectedDate = new Date(combinedDateTime);

    if (Number.isNaN(selectedDate.getTime())) {
      alert("날짜와 시간 형식이 올바르지 않습니다.");
      return;
    }

    if (selectedDate > new Date()) {
      alert("투약 날짜/시간은 현재 시각 이후로 입력할 수 없습니다.");
      return;
    }

    const normalizedCondition = {
      ...currentCondition,
      firstDoseDate: datePart,
      firstDoseTime: timePart
    };

    // 7. 정맥 투약 경로일 때 주입시간 필수 입력 검증
    if (normalizedCondition.route === "정맥" || normalizedCondition.route === "IV") {
      const injectionTime = normalizedCondition.injectionTime?.trim();
      if (!injectionTime || injectionTime === "" || injectionTime === "-") {
        alert("정맥 투약 경로를 선택하셨습니다. 주입시간(분)을 반드시 입력해주세요.\n\nbolus 투여 시에는 0을 입력해주세요.");
        return;
      }
      // 숫자로 변환 가능한지 확인
      const injectionTimeNum = parseFloat(injectionTime);
      if (isNaN(injectionTimeNum) || injectionTimeNum < 0) {
        alert("주입시간은 0 이상의 숫자로 입력해주세요.\n\nbolus 투여 시에는 0을 입력해주세요.");
        return;
      }
    }

    // 8. 경구 투약 경로일 때 제형정보 필수 입력 검증 (Cyclosporin인 경우)
    if ((normalizedCondition.route === "경구" || normalizedCondition.route === "oral") && 
        (props.tdmDrug?.drugName?.toLowerCase() === "cyclosporin" || props.tdmDrug?.drugName?.toLowerCase() === "cyclosporine")) {
      const dosageForm = normalizedCondition.dosageForm?.trim();
      if (!dosageForm || dosageForm === "") {
        alert("경구 투약 경로를 선택하셨습니다. 제형정보를 반드시 선택해주세요.");
        return;
      }
    }

    if (isEditMode) {
      // 수정 모드: 기존 조건 업데이트
      setConditions(prev => 
        prev.map(condition => 
          condition.id === editingConditionId 
            ? { ...normalizedCondition, id: editingConditionId }
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
        ...normalizedCondition
      };

      setConditions(prev => [...prev, newCondition]);
    }

    // 처방 내역 저장은 테이블 생성 시에만 수행
    // (시계열상 가장 최근 투약 기록의 정보를 저장하기 위해)
    // 조건 추가/수정 시에는 저장하지 않음

    // 현재 조건 초기화
    setCurrentCondition({
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
  };

  // 조건 삭제
  const removeCondition = (conditionId, conditionIndex) => {
    // 삭제 확인 얼럿
    const confirmed = window.confirm(
      `처방 내역 summary 중 기록 ${conditionIndex + 1}을 삭제하시겠습니까?\n기록을 삭제하면 전체 투약 기록 데이터에서도 삭제됩니다.`
    );
    
    if (!confirmed) {
      return;
    }

    // 삭제 전 conditions 개수 확인
    const willBeEmpty = conditions.length === 1;

    setConditions(prev => prev.filter(c => c.id !== conditionId));

    let removedRowIds = [];
    let hasRemainingRows = false;

    setTableData(prev => {
      if (!prev || prev.length === 0) return prev;

      // 기록이 1개일 때 삭제하면 모든 테이블 데이터 삭제
      if (willBeEmpty) {
        removedRowIds = prev.filter(row => !row.isTitle).map(row => row.id);
        return []; // title row도 포함하여 모든 데이터 삭제
      }

      const filtered = prev.filter(row => {
        const shouldRemove = !row.isTitle && row.conditionId === conditionId;
        if (shouldRemove) {
          removedRowIds.push(row.id);
        }
        return row.isTitle || row.conditionId !== conditionId;
      });

      const titleRow = filtered.find(row => row.isTitle);
      const doseRows = filtered
        .filter(row => !row.isTitle)
        .map((row, index) => ({
          ...row,
          round: `${index + 1} 회차`
        }));

      hasRemainingRows = doseRows.length > 0;

      return titleRow ? [titleRow, ...doseRows] : doseRows;
    });

    if (willBeEmpty || !hasRemainingRows) {
      setIsTableGenerated(false);
    }

    if (removedRowIds.length > 0) {
      setSelectedRows(prev => {
        const newSet = new Set(prev);
        removedRowIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

  // 조건 수정 모드 시작
  const startEditCondition = (conditionId) => {
    const conditionToEdit = conditions.find(c => c.id === conditionId);
    if (conditionToEdit) {
      // 조건 입력창에 해당 조건 로드
      setCurrentCondition({
        route: conditionToEdit.route,
        dosage: conditionToEdit.dosage,
        unit: conditionToEdit.unit,
        intervalHours: conditionToEdit.intervalHours,
        injectionTime: conditionToEdit.injectionTime,
        dosageForm: conditionToEdit.dosageForm || "",
        firstDoseDate: conditionToEdit.firstDoseDate,
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
      return false;
    }

    // 모든 조건이 유효한지 확인
    for (let condition of conditions) {
      if (!condition.totalDoses || !condition.intervalHours || 
          !condition.firstDoseDate || !condition.firstDoseTime || !condition.dosage || !condition.route || !condition.unit) {
        alert("모든 필드를 입력해주세요!");
        return false;
      }
      
      // 정맥 투약 경로일 때 주입시간 필수 입력 검증
      if (condition.route === "정맥" || condition.route === "IV") {
        const injectionTime = condition.injectionTime?.trim();
        if (!injectionTime || injectionTime === "" || injectionTime === "-") {
          alert("정맥 투약 경로를 선택한 조건이 있습니다. 주입시간(분)을 반드시 입력해주세요.\n\nbolus 투여 시에는 0을 입력해주세요.");
          return false;
        }
        // 숫자로 변환 가능한지 확인
        const injectionTimeNum = parseFloat(injectionTime);
        if (isNaN(injectionTimeNum) || injectionTimeNum < 0) {
          alert("주입시간은 0 이상의 숫자로 입력해주세요.\n\nbolus 투여 시에는 0을 입력해주세요.");
          return false;
        }
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
          return false;
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
      const dosageForm = condition.dosageForm;
      
      for (let i = 0; i < totalDoses; i++) {
        const doseTime = new Date(firstDose.getTime() + (i * interval * 60 * 60 * 1000));
        const rowDosageForm = (route === "경구" || route === "oral") ? (dosageForm || "") : "";
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
          dosageForm: rowDosageForm,
          isTitle: false
        });
      }
    });
    // 중복 투약일시 검사
    const timeSet = new Set();
    for (const dose of allDoses) {
      if (timeSet.has(dose.timeStr)) {
        alert("중복된 투약일정이 있습니다. 투약일시를 다시 확인해주세요.");
        return false;
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

    // 시계열상 가장 최근 투약 기록의 intervalHours 찾기
    if (allDoses.length > 0 && props.selectedPatient && props.tdmDrug) {
      const latestDose = allDoses[allDoses.length - 1]; // 정렬된 마지막 요소 = 가장 최근
      const latestCondition = conditions.find(c => c.id === latestDose.conditionId);
      
      if (latestCondition) {
        const routeKorean = convertRouteToKorean(latestCondition.route);
        const cmt = routeKorean === "정맥" ? 1 : 2;
        
        // 시계열상 가장 최근 투약 기록의 정보로 저장
        savePrescriptionInfo(
          props.selectedPatient.id,
          props.tdmDrug.drugName,
          {
            amount: parseFloat(latestCondition.dosage) || 0,
            tau: parseFloat(latestCondition.intervalHours) || 12, // 시계열상 최근 투약 기록의 intervalHours
            cmt: cmt,
            route: routeKorean,
            infusionTime: parseFloat(latestCondition.injectionTime) || undefined
          }
        );
      }
    }

    setTableData(newTableData);
    setIsTableGenerated(true);
    if (props.onTableGenerated) props.onTableGenerated();
    setSelectedRows(new Set()); // 선택 상태 초기화
    
    // 초기 로드가 아닐 때만 onSaveRecords 호출 (중복 저장 방지)
    if (props.onSaveRecords && !isInitialLoad) {
      // title row 제외, 실제 투약기록만 전달
      // 각 기록의 conditionId와 intervalHours 포함
      const records = newTableData.filter(row => !row.isTitle).map(row => {
        // conditionId로 해당 조건 찾기
        const condition = conditions.find(c => c.id === row.conditionId);
        return {
          timeStr: row.timeStr,
          amount: row.amount,
          route: row.route,
          injectionTime: row.injectionTime,
          conditionId: row.conditionId,
          intervalHours: condition ? Number(condition.intervalHours) : undefined
        };
      });
      props.onSaveRecords(records);
    }

    return true;
  };

  useEffect(() => {
    if (conditions.length === 0) {
      lastGeneratedConditionsSignatureRef.current = null;
      lastAttemptedConditionsSignatureRef.current = null;
      return;
    }

    const hasIncomplete = conditions.some(condition => !isConditionComplete(condition));
    if (hasIncomplete) return;

    const signature = buildConditionsSignature(conditions);
    if (signature === lastGeneratedConditionsSignatureRef.current) {
      return;
    }

    if (
      signature === lastAttemptedConditionsSignatureRef.current &&
      signature !== lastGeneratedConditionsSignatureRef.current
    ) {
      return;
    }

    lastAttemptedConditionsSignatureRef.current = signature;
    const success = generateTable();
    if (success) {
      lastGeneratedConditionsSignatureRef.current = signature;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditions]);

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
            // 반코마이신 경구 선택 시 경고 및 차단
            const isVancomycin = props.tdmDrug?.drugName?.toLowerCase() === "vancomycin";
            if (isVancomycin && (value === "경구" || value === "oral")) {
              alert("반코마이신은 현재 정맥 투약 모델만 지원합니다.\n정맥 투약 경로를 선택해주세요.");
              return row; // 변경하지 않고 원래 행 유지
            }
            
            // 투약용량 자동 설정 제거 - 사용자가 직접 입력하도록 함
            
            // 정맥으로 변경 시 주입시간을 빈 값으로 설정 (사용자가 반드시 입력하도록)
            if (value === "정맥" || value === "IV") {
              // 주입시간이 없거나 "-"인 경우에만 빈 값으로 설정
              if (!updatedRow.injectionTime || updatedRow.injectionTime === "-") {
                updatedRow.injectionTime = "";
              }
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
    
    // 최근 처방내역 summary(conditions)에서 가장 최근 condition 찾기
    const latestCondition = conditions.length > 0
      ? [...conditions].sort((a, b) => {
          // firstDoseDate와 firstDoseTime 기준으로 정렬
          if (!a.firstDoseDate || !a.firstDoseTime || !b.firstDoseDate || !b.firstDoseTime) return 0;
          const dateA = new Date(`${a.firstDoseDate}T${a.firstDoseTime}`);
          const dateB = new Date(`${b.firstDoseDate}T${b.firstDoseTime}`);
          return dateB.getTime() - dateA.getTime(); // 최신순 정렬
        })[0]
      : null;
    
    let nextDateTime;
    let defaultInterval = 12; // 기본 간격
    
    if (lastDoseRow && lastDoseRow.timeStr) {
      // 마지막 투약 시간에서 intervalHours 후로 계산
      if (latestCondition && latestCondition.intervalHours) {
        defaultInterval = parseInt(latestCondition.intervalHours) || 12;
      }
      const lastDateTime = new Date(lastDoseRow.timeStr);
      nextDateTime = new Date(lastDateTime.getTime() + defaultInterval * 60 * 60 * 1000);
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
    } else if (latestCondition && latestCondition.dosage && latestCondition.unit) {
      // conditions에서 용량 정보 가져오기
      defaultAmount = `${latestCondition.dosage} ${latestCondition.unit}`;
    }
    
    // 최근 처방내역에서 투약 경로 가져오기
    let defaultRoute = "경구"; // 기본값
    if (latestCondition && latestCondition.route) {
      defaultRoute = convertRouteToKorean(latestCondition.route);
    } else {
      // 기존 투약 기록에서 가장 많이 사용된 투약 경로 찾기
      const existingRoutes = tableData
        .filter(row => !row.isTitle && row.route)
        .map(row => row.route);
      
      if (existingRoutes.length > 0) {
        const routeCounts = {};
        existingRoutes.forEach(route => {
          routeCounts[route] = (routeCounts[route] || 0) + 1;
        });
        const mostCommonRoute = Object.keys(routeCounts).reduce((a, b) => 
          routeCounts[a] > routeCounts[b] ? a : b
        );
        defaultRoute = mostCommonRoute;
      }
    }
    
    // 최근 처방내역에서 주입시간 가져오기 (정맥인 경우)
    let defaultInjectionTime = "-";
    if (defaultRoute === "정맥") {
      if (latestCondition && latestCondition.injectionTime) {
        defaultInjectionTime = String(latestCondition.injectionTime);
      } else {
        // 기존 투약 기록에서 정맥 투약의 주입시간 찾기
        const existingInjectionTimes = tableData
          .filter(row => !row.isTitle && row.route === "정맥" && row.injectionTime && row.injectionTime !== "-")
          .map(row => row.injectionTime);
        
        if (existingInjectionTimes.length > 0) {
          const injectionTimeCounts = {};
          existingInjectionTimes.forEach(time => {
            injectionTimeCounts[time] = (injectionTimeCounts[time] || 0) + 1;
          });
          const mostCommonInjectionTime = Object.keys(injectionTimeCounts).reduce((a, b) => 
            injectionTimeCounts[a] > injectionTimeCounts[b] ? a : b
          );
          defaultInjectionTime = mostCommonInjectionTime;
        }
      }
    }
    
    // 최근 처방내역에서 dosageForm 가져오기 (경구인 경우)
    let defaultDosageForm = "";
    if (defaultRoute === "경구" || defaultRoute === "oral") {
      if (latestCondition && latestCondition.dosageForm) {
        defaultDosageForm = latestCondition.dosageForm;
      } else {
        // 기존 투약 기록에서 경구 투약의 dosageForm 찾기
        const existingDosageForms = tableData
          .filter(row => !row.isTitle && (row.route === "경구" || row.route === "oral") && row.dosageForm)
          .map(row => row.dosageForm);
        
        if (existingDosageForms.length > 0) {
          const dosageFormCounts = {};
          existingDosageForms.forEach(form => {
            dosageFormCounts[form] = (dosageFormCounts[form] || 0) + 1;
          });
          const mostCommonDosageForm = Object.keys(dosageFormCounts).reduce((a, b) => 
            dosageFormCounts[a] > dosageFormCounts[b] ? a : b
          );
          defaultDosageForm = mostCommonDosageForm;
        }
      }
    }
    
    const newRow = {
      id: String(newId),
      round: `${newId}회차`,
      date: nextDate,
      time: nextTime,
      timeStr: `${nextDate} ${nextTime}`,
      amount: defaultAmount,
      route: defaultRoute,
      injectionTime: defaultInjectionTime,
      dosageForm: defaultDosageForm,
      isTitle: false,
      conditionId: latestCondition?.id || null
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

  const resetTableData = () => {
    if (
      window.confirm(
        "투약 기록 테이블과 처방 내역 summary를 모두 삭제하시겠습니까?"
      )
    ) {
      setTableData([]);
      setConditions([]);
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

      const storageKey = getStorageKey();
      if (storageKey) {
        try {
          localStorage.removeItem(storageKey);
        } catch (error) {
          console.error("Failed to remove conditions from localStorage:", error);
        }
      }
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
        color: isDarkMode ? "#e0e6f0" : "#333"
      }}
    >
      <div style={{ width: "100%", margin: 0, padding: "0 0 40px 0" }}>
        <div>
          {/* 이하 기존 테이블 입력 UI 코드 유지 */}
          {/* 1단계: 개선된 조건 입력 UI */}
          <div style={{
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "30px",
            border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6"
          }}>
            <h1 style={{ 
              marginBottom: 20, 
              color: isDarkMode ? "#e0e6f0" : "#111827",
              fontSize: "24px",
              fontWeight: 700,
              letterSpacing: "-0.02em"
            }}>
              STEP 1: 처방 내역을 입력하세요
            </h1>
            <div style={{ 
              marginBottom: 20, 
              color: isDarkMode ? '#9ca3af' : '#6b7280', 
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              <div style={{ marginBottom: '8px' }}>
                • 처방 내역을 입력하면 하단에 ‘상세 투약 기록’ 테이블이 자동으로 생성됩니다.
              </div>
              <div style={{ marginBottom: '8px' }}>
                • 처방 내역 변경이 있었다면 실제 처방에 일치하도록 새로운 처방 내역을 입력해야 합니다. (예: 1월 4일은 경구 투약, 1월 5일부터는 정맥 주입한 경우 처방 내역을 2개 등록)
                </div>
              <div>
                • Vancomycin은 현재 정맥(IV) 투약 모델만 지원됩니다. 
                </div>
            </div>

                       {/* 현재 조건 입력 박스 */}
            <div style={{
              padding: "20px",
              marginBottom: "20px",
              borderRadius: "8px",
              background: isDarkMode ? "#23293a" : "white"
            }}>
              
              {/* 1행: 모든 항목을 한 줄에 배치 (새로운 순서) */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", marginBottom: "15px", alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 120px", minWidth: "100px", maxWidth: "100%" }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: "bold", color: isDarkMode ? "#e0e6f0" : "#495057", fontSize: "13px" }}>
                    투약 경로
                  </label>
                  <select
                    value={currentCondition.route}
                    onChange={(e) => handleCurrentConditionChange("route", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: isDarkMode ? "1px solid #334155" : "1px solid #ced4da",
                      borderRadius: "6px",
                      fontSize: "14px",
                      backgroundColor: isDarkMode ? "#1e293b" : "#fff",
                      height: "40px",
                      boxSizing: "border-box",
                      color: isDarkMode ? "#e0e6f0" : "#495057"
                    }}
                  >
                    <option value="">투약 경로 선택</option>
                    {routeOptions.map(option => (
                      <option 
                        key={option.value} 
                        value={option.value}
                        disabled={option.disabled}
                        style={{
                          backgroundColor: option.disabled 
                            ? (isDarkMode ? "#374151" : "#e5e7eb") 
                            : (isDarkMode ? "#1e293b" : "#fff"),
                          color: option.disabled 
                            ? (isDarkMode ? "#6b7280" : "#9ca3af") 
                            : (isDarkMode ? "#e0e6f0" : "#495057")
                        }}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

            {props.tdmDrug?.drugName && (props.tdmDrug.drugName.toLowerCase() === "cyclosporin" || props.tdmDrug.drugName.toLowerCase() === "cyclosporine") && (currentCondition.route === "경구" || currentCondition.route === "oral") && (
              <div style={{ flex: "1 1 120px", minWidth: "100px", maxWidth: "100%" }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: "bold", color: isDarkMode ? "#e0e6f0" : "#495057", fontSize: "13px" }}>
                  제형
                </label>
                <select
                  value={currentCondition.dosageForm}
                  onChange={(e) => handleCurrentConditionChange("dosageForm", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: isDarkMode ? "1px solid #334155" : "1px solid #ced4da",
                    borderRadius: "6px",
                    fontSize: "14px",
                    backgroundColor: isDarkMode ? "#1e293b" : "#fff",
                    height: "40px",
                    boxSizing: "border-box",
                    color: isDarkMode ? "#e0e6f0" : "#495057"
                  }}
                >
                  <option value="">제형 선택</option>
                  <option value="capsule/tablet">캡슐/정제</option>
                  <option value="oral liquid">현탁/액제</option>
                </select>
              </div>
            )}

                <div style={{ flex: "1 1 120px", minWidth: "100px", maxWidth: "100%" }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: "bold", color: isDarkMode ? "#e0e6f0" : "#495057", fontSize: "13px" }}>
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
                      border: isDarkMode ? "1px solid #334155" : "1px solid #ced4da",
                      borderRadius: "6px",
                      fontSize: "14px",
                      backgroundColor: isDarkMode ? "#1e293b" : "#fff",
                      height: "40px",
                      boxSizing: "border-box",
                      color: isDarkMode ? "#e0e6f0" : "#495057"
                    }}
                  />
                </div>

                <div style={{ flex: "1 1 120px", minWidth: "100px", maxWidth: "100%" }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: "bold", color: isDarkMode ? "#e0e6f0" : "#495057", fontSize: "13px" }}>
                    단위
                  </label>
                  <select
                    value={currentCondition.unit}
                    onChange={(e) => handleCurrentConditionChange("unit", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: isDarkMode ? "1px solid #334155" : "1px solid #ced4da",
                      borderRadius: "6px",
                      fontSize: "14px",
                      backgroundColor: isDarkMode ? "#1e293b" : "#fff",
                      height: "40px",
                      boxSizing: "border-box",
                      color: isDarkMode ? "#e0e6f0" : "#495057"
                    }}
                  >
                    {unitOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: "1 1 120px", minWidth: "100px", maxWidth: "100%" }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: "bold", color: isDarkMode ? "#e0e6f0" : "#495057", fontSize: "13px" }}>
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
                      border: isDarkMode ? "1px solid #334155" : "1px solid #ced4da",
                      borderRadius: "6px",
                      fontSize: "14px",
                      backgroundColor: isDarkMode ? "#1e293b" : "#fff",
                      height: "40px",
                      boxSizing: "border-box",
                      color: isDarkMode ? "#e0e6f0" : "#495057"
                    }}
                  />
                </div>

                {/* 주입시간 - 정맥 투약일 때만 표시 */}
                {currentCondition.route === "정맥" && (
                  <div style={{ flex: "1 1 120px", minWidth: "100px", maxWidth: "100%" }}>
                    <label style={{ display: "block", marginBottom: 8, fontWeight: "bold", color: isDarkMode ? "#e0e6f0" : "#495057", fontSize: "13px" }}>
                      주입시간 (분)
                    </label>
                    <input
                      type="text"
                      value={currentCondition.injectionTime}
                      onChange={(e) => handleCurrentConditionChange("injectionTime", e.target.value)}
                      placeholder="bolus 투여 시 0 입력"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: isDarkMode ? "1px solid #334155" : "1px solid #ced4da",
                        borderRadius: "6px",
                        fontSize: "14px",
                        backgroundColor: isDarkMode ? "#1e293b" : "#fff",
                        height: "40px",
                        boxSizing: "border-box",
                        color: isDarkMode ? "#e0e6f0" : "#495057"
                      }}
                    />
                  </div>
                )}

                <div style={{ flex: "1 1 120px", minWidth: "100px", maxWidth: "100%" }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: "bold", color: isDarkMode ? "#e0e6f0" : "#495057", fontSize: "13px" }}>
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
                      border: isDarkMode ? "1px solid #334155" : "1px solid #ced4da",
                      borderRadius: "6px",
                      fontSize: "14px",
                      backgroundColor: isDarkMode ? "#1e293b" : "#fff",
                      height: "40px",
                      boxSizing: "border-box",
                      color: isDarkMode ? "#e0e6f0" : "#495057"
                    }}
                  />
                </div>

                <div style={{ flex: "1 1 180px", minWidth: "180px", maxWidth: "100%" }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: "bold", color: isDarkMode ? "#e0e6f0" : "#495057", fontSize: "13px" }}>
                    최초 투약 날짜/시간
                  </label>
                  <div
                    ref={firstDosePickerRef}
                    style={{ 
                      width: "100%",
                      height: "40px",
                      position: "relative",
                      overflow: "visible"
                    }}
                    onClick={() => focusDateTimePickerInput(firstDosePickerRef)}
                  >
                    <DateTimePicker
                      onChange={handleFirstDoseDateTimeChange}
                      value={
                        currentCondition.firstDoseDate && currentCondition.firstDoseTime
                          ? new Date(`${currentCondition.firstDoseDate}T${currentCondition.firstDoseTime}`)
                          : null
                      }
                      format="y-MM-dd HH:mm"
                      maxDate={new Date()}
                      disableClock={false}
                      clearIcon={null}
                      calendarIcon={null}
                      className={isDarkMode ? "dark-datetime-picker" : ""}
                      style={{
                        width: "100%",
                        height: "40px"
                      }}
                      yearPlaceholder="연도"
                      monthPlaceholder="월"
                      dayPlaceholder="일"
                      hourPlaceholder="시"
                      minutePlaceholder="분"
                    />
                  </div>
                  <style>{`
                    .react-datetime-picker {
                      width: 100%;
                      height: 40px;
                    }
                    .react-datetime-picker__wrapper {
                      width: 100%;
                      height: 40px;
                      padding: 8px 12px;
                      border: ${isDarkMode ? "1px solid #334155" : "1px solid #ced4da"};
                      border-radius: 6px;
                      background-color: ${isDarkMode ? "#1e293b" : "#fff"};
                      color: ${isDarkMode ? "#e0e6f0" : "#495057"};
                      font-size: 14px;
                    }
                    .react-datetime-picker__inputGroup {
                      color: ${isDarkMode ? "#e0e6f0" : "#495057"};
                    }
                    .react-datetime-picker__inputGroup__input {
                      color: ${isDarkMode ? "#e0e6f0" : "#495057"};
                    }
                    .react-datetime-picker__inputGroup__input::placeholder {
                      color: ${isDarkMode ? "#6b7280" : "#9ca3af"};
                      opacity: 0.7;
                    }
                    .react-datetime-picker__button {
                      color: ${isDarkMode ? "#e0e6f0" : "#495057"};
                    }
                    .react-datetime-picker__button:hover {
                      background-color: ${isDarkMode ? "#334155" : "#f8f9fa"};
                    }
                    .react-datetime-picker__calendar {
                      z-index: 1000;
                    }
                    .react-datetime-picker__clock {
                      z-index: 1000;
                    }
                    .react-calendar {
                      background-color: ${isDarkMode ? "#1e293b" : "#fff"};
                      color: ${isDarkMode ? "#e0e6f0" : "#495057"};
                      border: ${isDarkMode ? "1px solid #334155" : "1px solid #ced4da"};
                      max-height: 300px;
                    }
                    .react-calendar__tile {
                      color: ${isDarkMode ? "#e0e6f0" : "#495057"};
                    }
                    .react-clock {
                      max-height: 200px;
                    }
                    .react-clock__face {
                      max-height: 200px;
                    }
                    .react-calendar__tile:enabled:hover {
                      background-color: ${isDarkMode ? "#334155" : "#f0f0f0"};
                    }
                    .react-calendar__tile--active {
                      background-color: ${isDarkMode ? "#0f172a" : "#000"};
                      color: #fff;
                    }
                    .react-clock {
                      background-color: ${isDarkMode ? "#1e293b" : "#fff"};
                      border: ${isDarkMode ? "1px solid #334155" : "1px solid #ced4da"};
                    }
                    .react-clock__face {
                      stroke: ${isDarkMode ? "#334155" : "#ced4da"};
                    }
                    .react-clock__hand {
                      stroke: ${isDarkMode ? "#e0e6f0" : "#495057"};
                    }
                    .react-clock__mark {
                      stroke: ${isDarkMode ? "#e0e6f0" : "#495057"};
                    }
                  `}</style>
                </div>
                <div style={{ flex: "0 0 60px", minWidth: "60px", marginLeft: "auto", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={addOrUpdateCondition}
                    style={{
                      width: "60px",
                      height: "40px",
                      backgroundColor: isEditMode 
                        ? (isDarkMode ? "#1e3a8a" : "#1e40af")
                        : (isDarkMode ? "#0f172a" : "#000"),
                      color: "#fff",
                      border: "none",
                      borderRadius: "10px",
                      fontWeight: 400,
                      fontSize: "13px",
                      cursor: "pointer",
                      transition: "background-color 0.2s, opacity 0.2s"
                    }}
                    onMouseOver={e => { 
                      e.target.style.backgroundColor = isEditMode 
                        ? (isDarkMode ? "#2563eb" : "#3b82f6")
                        : (isDarkMode ? "#1f2937" : "#111827"); 
                    }}
                    onMouseOut={e => { 
                      e.target.style.backgroundColor = isEditMode 
                        ? (isDarkMode ? "#1e3a8a" : "#1e40af")
                        : (isDarkMode ? "#0f172a" : "#000"); 
                    }}
                  >
                    {isEditMode ? "수정" : "확인"}
                  </button>
                </div>
              </div>
            </div>

            {/* 투약 기록 summary */}
            <div style={{ marginTop: "20px" }}>
              <h3 style={{ 
                marginBottom: "10px", 
                color: isDarkMode ? "#e0e6f0" : "#1f2937",
                fontSize: "18px",
                fontWeight: 600,
                letterSpacing: "-0.01em"
              }}>
                처방 내역 summary
              </h3>
              <div style={{
                border: isDarkMode ? "1px solid #334155" : "1px solid #8EC5FF",
                borderRadius: "8px",
                padding: "15px",
                background: isDarkMode ? "#1f2a37" : "#EFF6FF",
                maxHeight: "200px",
                overflowY: "auto"
              }}>
                {conditions.length === 0 ? (
                  <div style={{ color: isDarkMode ? "#9ca3af" : "#6c757d", fontStyle: "italic" }}>
                    처방 내역을 추가해주세요.
                  </div>
                ) : (
                  conditions.map((condition, index) => (
                    <div
                      key={condition.id}
                      style={{
                        borderBottom:
                          conditions.length > 1 && index !== conditions.length - 1
                            ? isDarkMode
                              ? "1px dashed #1f2937"
                              : "1px dashed #94a3b8"
                            : "none",
                        paddingBottom:
                          conditions.length > 1 && index !== conditions.length - 1 ? "10px" : "0",
                        marginBottom:
                          conditions.length > 1 && index !== conditions.length - 1 ? "10px" : "0",
                        fontSize: "13px",
                        color: isDarkMode ? "#9ca3af" : "#6c757d"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          flexWrap: "wrap",
                          width: "100%"
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            flex: 1
                          }}
                        >
                          <span
                            style={{
                              fontWeight: "bold",
                              color: isDarkMode ? "#60a5fa" : "#007bff"
                            }}
                          >
                            기록 {index + 1}:
                          </span>
                          <span
                            style={{
                              fontSize: "16px",
                              fontWeight: 700,
                              color: isDarkMode ? "#f3f4f6" : "#000000"
                            }}
                          >
                            {getConditionSummary(condition)}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => startEditCondition(condition.id)}
                            style={{
                              padding: "4px 8px",
                              backgroundColor: isDarkMode ? "#0f172a" : "#000",
                              color: "#fff",
                              border: "1px solid",
                              borderColor: isDarkMode ? "#1f2937" : "#000",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "11px"
                            }}
                            onMouseOver={e => {
                              e.target.style.backgroundColor = isDarkMode ? "#1f2937" : "#111827";
                            }}
                            onMouseOut={e => {
                              e.target.style.backgroundColor = isDarkMode ? "#0f172a" : "#000";
                            }}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => removeCondition(condition.id, index)}
                            style={{
                              padding: "4px 8px",
                              backgroundColor: isDarkMode ? "#4b5563" : "#fff",
                              color: isDarkMode ? "#fff" : "#111827",
                              border: "1px solid",
                              borderColor: isDarkMode ? "#6b7280" : "#000",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "11px"
                            }}
                            onMouseOver={e => {
                              e.target.style.backgroundColor = isDarkMode ? "#6b7280" : "#f3f4f6";
                            }}
                            onMouseOut={e => {
                              e.target.style.backgroundColor = isDarkMode ? "#4b5563" : "#fff";
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/*2 생성된 테이블 */}
          <div style={{ 
            background: isDarkMode ? "#23293a" : "white", 
            padding: "20px",
            borderRadius: "8px",
            border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6"
          }}>
            <h1 style={{ 
              marginBottom: 20, 
              color: isDarkMode ? "#e0e6f0" : "#111827",
              fontSize: "24px",
              fontWeight: 700,
              letterSpacing: "-0.02em"
            }}>
              STEP 2: 투약 기록을 확인하세요
            </h1>
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
                {/* 정맥 투약이 있는지 확인 */}
                {(() => {
                  const hasIVRoute = tableData.some(r => !r.isTitle && (r.route === "정맥" || r.route === "IV"));
                  return (
                <table style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6",
                  tableLayout: "fixed",
                  background: isDarkMode ? "#23293a" : "white"
                }}>
                  <tbody>
                  {tableData.length > 0 ? tableData.map((row) => {
                      return (
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
                            <div
                              style={{
                                textAlign: "center",
                                width: "100%",
                                color: isDarkMode ? "#e0e6f0" : undefined
                              }}
                            >
                              {row.round}
                            </div>
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
                            <div
                              style={{
                                textAlign: "center",
                                width: "100%",
                                color: isDarkMode ? "#e0e6f0" : undefined
                              }}
                            >
                              {row.amount}
                            </div>
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
                            <div
                              style={{
                                textAlign: "center",
                                width: "100%",
                                color: isDarkMode ? "#e0e6f0" : undefined
                              }}
                            >
                              {(() => {
                                const route = row.route || "";
                                let dosageForm = row.dosageForm;
                                
                                // conditionId가 있으면 condition에서 dosageForm 찾기
                                if (!dosageForm && row.conditionId) {
                                  const condition = conditions.find(c => c.id === row.conditionId);
                                  if (condition && (route === "경구" || route === "oral")) {
                                    dosageForm = condition.dosageForm;
                                  }
                                }
                                
                                // conditionId가 null이면 route와 시간으로 condition 찾기
                                if (!dosageForm && !row.conditionId && (route === "경구" || route === "oral")) {
                                  // row의 시간이 condition의 범위 내에 있는지 확인
                                  const matchingCondition = conditions.find(c => {
                                    if (!c.firstDoseDate || !c.firstDoseTime || c.route !== route) return false;
                                    const conditionStart = new Date(`${c.firstDoseDate}T${c.firstDoseTime}`);
                                    const interval = parseInt(c.intervalHours) || 12;
                                    const totalDoses = parseInt(c.totalDoses) || 1;
                                    const conditionEnd = new Date(conditionStart.getTime() + (totalDoses - 1) * interval * 60 * 60 * 1000);
                                    const rowTime = new Date(row.timeStr);
                                    return rowTime >= conditionStart && rowTime <= conditionEnd;
                                  });
                                  
                                  if (matchingCondition && matchingCondition.dosageForm) {
                                    dosageForm = matchingCondition.dosageForm;
                                  }
                                }
                                
                                // 경구 투약이고 dosageForm이 있는 경우 함께 표시
                                if ((route === "경구" || route === "oral")) {
                                  if (dosageForm && typeof dosageForm === "string" && dosageForm.trim() !== "") {
                                    const formLabel = dosageForm === "capsule/tablet" ? "캡슐/정제" : 
                                                     dosageForm === "oral liquid" ? "현탁/액제" : 
                                                     dosageForm;
                                    return `${route} (${formLabel})`;
                                  }
                                }
                                
                                return route;
                              })()}
                            </div>
                          )}
                        </td>
                        {/* 주입 시간 - 정맥 투약일 때만 표시 */}
                        {hasIVRoute && (
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
                              (row.route === "정맥" || row.route === "IV") ? (
                                <InjectionTimeInput
                                  row={row}
                                  onUpdate={handleTableEdit}
                                  isDarkMode={isDarkMode}
                                  readOnly
                                />
                              ) : (
                                <div
                                  style={{
                                    textAlign: "center",
                                    width: "100%",
                                    color: isDarkMode ? "#e0e6f0" : undefined,
                                    minHeight: "24px",
                                    lineHeight: "24px",
                                  }}
                                >
                                  -
                                </div>
                              )
                            )}
                          </td>
                        )}
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
                    );
                    }) : (
                      <tr>
                        <td colSpan={hasIVRoute ? "6" : "5"} style={{
                          padding: "40px",
                          textAlign: "center",
                          color: isDarkMode ? "#6b7280" : "#6b7280",
                          fontStyle: "italic"
                        }}>
                          처방 내역을 입력하면 ‘상세 투약 기록’ 테이블이 자동으로 생성됩니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                  );
                })()}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "15px" }}>
                <button
                  onClick={resetTableData}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: isDarkMode ? "#23293a" : "#fff",
                    color: isDarkMode ? "#ef4444" : "#dc2626",
                    border: isDarkMode ? "1px solid #7f1d1d" : "1px solid #fecaca",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: 400,
                    fontSize: "15px",
                    transition: "background 0.2s, color 0.2s"
                  }}
                  onMouseOver={e => { e.target.style.backgroundColor = isDarkMode ? "#7f1d1d" : "#fef2f2"; }}
                  onMouseOut={e => { e.target.style.backgroundColor = isDarkMode ? "#23293a" : "#fff"; }}
                >
                  🗑️ 전체 삭제
                </button>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={addRow}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: isDarkMode ? "#23293a" : "#fff",
                      color: isDarkMode ? "#e0e6f0" : "#222",
                      border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: 400,
                      fontSize: "15px",
                      transition: "background 0.2s, color 0.2s"
                    }}
                    onMouseOver={e => { e.target.style.backgroundColor = isDarkMode ? "#334155" : "#f4f6fa"; }}
                    onMouseOut={e => { e.target.style.backgroundColor = isDarkMode ? "#23293a" : "#fff"; }}
                  >
                    + 행추가
                  </button>
                  
                  <button
                    onClick={deleteSelectedRows}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: isDarkMode ? "#23293a" : "#fff",
                      color: isDarkMode ? "#f87171" : "#fb7185",
                      border: isDarkMode ? "1px solid #7f1d1d" : "1px solid #ffe4e6",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: 400,
                      fontSize: "15px",
                      transition: "background 0.2s, color 0.2s"
                    }}
                    onMouseOver={e => { e.target.style.backgroundColor = isDarkMode ? "#7f1d1d" : "#f4f6fa"; }}
                    onMouseOut={e => { e.target.style.backgroundColor = isDarkMode ? "#23293a" : "#fff"; }}
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