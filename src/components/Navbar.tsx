import React, { useState, useEffect } from 'react';
import {
  Camera,
  LayoutDashboard,
  Users,
  Settings,
  Clock,
  MapPin,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { GoogleSheetConfig, GeoLocationData } from '../types';

interface NavbarProps {
  activeTab: 'scan' | 'dashboard' | 'employees' | 'settings';
  setActiveTab: (tab: 'scan' | 'dashboard' | 'employees' | 'settings') => void;
  sheetConfig: GoogleSheetConfig;
  currentGeo: GeoLocationData | null;
  totalEmployeesCount: number;
  todayAttendanceCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  sheetConfig,
  currentGeo,
  totalEmployeesCount,
  todayAttendanceCount,
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format Thai Buddhist Era Date
  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  const thaiDays = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

  const dayName = thaiDays[currentTime.getDay()];
  const dateNum = currentTime.getDate();
  const monthName = thaiMonths[currentTime.getMonth()];
  const yearBE = currentTime.getFullYear() + 543;
  const timeString = currentTime.toLocaleTimeString('th-TH', { hour12: false });

  return (
    <header className="glass-panel text-slate-100 shadow-xl border-b border-white/10 mx-auto w-full relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 gap-4">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('scan')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.5)] group-hover:shadow-[0_0_25px_rgba(99,102,241,0.8)] transition-all duration-300">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white text-glow">
                  FACE<span className="text-indigo-400">CONNECT</span>
                </span>
                <span className="inline-flex px-2.5 py-0.5 text-xs font-bold tracking-wide rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  PEA บึงกาฬ
                </span>
              </div>
            </div>
          </div>

          {/* Center: Live Clock & GPS Status Badge (Desktop/Tablet) */}
          <div className="hidden md:flex items-center gap-4 bg-white/5 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-inner">
            <div className="flex items-center gap-2 text-slate-300 text-sm">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span className="text-xs text-slate-400">{dayName} {dateNum} {monthName} {yearBE}</span>
              <span className="font-mono font-bold text-white text-base text-glow">{timeString}</span>
            </div>

            <div className="h-4 w-px bg-white/20" />

            {/* GPS Geolocation Indicator */}
            <div className="flex items-center gap-1.5 text-xs">
              <MapPin className={`w-3.5 h-3.5 ${currentGeo?.inOfficeZone ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span className={currentGeo?.inOfficeZone ? 'text-emerald-400 font-semibold text-glow' : 'text-amber-400 font-semibold'}>
                {currentGeo ? (currentGeo.inOfficeZone ? 'ในพื้นที่หน่วยงาน' : 'GPS ตรวจจับได้') : 'กำลังระบุพิกัด...'}
              </span>
            </div>

            <div className="h-4 w-px bg-white/20" />

            {/* Google Sheets Sync Indicator */}
            {(() => {
              const isConfigured = Boolean((sheetConfig.scriptUrl || sheetConfig.appsScriptUrl)?.trim());
              return (
                <div
                  onClick={() => !isConfigured && setActiveTab('settings')}
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition ${
                    isConfigured
                      ? 'text-emerald-400 font-semibold'
                      : 'text-amber-400 font-semibold bg-amber-500/10 cursor-pointer hover:bg-amber-500/20'
                  }`}
                  title={isConfigured ? 'Google Sheets เชื่อมต่อพร้อมซิงค์' : 'คลิกเพื่อไปตั้งค่า Webhook Google Sheets'}
                >
                  <FileSpreadsheet className={`w-3.5 h-3.5 ${isConfigured ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <span className="hidden lg:inline text-slate-300">Sheets:</span>
                  <span className="inline-flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${isConfigured ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400'}`} />
                    <span className={isConfigured ? 'text-glow' : ''}>{isConfigured ? 'พร้อมซิงค์' : 'รอใส่ Webhook'}</span>
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Action Tabs for Desktop */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('scan')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 ${
                activeTab === 'scan'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] border border-indigo-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">สแกนลงเวลา</span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 ${
                activeTab === 'dashboard'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] border border-indigo-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">แดชบอร์ด</span>
              {todayAttendanceCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.8)]">
                  {todayAttendanceCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('employees')}
              className={`relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 ${
                activeTab === 'employees'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] border border-indigo-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">พนักงาน</span>
              <span className="hidden lg:inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-white/10 text-white border border-white/20">
                {totalEmployeesCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] border border-indigo-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
              title="ตั้งค่าพิกัด & Google Sheets"
            >
              <Settings className="w-4 h-4" />
            </button>
          </nav>
        </div>

        {/* Mobile Info Bar (Date, Time, GPS) */}
        <div className="flex md:hidden items-center justify-between py-2 border-t border-white/10 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-mono font-bold text-white text-glow">{timeString}</span>
            <span>({dateNum} {monthName} {yearBE})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className={`w-3.5 h-3.5 ${currentGeo?.inOfficeZone ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className={currentGeo?.inOfficeZone ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              {currentGeo?.inOfficeZone ? 'ในหน่วยงาน' : 'GPS พร้อม'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
