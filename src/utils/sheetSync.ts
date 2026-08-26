import { AttendanceRecord, GoogleSheetConfig } from '../types';

export interface SheetSyncResult {
  success: boolean;
  message: string;
  syncedRecordId?: string;
  sheetRowIndex?: number;
}

/**
 * Prepares an AttendanceRecord row formatted for Google Sheets
 */
export function formatRecordForSheet(record: AttendanceRecord): Record<string, unknown> {
  return {
    recordId: record.id,
    employeeId: record.employeeId,
    fullName: record.employeeName,
    position: record.position,
    level: record.level,
    department: record.department,
    age: record.age,
    type: record.type === 'CHECK_IN' ? 'ลงเวลาเข้างาน (Check-In)' : 'ลงเวลาออกงาน (Check-Out)',
    date: record.dateFormatted,
    time: record.timeFormatted,
    status:
      record.status === 'ON_TIME'
        ? 'เข้างานตรงเวลา'
        : record.status === 'LATE'
        ? 'เข้างานสาย'
        : record.status === 'EARLY_DEPARTURE'
        ? 'ออกก่อนเวลา'
        : 'ปกติ/ลงเวลาออก',
    confidence: `${record.confidenceScore.toFixed(1)}%`,
    latitude: record.location.latitude,
    longitude: record.location.longitude,
    locationAddress: record.location.address || '',
    inOfficeZone: record.location.inOfficeZone ? 'อยู่ในพื้นที่' : 'นอกพื้นที่',
    distanceFromOffice: `${record.location.distanceFromOfficeMeters} m`,
    googleMapsLink: `https://www.google.com/maps?q=${record.location.latitude},${record.location.longitude}`,
    matchReason: record.matchReason || '',
    device: record.device,
    timestamp: record.timestamp,
  };
}

/**
 * Syncs a single attendance record to Google Sheets via backend proxy or Google Apps Script Web App
 */
export async function syncRecordToGoogleSheets(
  record: AttendanceRecord,
  config: GoogleSheetConfig
): Promise<SheetSyncResult> {
  const scriptUrl = (config.scriptUrl || config.appsScriptUrl || '').trim();

  if (!scriptUrl) {
    return {
      success: false,
      message: 'ยังไม่ได้ระบุ Google Apps Script Webhook URL กรุณาไปที่เมนู "ตั้งค่า" เพื่อใส่ Webhook URL',
    };
  }

  try {
    const payload = {
      action: 'ADD_ROW',
      sheetName: config.sheetName || 'Attendance_Logs',
      sheetId: config.sheetId || '',
      scriptUrl: scriptUrl,
      data: formatRecordForSheet(record),
    };

    // First attempt via server proxy endpoint
    const response = await fetch('/api/google-sheets/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const resData = await response.json().catch(() => ({}));

    if (response.ok && resData.success) {
      return {
        success: true,
        message: resData.message || 'ซิงค์ข้อมูลลง Google Sheet สำเร็จ',
        syncedRecordId: record.id,
      };
    } else {
      return {
        success: false,
        message: resData.message || `เซิร์ฟเวอร์ตอบกลับสถานะ ${response.status}`,
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown sync error';
    return {
      success: false,
      message: `ไม่สามารถเชื่อมต่อ Google Sheets: ${errorMsg}`,
    };
  }
}

/**
 * Tests connection to the configured Google Apps Script Web App
 */
export async function testGoogleSheetsConnection(
  config: GoogleSheetConfig
): Promise<SheetSyncResult> {
  const scriptUrl = (config.scriptUrl || config.appsScriptUrl || '').trim();

  if (!scriptUrl) {
    return {
      success: false,
      message: 'กรุณากรอก Google Apps Script Webhook URL ก่อนกดทดสอบ',
    };
  }

  try {
    const testRecord: AttendanceRecord = {
      id: `TEST-${Date.now()}`,
      employeeId: 'TEST-001',
      employeeName: 'ทดสอบการเชื่อมต่อระบบ (Connection Test)',
      position: 'ระบบทดสอบ',
      level: 'Admin',
      department: 'ทดสอบระบบ',
      age: 30,
      type: 'CHECK_IN',
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString('th-TH', { hour12: false }),
      dateFormatted: new Date().toISOString().slice(0, 10),
      status: 'ON_TIME',
      capturedPhoto: '',
      confidenceScore: 100,
      matchReason: 'ทดสอบการรับส่งข้อมูล Google Apps Script',
      location: {
        latitude: 13.88345,
        longitude: 100.56582,
        accuracy: 5,
        address: 'จุดทดสอบระบบ',
        inOfficeZone: true,
        distanceFromOfficeMeters: 0,
      },
      syncedToGoogleSheets: false,
      device: 'Connection Test Engine',
    };

    return await syncRecordToGoogleSheets(testRecord, config);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการทดสอบ',
    };
  }
}

/**
 * Converts array of attendance records to CSV formatted string for direct download
 */
export function exportAttendanceToCSV(records: AttendanceRecord[]): void {
  const headers = [
    'ลำดับ (No.)',
    'รหัสพนักงาน (Emp ID)',
    'ชื่อ-นามสกุล (Name)',
    'ตำแหน่ง (Position)',
    'ระดับ (Level)',
    'แผนก (Department)',
    'อายุ (Age)',
    'ประเภท (Type)',
    'วันที่ (Date)',
    'เวลา (Time)',
    'สถานะ (Status)',
    'ความแม่นยำ AI (Confidence)',
    'ละติจูด (Latitude)',
    'ลองจิจูด (Longitude)',
    'ระยะห่าง (Distance m)',
    'พื้นที่หน่วยงาน (Zone)',
    'สถานที่ (Address)',
    'Google Maps Link',
    'อุปกรณ์ (Device)',
    'เวลาที่บันทึก (Timestamp)',
  ];

  const rows = records.map((r, idx) => [
    idx + 1,
    `"${r.employeeId}"`,
    `"${r.employeeName}"`,
    `"${r.position}"`,
    `"${r.level}"`,
    `"${r.department}"`,
    r.age,
    r.type === 'CHECK_IN' ? 'เข้างาน (Check-In)' : 'ออกงาน (Check-Out)',
    `"${r.dateFormatted}"`,
    `"${r.timeFormatted}"`,
    r.status === 'ON_TIME' ? 'ตรงเวลา' : r.status === 'LATE' ? 'สาย' : 'ออกงาน',
    `"${r.confidenceScore}%"`,
    r.location.latitude,
    r.location.longitude,
    r.location.distanceFromOfficeMeters,
    r.location.inOfficeZone ? 'ในพื้นที่' : 'นอกพื้นที่',
    `"${(r.location.address || '').replace(/"/g, '""')}"`,
    `"https://www.google.com/maps?q=${r.location.latitude},${r.location.longitude}"`,
    `"${r.device}"`,
    `"${r.timestamp}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `Attendance_Report_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates the Google Apps Script code to copy-paste into Google Sheets
 */
export function generateGoogleAppsScript(sheetName: string = 'Attendance_Logs'): string {
  return `/**
 * Google Apps Script สำหรับรับข้อมูลบันทึกลงเวลาจาก Face Recognition System
 * วางโค้ดนี้ใน Google Spreadsheet: Extensions -> Apps Script
 * จากนั้นกด Deploy -> New deployment -> Web app
 * ตั้งค่า Who has access: Anyone
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var sheet = getOrCreateSheet("${sheetName}");
    var data = JSON.parse(e.postData.contents);
    var rowData = data.data || data;
    
    // Check if header exists, if not initialize
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "รหัสรายการ",
        "รหัสพนักงาน",
        "ชื่อ-นามสกุล",
        "ตำแหน่ง",
        "ระดับ",
        "แผนก",
        "อายุ",
        "ประเภท",
        "วันที่",
        "เวลา",
        "สถานะ",
        "ความแม่นยำ AI",
        "ละติจูด",
        "ลองจิจูด",
        "ระยะห่าง (ม.)",
        "เขตพื้นที่",
        "สถานที่",
        "Google Maps Link",
        "อุปกรณ์",
        "Timestamp"
      ]);
      sheet.getRange(1, 1, 1, 20).setBackground("#0f172a").setFontColor("#38bdf8").setFontWeight("bold");
    }
    
    sheet.appendRow([
      rowData.recordId || "",
      rowData.employeeId || "",
      rowData.fullName || "",
      rowData.position || "",
      rowData.level || "",
      rowData.department || "",
      rowData.age || "",
      rowData.type || "",
      rowData.date || "",
      rowData.time || "",
      rowData.status || "",
      rowData.confidence || "",
      rowData.latitude || "",
      rowData.longitude || "",
      rowData.distanceFromOffice || "",
      rowData.inOfficeZone || "",
      rowData.locationAddress || "",
      rowData.googleMapsLink || "",
      rowData.device || "",
      rowData.timestamp || new Date().toISOString()
    ]);
    
    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", message: "บันทึกข้อมูลลงชีทเรียบร้อยแล้ว" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSheet(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}
`;
}
