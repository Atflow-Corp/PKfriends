import React, { useState, useEffect } from 'react';

function TablePage(props) {
  const [currentCondition, setCurrentCondition] = useState({
    route: "",
    dosage: "",
    unit: "mg",
    intervalHours: "",
    injectionTime: "",
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
          injectionTime: adm.isIVInfusion ? (adm.infusionTime ?? '-') : '-',
          isTitle: false
        };
      }).sort((a,b) => a.time - b.time);
      rows.forEach((row, i) => { row.round = `${i + 1} 회차`; });
      setTableData([titleRow, ...rows]);
      setIsTableGenerated(true);
    } catch {}
  }, [props.initialAdministrations]);

  // Propagate table changes to parent for persistence
  useEffect(() => {
    if (!props.onRecordsChange) return;
    const records = tableData.filter(r => !r.isTitle).map(r => ({
      timeStr: r.timeStr,
      amount: r.amount,
      route: r.route,
      injectionTime: r.injectionTime
    }));
    props.onRecordsChange(records);
  }, [tableData]);

  // 초기 로드 완료 후 isInitialLoad를 false로 설정
  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [isInitialLoad]);

  // props가 변경될 때 state 업데이트
  useEffect(() => {
    if (props.initialConditions) {
      setConditions(props.initialConditions);
    }
    if (props.initialTableData) {
      setTableData(props.initialTableData);
    }
    if (props.initialIsTableGenerated !== undefined) {
      setIsTableGenerated(props.initialIsTableGenerated);
    }
  }, [props.initialConditions, props.initialTableData, props.initialIsTableGenerated]);

  // 투약 경로 옵션
  const routeOptions = ["경구", "정맥", "피하", "수액"];
  
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
    setCurrentCondition(prev => ({ ...prev, [field]: value }));
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
      const records = newTableData.filter(row => !row.isTitle);
      props.onSaveRecords(records);
    }
  };

  // 테이블 데이터 수정 함수
  const handleTableEdit = (id, field, value) => {
    setTableData(prev => 
      prev.map(row => 
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  // 행 추가 함수
  const addRow = () => {
    const newId = Math.max(0, ...tableData.filter(row => !row.isTitle).map(row => row.id)) + 1;
    setTableData(prev => [
      ...prev,
      {
        id: newId,
        round: `${newId}회차`,
        time: "",
        amount: 0,
        route: "경구",
        injectionTime: "-",
        isTitle: false
      }
    ]);
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
    if (window.confirm("투약 기록 테이블을 전체 삭제하시겠습니까? 투약 조건은 유지됩니다.")) {
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
        <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
          <h1 style={{ textAlign: "center", color: isDarkMode ? "#e0e6f0" : "#333", marginBottom: "30px" }}>
            투약 기록 테이블 생성기
          </h1>
          {/* 이하 기존 테이블 입력 UI 코드 유지 */}
          {/* 1단계: 개선된 조건 입력 UI */}
          <div style={{
            background: isDarkMode ? "#23293a" : "#f8f9fa",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "30px",
            border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6"
          }}>
            <h2 style={{ marginBottom: 20, color: isDarkMode ? "#e0e6f0" : "#495057" }}>1단계: 투약 조건 입력</h2>

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
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

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
                    주입시간
                  </label>
                  <input
                    type="text"
                    value={currentCondition.injectionTime}
                    onChange={(e) => handleCurrentConditionChange("injectionTime", e.target.value)}
                    placeholder="예: 30분"
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
                  {isEditMode ? "조건 수정" : "조건 추가"}
                </button>
              </div>
            </div>

            {/* 투약 기록 summary */}
            <div style={{ marginTop: "20px" }}>
              <h3 style={{ marginBottom: "10px", color: "#495057" }}>
                투약 기록 summary
              </h3>
              <div style={{
                border: "1px solid #dee2e6",
                borderRadius: "8px",
                padding: "15px",
                background: "white",
                maxHeight: "200px",
                overflowY: "auto"
              }}>
                {conditions.map((condition, index) => (
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
                ))}
                {/* Existing persisted rows summary */}
                {tableData.filter(r => !r.isTitle).length > 0 && (
                  <div style={{ fontSize: "13px", color: "#6c757d" }}>
                    {tableData.filter(r => !r.isTitle).map((row, idx) => (
                      <div key={row.id} style={{ borderBottom: "1px dashed #eee", padding: "6px 0" }}>
                        <span style={{ fontWeight: "bold", color: "#10b981", marginRight: 8 }}>저장 {idx + 1}:</span>
                        {`${row.timeStr}, ${row.amount}, ${row.route}${row.route === '정맥' && row.injectionTime && row.injectionTime !== '-' ? ` (${row.injectionTime}분)` : ''}`}
                      </div>
                    ))}
                  </div>
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
              투약기록 입력 완료
            </button>
          </div>

          {/*2 생성된 테이블 */}
          {(isTableGenerated || tableData.length > 0) && (
            <div style={{ 
              background: isDarkMode ? "#23293a" : "white", 
              padding: "20px",
              borderRadius: "8px",
              border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6"
            }}>
              <h2 style={{ marginBottom:20, color: isDarkMode ? '#e0e6f0' : '#495057' }}>2단계 : 투약 기록 확인</h2>
              
              <div style={{ overflowX: "auto" }}>
                <table style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6",
                  tableLayout: "fixed",
                  background: isDarkMode ? "#23293a" : "white"
                }}>
                  <tbody>
                  {tableData.map((row) => (
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
                          width: "19%",
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
                          width: "19%",
                          color: isDarkMode ? "#e0e6f0" : undefined,
                          background: isDarkMode && row.isTitle ? "#2d3650" : undefined
                        }}>
                          {row.isTitle ? (
                            row.time
                          ) : (
                            <input
                              type="text"
                              value={row.timeStr}
                              onChange={(e) => handleTableEdit(row.id, "timeStr", e.target.value)}
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
                        {/* 투약 용량 */}
                        <td style={{
                          padding: "12px",
                          border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6",
                          textAlign: "center",
                          width: "19%",
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
                          width: "19%",
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
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        {/* 주입 시간 */}
                        <td style={{
                          padding: "12px",
                          border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6",
                          textAlign: "center",
                          width: "19%",
                          color: isDarkMode ? "#e0e6f0" : undefined,
                          background: isDarkMode && row.isTitle ? "#2d3650" : undefined
                        }}>
                          {row.isTitle ? (
                            row.injectionTime
                          ) : (
                            <input
                              type="text"
                              value={row.injectionTime}
                              onChange={(e) => handleTableEdit(row.id, "injectionTime", e.target.value)}
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
                        {/* 삭제 체크박스 */}
                        <td style={{
                          padding: "12px",
                          border: isDarkMode ? "1px solid #334155" : "1px solid #dee2e6",
                          textAlign: "center",
                          width: "5%",
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
                    ))}
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
          )}
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