import React, { useState } from 'react';
import {
  LayoutDashboard,
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  ExternalLink,
  RefreshCw,
  Eye,
  Calendar,
  Building,
  User,
  ShieldCheck,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { AttendanceRecord, GoogleSheetConfig } from '../types';
import { exportAttendanceToCSV, syncRecordToGoogleSheets } from '../utils/sheetSync';
import { AttendanceDetailModal } from './AttendanceDetailModal';
import { sound } from '../utils/soundUtils';

interface AttendanceDashboardProps {
  records: AttendanceRecord[];
  sheetConfig: GoogleSheetConfig;
  onUpdateRecord: (updatedRecord: AttendanceRecord) => void;
  onDeleteRecord?: (id: string) => void;
  onDeleteAllRecords?: () => void;
  onOpenSheetGuide: () => void;
}

export const AttendanceDashboard: React.FC<AttendanceDashboardProps> = ({
  records,
  sheetConfig,
  onUpdateRecord,
  onDeleteRecord,
  onDeleteAllRecords,
  onOpenSheetGuide,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [detailModalRecord, setDetailModalRecord] = useState<AttendanceRecord | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // In-App Delete Confirmation Modal
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Statistics calculation
  const todayRecords = records.filter((r) => r.dateFormatted === todayStr);
  const checkInsToday = todayRecords.filter((r) => r.type === 'CHECK_IN');
  const checkOutsToday = todayRecords.filter((r) => r.type === 'CHECK_OUT');
  const onTimeCount = checkInsToday.filter((r) => r.status === 'ON_TIME').length;
  const lateCount = checkInsToday.filter((r) => r.status === 'LATE').length;
  const syncedCount = records.filter((r) => r.syncedToGoogleSheets).length;

  const departmentList = Array.from(new Set(records.map((r) => r.department).filter(Boolean)));

  // Filtered attendance records
  const filteredRecords = records.filter((rec) => {
    const matchesSearch =
      rec.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.position.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'ALL' || rec.department === selectedDept;
    const matchesType = selectedType === 'ALL' || rec.type === selectedType;
    const matchesStatus = selectedStatus === 'ALL' || rec.status === selectedStatus;
    const matchesDate = !selectedDate || rec.dateFormatted === selectedDate;

    return matchesSearch && matchesDept && matchesType && matchesStatus && matchesDate;
  });

  const handleResyncSingle = async (rec: AttendanceRecord) => {
    sound.playScanStart();
    const res = await syncRecordToGoogleSheets(rec, sheetConfig);
    if (res.success) {
      sound.playSuccess();
      const updated = { ...rec, syncedToGoogleSheets: true };
      onUpdateRecord(updated);
      if (detailModalRecord?.id === rec.id) {
        setDetailModalRecord(updated);
      }
      setSyncFeedback({
        type: 'success',
        message: `ซิงค์บันทึกเวลาของ ${rec.employeeName} เข้า Google Sheets สำเร็จเรียบร้อยแล้ว`,
      });
    } else {
      sound.playError();
      setSyncFeedback({
        type: 'error',
        message: `ไม่สามารถซิงค์ข้อมูลได้: ${res.message}`,
      });
    }
    setTimeout(() => setSyncFeedback(null), 5000);
  };

  const handleSyncAllToSheets = async () => {
    const unsynced = records.filter((r) => !r.syncedToGoogleSheets);
    if (unsynced.length === 0) {
      setSyncFeedback({
        type: 'success',
        message: 'ข้อมูลบันทึกเวลาทั้งหมดถูกซิงค์เข้า Google Sheets ครบถ้วนแล้ว',
      });
      setTimeout(() => setSyncFeedback(null), 4000);
      return;
    }

    setIsSyncingAll(true);
    sound.playScanStart();
    let successCount = 0;

    for (const rec of unsynced) {
      const res = await syncRecordToGoogleSheets(rec, sheetConfig);
      if (res.success) {
        onUpdateRecord({ ...rec, syncedToGoogleSheets: true });
        successCount++;
      }
    }

    setIsSyncingAll(false);
    if (successCount > 0) {
      sound.playSuccess();
      setSyncFeedback({
        type: 'success',
        message: `ซิงค์ข้อมูลสำเร็จ ${successCount}/${unsynced.length} รายการเข้า Google Sheets เรียบร้อยแล้ว`,
      });
    } else {
      sound.playError();
      setSyncFeedback({
        type: 'error',
        message: 'การซิงค์ไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า Webhook URL ในแท็บการตั้งค่า',
      });
    }
    setTimeout(() => setSyncFeedback(null), 5000);
  };

  const handleConfirmSingleDelete = () => {
    if (!recordToDelete) return;
    if (onDeleteRecord) {
      onDeleteRecord(recordToDelete.id);
    }
    setRecordToDelete(null);
    sound.playSuccess();
  };

  return (
    <div className="space-y-6">
      
      {/* Top 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Today Total */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">ลงเวลาวันนี้</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-white">{todayRecords.length}</div>
            <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
              เข้า {checkInsToday.length} • ออก {checkOutsToday.length}
            </div>
          </div>
        </div>

        {/* Card 2: On-Time */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">เข้างานตรงเวลา</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 text-glow">{onTimeCount}</div>
            <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
              {checkInsToday.length > 0 ? `${Math.round((onTimeCount / checkInsToday.length) * 100)}% ของผู้เข้างาน` : 'ไม่มีประวัติเข้างาน'}
            </div>
          </div>
        </div>

        {/* Card 3: Late */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">เข้างานสาย</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">{lateCount}</div>
            <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
              {checkInsToday.length > 0 ? `${Math.round((lateCount / checkInsToday.length) * 100)}% ของผู้เข้างาน` : '0 รายการ'}
            </div>
          </div>
        </div>

        {/* Card 4: Google Sheets Synced */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">ซิงค์ Google Sheets</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
              {syncedCount}/{records.length}
            </div>
            <div className="text-[11px] text-slate-500 font-semibold mt-0.5">ซิงค์แบบเรียลไทม์</div>
          </div>
        </div>

      </div>

      {/* Sync Feedback Alert */}
      {syncFeedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between animate-fadeIn ${
            syncFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {syncFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span className="font-semibold">{syncFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncFeedback(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Action Banner & Tools */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel rounded-2xl p-5">
        <div>
          <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-indigo-400" />
            <span>ประวัติการลงเวลาปฏิบัติงาน (Live Attendance Logs)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            บันทึกภาพสแกน, ค่าความแม่นยำ AI, วันที่-เวลา, พิกัด GPS และสถานะ Google Sheets
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Export CSV */}
          <button
            id="btn-export-csv"
            type="button"
            onClick={() => exportAttendanceToCSV(filteredRecords)}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-white/10"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ส่งออก CSV</span>
          </button>

          {/* Sync All Button */}
          <button
            id="btn-sync-all-sheets"
            type="button"
            onClick={handleSyncAllToSheets}
            disabled={isSyncingAll}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(99,102,241,0.4)] transition cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isSyncingAll ? 'กำลังซิงค์...' : 'ซิงค์ลง Google Sheets ทั้งหมด'}</span>
          </button>
        </div>
      </div>

      {/* Multi-Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
        
        {/* Search */}
        <div className="lg:col-span-4 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="input-filter-search"
            type="text"
            placeholder="ค้นหาชื่อ, รหัสพนักงาน, ตำแหน่ง..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 backdrop-blur-md"
          />
        </div>

        {/* Department Filter */}
        <div className="lg:col-span-3">
          <select
            id="select-filter-dept"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 backdrop-blur-md"
          >
            <option value="ALL" className="bg-slate-900 text-white">ทุกแผนก / ฝ่าย</option>
            {departmentList.map((dept) => (
              <option key={dept} value={dept} className="bg-slate-900 text-white">
                {dept}
              </option>
            ))}
          </select>
        </div>

        {/* Type Filter (Check-in / Check-out) */}
        <div className="lg:col-span-2">
          <select
            id="select-filter-type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 backdrop-blur-md"
          >
            <option value="ALL" className="bg-slate-900 text-white">เข้า/ออกทั้งหมด</option>
            <option value="CHECK_IN" className="bg-slate-900 text-white">🟢 เข้างาน (Check-In)</option>
            <option value="CHECK_OUT" className="bg-slate-900 text-white">🔴 ออกงาน (Check-Out)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="lg:col-span-2">
          <select
            id="select-filter-status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 backdrop-blur-md"
          >
            <option value="ALL" className="bg-slate-900 text-white">ทุกสถานะ</option>
            <option value="ON_TIME" className="bg-slate-900 text-white">ตรงเวลา</option>
            <option value="LATE" className="bg-slate-900 text-white">สาย</option>
          </select>
        </div>

        {/* Date Filter */}
        <div className="lg:col-span-1">
          <input
            id="input-filter-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-2 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 backdrop-blur-md [color-scheme:dark]"
          />
        </div>

      </div>

      {/* Main Attendance Logs Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/5 text-slate-400 border-b border-white/10 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">ภาพสแกน & ข้อมูลบุคลากร</th>
                <th className="py-3.5 px-4">ประเภท</th>
                <th className="py-3.5 px-4">วันที่ / เวลา</th>
                <th className="py-3.5 px-4">สถานะเวลา</th>
                <th className="py-3.5 px-4">พิกัด GPS & พื้นที่</th>
                <th className="py-3.5 px-4">ความแม่นยำ AI</th>
                <th className="py-3.5 px-4 text-center">Google Sheets</th>
                <th className="py-3.5 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-white/5 transition">
                  
                  {/* Photo & Employee Info */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-900 border border-white/10 flex-shrink-0">
                        <img
                          src={rec.capturedPhoto}
                          alt={rec.employeeName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm truncate">{rec.employeeName}</div>
                        <div className="text-[11px] text-indigo-400 font-semibold truncate">{rec.position}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {rec.employeeId} • {rec.department}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Type (In / Out) */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      rec.type === 'CHECK_IN'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(52,211,153,0.3)]'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                    }`}>
                      {rec.type === 'CHECK_IN' ? '🟢 เข้างาน' : '🔴 ออกงาน'}
                    </span>
                  </td>

                  {/* Date & Time */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-mono font-bold text-white text-sm">{rec.timeFormatted} น.</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      <span>{rec.dateFormatted}</span>
                    </div>
                  </td>

                  {/* Status Badge (On-Time / Late) */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                      rec.status === 'ON_TIME'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : rec.status === 'LATE'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-white/10 text-slate-300 border border-white/5'
                    }`}>
                      {rec.status === 'ON_TIME' ? 'ตรงเวลา' : rec.status === 'LATE' ? 'สาย' : 'ปกติ'}
                    </span>
                  </td>

                  {/* GPS Location & Office Area */}
                  <td className="py-3 px-4 max-w-[200px]">
                    <div className="flex items-center gap-1 text-slate-300 truncate font-medium">
                      <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${rec.location.inOfficeZone ? 'text-emerald-400' : 'text-amber-400'}`} />
                      <span className="truncate">{rec.location.address}</span>
                    </div>
                    <div className="text-[10px] font-mono text-indigo-400 mt-0.5">
                      {rec.location.latitude.toFixed(4)}, {rec.location.longitude.toFixed(4)} ({rec.location.distanceFromOfficeMeters}m)
                    </div>
                  </td>

                  {/* AI Confidence */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-emerald-400 font-mono font-bold text-xs text-glow">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{rec.confidenceScore}%</span>
                    </div>
                    <div className="text-[10px] text-slate-500">ผ่านเกณฑ์ชีวมิติ</div>
                  </td>

                  {/* Google Sheets Sync Badge */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    {rec.syncedToGoogleSheets ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>ซิงค์แล้ว</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleResyncSingle(rec)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-semibold hover:bg-amber-500/40 transition cursor-pointer"
                      >
                        กดเพื่อซิงค์
                      </button>
                    )}
                  </td>

                  {/* Actions: View & Delete */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        id={`btn-view-detail-${rec.id}`}
                        type="button"
                        onClick={() => setDetailModalRecord(rec)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 border border-white/10 transition cursor-pointer"
                        title="ดูรายละเอียดการลงเวลา"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {onDeleteRecord && (
                        <button
                          id={`btn-delete-record-${rec.id}`}
                          type="button"
                          onClick={() => setRecordToDelete(rec)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 hover:text-rose-300 border border-rose-500/20 transition cursor-pointer"
                          title="ลบบันทึกรายการนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRecords.length === 0 && (
          <div className="text-center py-16 text-slate-400 space-y-3">
            <Clock className="w-10 h-10 mx-auto text-slate-500" />
            <p className="font-semibold text-white">
              {records.length === 0 ? 'ยังไม่มีประวัติการลงเวลาในระบบ' : 'ไม่พบรายการลงเวลาตามเงื่อนไขที่เลือก'}
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {records.length === 0
                ? 'เมื่อพนักงานสแกนใบหน้าและบันทึกเวลา รายการลงเวลาจะปรากฏขึ้นที่นี่โดยอัตโนมัติ'
                : 'สามารถลองปรับเปลี่ยนตัวกรอง หรือค้นหาใหม่'}
            </p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* In-App Delete Confirmation Modal: Single Record */}
      {/* ========================================================================= */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 text-slate-800 space-y-4">
            
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">ยืนยันการลบบันทึกการลงเวลา</h3>
                <p className="text-xs text-slate-500">การดำเนินการนี้ไม่สามารถยกเลิกได้</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                <img
                  src={recordToDelete.capturedPhoto}
                  alt={recordToDelete.employeeName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <div className="font-bold text-slate-900 text-sm">{recordToDelete.employeeName}</div>
                <div className="text-slate-500 mt-0.5">
                  {recordToDelete.type === 'CHECK_IN' ? '🟢 เข้างาน' : '🔴 ออกงาน'} • {recordToDelete.timeFormatted} น. ({recordToDelete.dateFormatted})
                </div>
                <div className="text-[11px] text-slate-400">{recordToDelete.department}</div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              คุณแน่ใจหรือไม่ว่าต้องการลบรายการลงเวลานี้ออกจากระบบ?
            </p>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                id="btn-confirm-delete-record"
                type="button"
                onClick={handleConfirmSingleDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-200 transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ยืนยันลบบันทึก</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Attendance Detail Modal */}
      {detailModalRecord && (
        <AttendanceDetailModal
          record={detailModalRecord}
          onClose={() => setDetailModalRecord(null)}
          onResyncToSheet={handleResyncSingle}
        />
      )}

    </div>
  );
};
