import React from 'react';
import {
  X,
  Clock,
  MapPin,
  ShieldCheck,
  Building,
  User,
  Calendar,
  FileSpreadsheet,
  ExternalLink,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { AttendanceRecord } from '../types';

interface AttendanceDetailModalProps {
  record: AttendanceRecord | null;
  onClose: () => void;
  onResyncToSheet: (record: AttendanceRecord) => void;
}

export const AttendanceDetailModal: React.FC<AttendanceDetailModalProps> = ({
  record,
  onClose,
  onResyncToSheet,
}) => {
  if (!record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 text-slate-800 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
              record.type === 'CHECK_IN'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {record.type === 'CHECK_IN' ? 'IN' : 'OUT'}
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">
                รายละเอียดการลงเวลา: {record.employeeName}
              </h3>
              <p className="text-xs text-slate-500">
                รหัสบันทึก: <span className="font-mono text-indigo-600 font-semibold">{record.id}</span> • วันที่ {record.dateFormatted} เวลา {record.timeFormatted} น.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-6 space-y-5">
          
          {/* Face Snapshot & Biometrics Box */}
          <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="relative w-28 h-28 rounded-xl overflow-hidden bg-slate-100 border border-indigo-200 flex-shrink-0">
              <img
                src={record.capturedPhoto}
                alt={record.employeeName}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 text-[9px] font-bold bg-slate-900 text-white rounded">
                Live Scan
              </span>
            </div>

            <div className="space-y-2 text-xs flex-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  AI Match: {record.confidenceScore}%
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  record.status === 'ON_TIME'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : record.status === 'LATE'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {record.status === 'ON_TIME' ? 'ตรงเวลา' : record.status === 'LATE' ? 'สาย' : 'ปกติ'}
                </span>
              </div>
              <p className="text-slate-700 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 inline mr-1" />
                {record.matchReason || 'ยืนยันตัวตนด้วยจุดชีวมิติใบหน้าสอดคล้องกับชุดข้อมูล Dataset 3 มุมมอง'}
              </p>
              <p className="text-slate-500 text-[11px]">
                อุปกรณ์: {record.device}
              </p>
            </div>
          </div>

          {/* Profile & Geolocation 2-Column Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Profile Info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-600" />
                ข้อมูลบุคลากร
              </h4>
              <div className="space-y-1.5 text-slate-700 pt-1">
                <div><span className="text-slate-400">รหัส:</span> <span className="font-mono text-indigo-600 font-semibold">{record.employeeId}</span></div>
                <div><span className="text-slate-400">ชื่อ:</span> <span className="font-semibold text-slate-900">{record.employeeName}</span></div>
                <div><span className="text-slate-400">ตำแหน่ง:</span> {record.position}</div>
                <div><span className="text-slate-400">ระดับ:</span> {record.level}</div>
                <div><span className="text-slate-400">แผนก:</span> {record.department}</div>
                <div><span className="text-slate-400">อายุ:</span> {record.age} ปี</div>
              </div>
            </div>

            {/* Geolocation Info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-600" />
                พิกัดและสถานที่ (GPS Location)
              </h4>
              <div className="space-y-1.5 text-slate-700 pt-1">
                <div>
                  <span className="text-slate-400">สถานะพื้นที่:</span>{' '}
                  <span className={`font-semibold ${record.location.inOfficeZone ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {record.location.inOfficeZone ? '✓ ในเขตหน่วยงาน' : '⚠️ นอกเขตหน่วยงาน'}
                  </span>
                </div>
                <div><span className="text-slate-400">สถานที่:</span> {record.location.address}</div>
                <div><span className="text-slate-400">ระยะห่าง:</span> {record.location.distanceFromOfficeMeters} เมตร</div>
                <div className="font-mono text-[11px] text-indigo-600">
                  {record.location.latitude}, {record.location.longitude} (±{record.location.accuracy} ม.)
                </div>
                <div className="pt-1">
                  <a
                    href={`https://www.google.com/maps?q=${record.location.latitude},${record.location.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-semibold"
                  >
                    <span>เปิดดูใน Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

          </div>

          {/* Google Sheets Sync Status Bar */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="text-slate-700 font-semibold">สถานะ Google Sheets: </span>
                <span className={record.syncedToGoogleSheets ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                  {record.syncedToGoogleSheets ? 'ซิงค์ข้อมูลแล้ว ✓' : 'รอการซิงค์'}
                </span>
                {record.googleSheetRowId && (
                  <span className="text-slate-400 text-[11px] ml-1">({record.googleSheetRowId})</span>
                )}
              </div>
            </div>

            <button
              onClick={() => onResyncToSheet(record)}
              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs transition cursor-pointer"
            >
              ซิงค์ซ้ำอีกครั้ง
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
