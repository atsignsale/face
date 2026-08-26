import React, { useState } from 'react';
import {
  Settings,
  MapPin,
  Clock,
  FileSpreadsheet,
  Save,
  CheckCircle2,
  Copy,
  ExternalLink,
  Code,
  Sparkles,
  Info,
  AlertTriangle,
  Play,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { OfficeConfig, GoogleSheetConfig, GeoLocationData } from '../types';
import { generateGoogleAppsScript, testGoogleSheetsConnection } from '../utils/sheetSync';
import { sound } from '../utils/soundUtils';

interface SettingsViewProps {
  officeConfig: OfficeConfig;
  sheetConfig: GoogleSheetConfig;
  currentGeo: GeoLocationData | null;
  onSaveOfficeConfig: (config: OfficeConfig) => void;
  onSaveSheetConfig: (config: GoogleSheetConfig) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  officeConfig,
  sheetConfig,
  currentGeo,
  onSaveOfficeConfig,
  onSaveSheetConfig,
}) => {
  const [officeForm, setOfficeForm] = useState<OfficeConfig>({ ...officeConfig });
  const [sheetForm, setSheetForm] = useState<GoogleSheetConfig>({
    ...sheetConfig,
    scriptUrl: sheetConfig.scriptUrl || sheetConfig.appsScriptUrl || '',
    appsScriptUrl: sheetConfig.scriptUrl || sheetConfig.appsScriptUrl || '',
  });
  const [isCopied, setIsCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const generatedScript = generateGoogleAppsScript(sheetForm.sheetName || 'Attendance_Logs');

  const handleUseCurrentLocation = () => {
    if (!currentGeo) {
      alert('ยังไม่สามารถตรวจจับพิกัดปัจจุบันได้ กรุณาเปิด GPS/Location ในอุปกรณ์');
      return;
    }
    setOfficeForm((prev) => ({
      ...prev,
      latitude: currentGeo.latitude,
      longitude: currentGeo.longitude,
    }));
    sound.playSuccess();
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanConfig: GoogleSheetConfig = {
      ...sheetForm,
      scriptUrl: (sheetForm.scriptUrl || sheetForm.appsScriptUrl || '').trim(),
      appsScriptUrl: (sheetForm.scriptUrl || sheetForm.appsScriptUrl || '').trim(),
    };
    onSaveOfficeConfig(officeForm);
    onSaveSheetConfig(cleanConfig);
    sound.playSuccess();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(generatedScript);
    setIsCopied(true);
    sound.playSuccess();
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleTestConnection = async () => {
    const cleanUrl = (sheetForm.scriptUrl || sheetForm.appsScriptUrl || '').trim();
    if (!cleanUrl) {
      sound.playError();
      setTestResult({
        success: false,
        message: 'กรุณากรอก Google Apps Script Webhook URL ก่อนกดทดสอบ',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    sound.playScanStart();

    const configToTest: GoogleSheetConfig = {
      ...sheetForm,
      scriptUrl: cleanUrl,
      appsScriptUrl: cleanUrl,
    };

    const res = await testGoogleSheetsConnection(configToTest);
    setIsTesting(false);

    if (res.success) {
      sound.playSuccess();
      setTestResult({
        success: true,
        message: 'เชื่อมต่อและส่งข้อมูลทดสอบเข้า Google Sheets สำเร็จเรียบร้อยแล้ว! (สามารถเปิดดูแถวข้อมูลใหม่ใน Google Sheet ของคุณได้ทันที)',
      });
    } else {
      sound.playError();
      setTestResult({
        success: false,
        message: res.message,
      });
    }
  };

  const isScriptUrlConfigured = Boolean(sheetForm.scriptUrl?.trim() || sheetForm.appsScriptUrl?.trim());

  return (
    <div className="space-y-6">
      
      {/* Settings Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-indigo-400" />
            <span>ตั้งค่าระบบพิกัด GPS & เชื่อมต่อ Google Sheets</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            กำหนดขอบเขตพิกัดสำนักงาน, เวลาเริ่ม-สิ้นสุดปฏิบัติงาน และตั้งค่า Webhook Google Sheets
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold animate-bounce shadow-[0_0_10px_rgba(52,211,153,0.3)]">
            <CheckCircle2 className="w-4 h-4" />
            <span>บันทึกการตั้งค่าเรียบร้อยแล้ว</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Section 1: Office GPS & Geofence Settings */}
          <div className="glass-panel rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-400" />
                <span>พิกัดสถานที่ปฏิบัติงาน & ขอบเขต Geofencing</span>
              </h3>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 font-semibold cursor-pointer transition flex items-center gap-1.5 border border-indigo-500/30"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>ใช้พิกัดปัจจุบัน</span>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">ชื่อสถานที่ / อาคาร</label>
                <input
                  type="text"
                  value={officeForm.name}
                  onChange={(e) => setOfficeForm({ ...officeForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 backdrop-blur-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">ละติจูด (Latitude)</label>
                  <input
                    type="number"
                    step="any"
                    value={officeForm.latitude}
                    onChange={(e) => setOfficeForm({ ...officeForm, latitude: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 backdrop-blur-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">ลองจิจูด (Longitude)</label>
                  <input
                    type="number"
                    step="any"
                    value={officeForm.longitude}
                    onChange={(e) => setOfficeForm({ ...officeForm, longitude: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 backdrop-blur-md"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-300">รัศมีที่อนุญาตให้ลงเวลา (Geofence Radius)</label>
                  <span className="font-bold text-indigo-400">{officeForm.radiusMeters} เมตร</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="5000"
                  step="50"
                  value={officeForm.radiusMeters}
                  onChange={(e) => setOfficeForm({ ...officeForm, radiusMeters: Number(e.target.value) })}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>50 ม. (ในอาคาร)</span>
                  <span>800 ม. (บริเวณหน่วยงาน)</span>
                  <span>5,000 ม. (เขตอำเภอ)</span>
                </div>
              </div>

              {/* Work Hours Config */}
              <div className="pt-3 border-t border-white/10 grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">เวลาเริ่มงาน</label>
                  <input
                    type="time"
                    value={officeForm.workStartTime}
                    onChange={(e) => setOfficeForm({ ...officeForm, workStartTime: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 backdrop-blur-md [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">เวลาเลิกงาน</label>
                  <input
                    type="time"
                    value={officeForm.workEndTime}
                    onChange={(e) => setOfficeForm({ ...officeForm, workEndTime: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 backdrop-blur-md [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">อนุโลมสาย (นาที)</label>
                  <input
                    type="number"
                    value={officeForm.lateThresholdMinutes}
                    onChange={(e) => setOfficeForm({ ...officeForm, lateThresholdMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 backdrop-blur-md"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Section 2: Google Sheets Connection Settings */}
          <div className="glass-panel rounded-2xl p-6 space-y-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <span>การเชื่อมต่อ Google Sheets Real-time</span>
                </h3>
                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 ${
                  isScriptUrlConfigured
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isScriptUrlConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span>{isScriptUrlConfigured ? 'ตั้งค่า Webhook แล้ว' : 'รอใส่ Webhook URL'}</span>
                </span>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Google Apps Script Webhook URL (ลงท้ายด้วย /exec)</span>
                    <span className="text-[10px] text-indigo-400 font-bold">จำเป็นสำหรับการส่งข้อมูล</span>
                  </label>
                  <input
                    type="url"
                    value={sheetForm.scriptUrl || ''}
                    readOnly
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-emerald-400 focus:outline-none cursor-not-allowed opacity-70 backdrop-blur-md"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    นำ Web App URL จากการกด <strong>Deploy → New deployment → Web app</strong> มาวางที่นี่
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">
                      ชื่อ Sheet Tab ใน Spreadsheet
                    </label>
                    <input
                      type="text"
                      value={sheetForm.sheetName || 'Attendance_Logs'}
                      readOnly
                      className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none cursor-not-allowed opacity-70 backdrop-blur-md"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">
                      Google Spreadsheet ID (ทางเลือก)
                    </label>
                    <input
                      type="text"
                      value={sheetForm.sheetId || ''}
                      readOnly
                      placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                      className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-slate-400 focus:outline-none cursor-not-allowed opacity-70 backdrop-blur-md"
                    />
                  </div>
                </div>

                {/* Test Connection Button & Result */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition active:scale-98 disabled:opacity-50"
                  >
                    {isTesting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                        <span>กำลังทดสอบส่งข้อมูลไปยัง Google Sheets...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                        <span>ทดสอบส่งข้อมูลเข้า Google Sheets เดี๋ยวนี้ (Test Webhook)</span>
                      </>
                    )}
                  </button>

                  {testResult && (
                    <div
                      className={`mt-2.5 p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
                        testResult.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold">
                          {testResult.success ? 'การทดสอบสำเร็จ' : 'การทดสอบไม่สำเร็จ'}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-relaxed">{testResult.message}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Status Box */}
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2 text-xs backdrop-blur-md">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold">สถานะการทำงาน:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5 text-glow">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
                  บันทึกทั้ง Local + Google Sheets อัตโนมัติ
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">
                เมื่อพนักงานสแกนใบหน้าและถ่ายรูป ระบบจะบันทึกในเครื่องทันทีและซิงค์ข้อมูลแถวใหม่ไปยัง Google Sheet
              </p>
            </div>

          </div>

        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            id="btn-save-settings"
            type="submit"
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center gap-2 cursor-pointer transition active:scale-98"
          >
            <Save className="w-4 h-4" />
            <span>บันทึกการตั้งค่าทั้งหมด</span>
          </button>
        </div>

      </form>

      {/* Interactive Google Apps Script Deployment Code & Guide */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Code className="w-5 h-5 text-indigo-400" />
              <span>โค้ด Google Apps Script & วิธีตั้งค่าให้ข้อมูลเข้า Google Sheets</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              ทำตาม 4 ขั้นตอนนี้เพื่อเชื่อมต่อ Google Spreadsheet เข้ากับระบบสแกนใบหน้า
            </p>
          </div>

          <button
            id="btn-copy-apps-script"
            type="button"
            onClick={handleCopyScript}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            {isCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{isCopied ? 'คัดลอกสำเร็จแล้ว ✓' : 'คัดลอกโค้ด Apps Script'}</span>
          </button>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-1.5 backdrop-blur-md">
            <span className="font-bold text-indigo-400">ขั้นตอนที่ 1</span>
            <h5 className="font-semibold text-white">สร้าง Google Sheet</h5>
            <p className="text-slate-400 text-[11px]">
              เปิด <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-semibold">sheets.new</a> เพื่อสร้าง Google Spreadsheet ใหม่
            </p>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-1.5 backdrop-blur-md">
            <span className="font-bold text-indigo-400">ขั้นตอนที่ 2</span>
            <h5 className="font-semibold text-white">เปิด Apps Script</h5>
            <p className="text-slate-400 text-[11px]">
              ไปที่เมนู <strong>ส่วนขยาย (Extensions)</strong> → <strong>Apps Script</strong>
            </p>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-1.5 backdrop-blur-md">
            <span className="font-bold text-indigo-400">ขั้นตอนที่ 3</span>
            <h5 className="font-semibold text-white">วางโค้ด & บันทึก</h5>
            <p className="text-slate-400 text-[11px]">
              ลบโค้ดเดิมทั้งหมด วางโค้ดด้านล่างนี้ลงไป แล้วกดไอคอน <strong>บันทึก (Save)</strong>
            </p>
          </div>
          <div className="p-4 bg-indigo-500/20 rounded-xl border border-indigo-500/40 space-y-1.5 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <span className="font-bold text-indigo-300">ขั้นตอนที่ 4 (สำคัญที่สุด!)</span>
            <h5 className="font-semibold text-indigo-100">Deploy เป็น Web App</h5>
            <p className="text-indigo-200 text-[11px]">
              กด <strong>ทำให้ใช้งานได้ (Deploy)</strong> → <strong>การทำให้ใช้งานได้ใหม่ (New deployment)</strong> → เลือก <strong>เว็บแอป (Web app)</strong>
            </p>
            <div className="text-[10px] bg-slate-900/50 p-2 rounded-lg border border-indigo-500/30 text-indigo-200 font-medium">
              ⚠️ กำหนด <strong>"ผู้มีสิทธิ์เข้าถึง (Who has access)"</strong> = <strong>"ทุกคน (Anyone)"</strong>
            </div>
          </div>
        </div>

        {/* Troubleshooting / FAQ Checklist */}
        <div className="p-4.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5 text-xs text-amber-200">
          <div className="font-bold flex items-center gap-2 text-amber-400">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>สาเหตุที่ข้อมูลยังไม่เข้า Google Sheet และวิธีแก้ไข:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-100/80 leading-relaxed">
            <li>
              <strong>ยังไม่ได้ใส่ Webhook URL:</strong> ต้องนำ URL จากขั้นตอนการ Deploy ที่ลงท้ายด้วย <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono text-amber-300 font-bold">/exec</code> มาวางในช่อง <strong>"Google Apps Script Webhook URL"</strong> ด้านบนแล้วกดบันทึก
            </li>
            <li>
              <strong>สิทธิ์การเข้าถึงไม่ได้เลือก Anyone:</strong> ในหน้า Deploy ของ Google Apps Script ช่อง <em>"ผู้มีสิทธิ์เข้าถึง (Who has access)"</em> ต้องเลือกเป็น <strong>"ทุกคน (Anyone)"</strong> เท่านั้น หากเลือก "ฉันคนเดียว (Only myself)" ทาง Google จะบล็อกการส่งข้อมูล
            </li>
            <li>
              <strong>เมื่อมีการแก้ไขโค้ด Apps Script:</strong> ต้องกด <em>Deploy → Manage deployments (จัดการการทำให้ใช้งานได้) → กดไอคอนดินสอแก้ไข → เลือก Version "New version"</em> เพื่อให้โค้ดใหม่มีผล
            </li>
          </ul>
        </div>

        {/* Code Block Container */}
        <div className="relative bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xs">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700 text-[11px] text-slate-300 font-mono">
            <span>Code.gs (Google Apps Script)</span>
            <span>JavaScript / Google Workspace</span>
          </div>
          <pre className="p-4 text-xs font-mono text-emerald-400 overflow-x-auto max-h-72 leading-relaxed">
            <code>{generatedScript}</code>
          </pre>
        </div>

      </div>

    </div>
  );
};
