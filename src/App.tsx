import React, { useState, useEffect, useCallback } from 'react';
import {
  INITIAL_EMPLOYEES,
  INITIAL_ATTENDANCE_RECORDS,
  INITIAL_OFFICE_CONFIG,
  INITIAL_SHEET_CONFIG,
  DATA_VERSION,
} from './data/initialData';
import {
  Employee,
  AttendanceRecord,
  OfficeConfig,
  GoogleSheetConfig,
  GeoLocationData,
  FacePhotoItem,
} from './types';
import { evaluateLocation } from './utils/geoUtils';
import { Navbar } from './components/Navbar';
import { FaceScanClock } from './components/FaceScanClock';
import { AttendanceDashboard } from './components/AttendanceDashboard';
import { EmployeeManagement } from './components/EmployeeManagement';
import { SettingsView } from './components/SettingsView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'scan' | 'dashboard' | 'employees' | 'settings'>('scan');

  // ─── Version Guard: reset localStorage if dataset has been updated ───────────
  // ถ้า DATA_VERSION เปลี่ยน จะล้าง app_employees และ app_attendance_records เก่าออก
  // เพื่อให้โหลดข้อมูลพนักงานและภาพ dataset ใหม่จาก initialData โดยอัตโนมัติ
  const storedVersion = localStorage.getItem('app_data_version');
  if (storedVersion !== DATA_VERSION) {
    localStorage.removeItem('app_employees');
    localStorage.removeItem('app_attendance_records');
    localStorage.setItem('app_data_version', DATA_VERSION);
    console.info(`[DataVersion] Reset employees & records to v${DATA_VERSION}`);
  }

  // Persistence: Employees
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('app_employees');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_EMPLOYEES;
  });

  // Persistence: Attendance Records
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('app_attendance_records');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_ATTENDANCE_RECORDS;
  });

  // Persistence: Office Configuration
  const [officeConfig, setOfficeConfig] = useState<OfficeConfig>(() => {
    const saved = localStorage.getItem('app_office_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_OFFICE_CONFIG;
  });

  // Persistence: Google Sheet Configuration
  const [sheetConfig, setSheetConfig] = useState<GoogleSheetConfig>(() => {
    const saved = localStorage.getItem('app_sheet_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_SHEET_CONFIG;
  });

  // Geolocation state
  const [currentGeo, setCurrentGeo] = useState<GeoLocationData | null>(null);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('app_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('app_attendance_records', JSON.stringify(attendanceRecords));
  }, [attendanceRecords]);

  useEffect(() => {
    localStorage.setItem('app_office_config', JSON.stringify(officeConfig));
  }, [officeConfig]);

  useEffect(() => {
    localStorage.setItem('app_sheet_config', JSON.stringify(sheetConfig));
  }, [sheetConfig]);

  // GPS Locator
  const refreshGeoLocation = useCallback(() => {
    if (!navigator.geolocation) {
      const fallback = evaluateLocation(
        officeConfig.latitude,
        officeConfig.longitude,
        10,
        officeConfig
      );
      setCurrentGeo(fallback);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const geo = evaluateLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy || 10,
          officeConfig
        );
        setCurrentGeo(geo);
      },
      (err) => {
        console.warn('Geolocation error fallback:', err);
        const fallback = evaluateLocation(
          officeConfig.latitude,
          officeConfig.longitude,
          10,
          officeConfig
        );
        setCurrentGeo(fallback);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [officeConfig]);

  useEffect(() => {
    refreshGeoLocation();
    const interval = setInterval(refreshGeoLocation, 30000);
    return () => clearInterval(interval);
  }, [refreshGeoLocation]);

  // Employee Handlers
  const handleAddEmployee = (newEmp: Employee) => {
    setEmployees((prev) => [newEmp, ...prev]);
  };

  const handleUpdateEmployee = (updatedEmp: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === updatedEmp.id ? updatedEmp : e)));
  };

  const handleDeleteEmployee = (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  const handleDeleteMultipleEmployees = (ids: string[]) => {
    setEmployees((prev) => prev.filter((e) => !ids.includes(e.id)));
  };

  const handleDeleteAllEmployees = () => {
    setEmployees([]);
  };

  const handleUpdateDataset = (employeeId: string, dataset: FacePhotoItem[]) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id === employeeId) {
          return {
            ...emp,
            faceDataset: dataset,
            avatarUrl: dataset.length > 0 ? dataset[0].dataUrl : emp.avatarUrl,
          };
        }
        return emp;
      })
    );
  };

  // Attendance Handlers
  const handleRecordAdded = (record: AttendanceRecord) => {
    setAttendanceRecords((prev) => [record, ...prev]);
  };

  const handleUpdateRecord = (updatedRecord: AttendanceRecord) => {
    setAttendanceRecords((prev) =>
      prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r))
    );
  };

  const handleDeleteRecord = (id: string) => {
    setAttendanceRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleDeleteAllRecords = () => {
    setAttendanceRecords([]);
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAttendanceCount = attendanceRecords.filter((r) => r.dateFormatted === todayStr).length;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#111625] to-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Top Fixed / Sticky Navigation */}
      <div className="z-50 sticky top-0">
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          sheetConfig={sheetConfig}
          currentGeo={currentGeo}
          totalEmployeesCount={employees.length}
          todayAttendanceCount={todayAttendanceCount}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10">
        {/* Subtle decorative glow in background */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-600 rounded-full mix-blend-screen filter blur-[120px] opacity-20 pointer-events-none" />
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-violet-600 rounded-full mix-blend-screen filter blur-[120px] opacity-20 pointer-events-none" />
        
        <div className="relative z-10">
          {activeTab === 'scan' && (
            <FaceScanClock
              employees={employees}
              officeConfig={officeConfig}
              sheetConfig={sheetConfig}
              onRecordAdded={handleRecordAdded}
              currentGeo={currentGeo}
              onRefreshGeo={refreshGeoLocation}
              attendanceRecords={attendanceRecords}
            />
          )}

          {activeTab === 'dashboard' && (
            <AttendanceDashboard
              records={attendanceRecords}
              sheetConfig={sheetConfig}
              onUpdateRecord={handleUpdateRecord}
              onDeleteRecord={handleDeleteRecord}
              onDeleteAllRecords={handleDeleteAllRecords}
              onOpenSheetGuide={() => setActiveTab('settings')}
            />
          )}

          {activeTab === 'employees' && (
            <EmployeeManagement
              employees={employees}
              onAddEmployee={handleAddEmployee}
              onUpdateEmployee={handleUpdateEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              onUpdateDataset={handleUpdateDataset}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              officeConfig={officeConfig}
              sheetConfig={sheetConfig}
              currentGeo={currentGeo}
              onSaveOfficeConfig={setOfficeConfig}
              onSaveSheetConfig={setSheetConfig}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto glass-panel border-t-0 border-t-white/10 py-3.5 px-6 sm:px-8 text-[11px] font-medium text-slate-400 shadow-xs relative z-20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
            <span>Google Sheets Synchronized: <strong className="text-emerald-400 font-semibold">{sheetConfig.appsScriptUrl ? 'CONNECTED' : 'LOCAL READY'}</strong></span>
          </div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">
            Face Recognition Biometrics • 5-Angle Dataset • GPS Geofencing Active
          </div>
        </div>
      </footer>

    </div>
  );
}
