export interface FacePhotoItem {
  id: string;
  angleIndex: number; // 1 to 3
  angleName: string; // 'หน้าตรง (Front)', 'หันซ้าย 20° (Slight Left)', 'หันขวา 20° (Slight Right)'
  dataUrl: string;
  capturedAt: string;
}

export interface Employee {
  id: string; // e.g. "EMP-001"
  fullName: string; // ชื่อ-นามสกุล
  position: string; // ตำแหน่ง
  level: string; // ระดับ
  department: string; // แผนก
  age: number; // อายุ
  phone?: string;
  email?: string;
  faceDataset: FacePhotoItem[]; // 3 photos dataset
  avatarUrl: string;
  registeredAt: string;
  status: 'active' | 'leave' | 'inactive';
}

export type AttendanceType = 'CHECK_IN' | 'CHECK_OUT';

export type AttendanceStatus = 'ON_TIME' | 'LATE' | 'OVERTIME' | 'EARLY_DEPARTURE' | 'NORMAL';

export interface GeoLocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
  inOfficeZone: boolean;
  distanceFromOfficeMeters: number;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  position: string;
  level: string;
  department: string;
  age: number;
  type: AttendanceType;
  timestamp: string; // ISO string
  timeFormatted: string; // e.g. "08:25:30"
  dateFormatted: string; // e.g. "2026-08-25"
  status: AttendanceStatus;
  capturedPhoto: string; // Live camera snapshot Base64
  confidenceScore: number; // 0 - 100%
  matchReason?: string;
  location: GeoLocationData;
  syncedToGoogleSheets: boolean;
  googleSheetRowId?: string;
  device: string;
  notes?: string;
}

export interface OfficeConfig {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  workStartTime: string; // "08:30"
  workEndTime: string; // "16:30"
  lateThresholdMinutes: number; // 15
}

export interface GoogleSheetConfig {
  scriptUrl: string; // Google Apps Script Web App URL
  appsScriptUrl?: string; // Alias
  sheetId: string; // Google Spreadsheet ID
  sheetName: string; // Tab name (e.g. "Attendance_Logs")
  autoSync: boolean;
  lastSyncTimestamp: string | null;
  totalSyncedCount: number;
}

export interface FaceMatchResult {
  matchedEmployeeId: string | null;
  matchedEmployee?: Employee;
  confidence: number;
  matchStatus: 'EXACT_MATCH' | 'HIGH_CONFIDENCE' | 'LOW_CONFIDENCE' | 'NO_MATCH';
  reason: string;
  isLivenessPass: boolean;
}
