import React, { useState, useEffect, useCallback } from 'react';
import {
  INITIAL_OFFICE_CONFIG,
  INITIAL_SHEET_CONFIG,
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
import {
  fetchEmployees,
  saveEmployee,
  deleteEmployee,
  deleteMultipleEmployees,
  deleteAllEmployees,
  fetchAttendanceRecords,
  saveAttendanceRecord,
  deleteAttendanceRecord,
  deleteAllAttendanceRecords,
  fetchAppSetting,
  saveAppSetting
} from './utils/supabaseClient';

export default function App() {
  const [activeTab, setActiveTab] = useState<'scan' | 'dashboard' | 'employees' | 'settings'>('scan');

  // Data States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [officeConfig, setOfficeConfig] = useState<OfficeConfig>(INITIAL_OFFICE_CONFIG);
  const [sheetConfig, setSheetConfig] = useState<GoogleSheetConfig>(INITIAL_SHEET_CONFIG);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentGeo, setCurrentGeo] = useState<GeoLocationData | null>(null);

  // Initial Data Fetch
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const [
        fetchedEmployees,
        fetchedRecords,
        fetchedOffice,
        fetchedSheet
      ] = await Promise.all([
        fetchEmployees(),
        fetchAttendanceRecords(),
        fetchAppSetting<OfficeConfig>('office_config', INITIAL_OFFICE_CONFIG),
        fetchAppSetting<GoogleSheetConfig>('sheet_config', INITIAL_SHEET_CONFIG)
      ]);
      setEmployees(fetchedEmployees);
      setAttendanceRecords(fetchedRecords);
      setOfficeConfig(fetchedOffice);
      setSheetConfig(fetchedSheet);
      setIsLoading(false);
    };
    loadData();
  }, []);

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
  const handleAddEmployee = async (newEmp: Employee) => {
    setEmployees((prev) => [newEmp, ...prev]);
    await saveEmployee(newEmp);
  };

  const handleUpdateEmployee = async (updatedEmp: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === updatedEmp.id ? updatedEmp : e)));
    await saveEmployee(updatedEmp);
  };

  const handleDeleteEmployee = async (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    await deleteEmployee(id);
  };

  const handleDeleteMultipleEmployees = async (ids: string[]) => {
    setEmployees((prev) => prev.filter((e) => !ids.includes(e.id)));
    await deleteMultipleEmployees(ids);
  };

  const handleDeleteAllEmployees = async () => {
    setEmployees([]);
    await deleteAllEmployees();
  };

  const handleUpdateDataset = (employeeId: string, dataset: FacePhotoItem[]) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id === employeeId) {
          const updatedEmp = {
            ...emp,
            faceDataset: dataset,
            avatarUrl: dataset.length > 0 ? dataset[0].dataUrl : emp.avatarUrl,
          };
          saveEmployee(updatedEmp); // Update avatarUrl in db
          return updatedEmp;
        }
        return emp;
      })
    );
  };

  // Attendance Handlers
  const handleRecordAdded = async (record: AttendanceRecord) => {
    setAttendanceRecords((prev) => [record, ...prev]);
    await saveAttendanceRecord(record);
  };

  const handleUpdateRecord = async (updatedRecord: AttendanceRecord) => {
    setAttendanceRecords((prev) =>
      prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r))
    );
    await saveAttendanceRecord(updatedRecord);
  };

  const handleDeleteRecord = async (id: string) => {
    setAttendanceRecords((prev) => prev.filter((r) => r.id !== id));
    await deleteAttendanceRecord(id);
  };

  const handleDeleteAllRecords = async () => {
    setAttendanceRecords([]);
    await deleteAllAttendanceRecords();
  };

  // Config Handlers
  const handleSaveOfficeConfig = async (config: OfficeConfig) => {
    setOfficeConfig(config);
    await saveAppSetting('office_config', config);
  };

  const handleSaveSheetConfig = async (config: GoogleSheetConfig) => {
    setSheetConfig(config);
    await saveAppSetting('sheet_config', config);
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
              onSaveOfficeConfig={handleSaveOfficeConfig}
              onSaveSheetConfig={handleSaveSheetConfig}
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
