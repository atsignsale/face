import { createClient } from '@supabase/supabase-js';
import { Employee, AttendanceRecord, OfficeConfig, GoogleSheetConfig, FacePhotoItem } from '../types';

// TODO: นำค่า URL และ Anon Key จาก Supabase Project settings มาใส่ที่นี่
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// ตรวจสอบว่าได้ตั้งค่า Supabase จริงๆ แล้วหรือไม่ (ไม่ใช่ค่า default หรือค่าตัวอย่าง)
const isSupabaseConfigured = 
  supabaseUrl && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' && 
  !supabaseUrl.includes('YOUR-PROJECT-ID') &&
  supabaseUrl.startsWith('https://');

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
}) : null as any;

// --- Helper Functions for LocalStorage Fallback ---
const getLocalItem = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

const setLocalItem = <T>(key: string, value: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving to localStorage:`, e);
  }
};

// --- Employees API ---
export const fetchEmployees = async (): Promise<Employee[]> => {
  if (!isSupabaseConfigured) {
    return getLocalItem<Employee[]>('face_employees', []);
  }

  const { data, error } = await supabase
    .from('employees')
    .select(`
      *,
      face_datasets (*)
    `);
  if (error) {
    console.error('Error fetching employees:', error);
    return [];
  }
  
  return data.map((emp: any) => ({
    id: emp.id,
    fullName: emp.full_name,
    position: emp.position || '',
    level: emp.level || '',
    department: emp.department || '',
    age: emp.age || 0,
    phone: emp.phone || '',
    email: emp.email || '',
    avatarUrl: emp.avatar_url || '',
    registeredAt: emp.registered_at || new Date().toISOString(),
    status: emp.status || 'active',
    faceDataset: emp.face_datasets?.map((ds: any) => ({
      id: ds.id,
      angleIndex: ds.angle_index,
      angleName: ds.angle_name,
      dataUrl: ds.data_url,
      capturedAt: ds.captured_at
    })) || []
  }));
};

export const saveEmployee = async (employee: Employee) => {
  if (!isSupabaseConfigured) {
    const emps = getLocalItem<Employee[]>('face_employees', []);
    const index = emps.findIndex(e => e.id === employee.id);
    if (index > -1) {
      emps[index] = employee;
    } else {
      emps.push(employee);
    }
    setLocalItem('face_employees', emps);
    return;
  }

  // 1. Save Employee data
  const { error: empError } = await supabase.from('employees').upsert({
    id: employee.id,
    full_name: employee.fullName,
    position: employee.position,
    level: employee.level,
    department: employee.department,
    age: employee.age,
    phone: employee.phone,
    email: employee.email,
    avatar_url: employee.avatarUrl,
    registered_at: employee.registeredAt,
    status: employee.status
  });
  if (empError) console.error('Error saving employee:', empError);

  // 2. Save Face Dataset if exists
  if (employee.faceDataset && employee.faceDataset.length > 0) {
    // Clear old dataset for this employee
    await supabase.from('face_datasets').delete().eq('employee_id', employee.id);
    
    // Insert new dataset
    const datasetToInsert = employee.faceDataset.map(ds => ({
      id: ds.id,
      employee_id: employee.id,
      angle_index: ds.angleIndex,
      angle_name: ds.angleName,
      data_url: ds.dataUrl,
      captured_at: ds.capturedAt
    }));
    
    const { error: dsError } = await supabase.from('face_datasets').insert(datasetToInsert);
    if (dsError) console.error('Error saving face dataset:', dsError);
  }
};

export const deleteEmployee = async (id: string) => {
  if (!isSupabaseConfigured) {
    const emps = getLocalItem<Employee[]>('face_employees', []);
    setLocalItem('face_employees', emps.filter(e => e.id !== id));
    return;
  }

  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) console.error('Error deleting employee:', error);
};

export const deleteMultipleEmployees = async (ids: string[]) => {
  if (!isSupabaseConfigured) {
    const emps = getLocalItem<Employee[]>('face_employees', []);
    setLocalItem('face_employees', emps.filter(e => !ids.includes(e.id)));
    return;
  }

  const { error } = await supabase.from('employees').delete().in('id', ids);
  if (error) console.error('Error deleting employees:', error);
}

export const deleteAllEmployees = async () => {
  if (!isSupabaseConfigured) {
    setLocalItem('face_employees', []);
    return;
  }

  const { error } = await supabase.from('employees').delete().neq('id', 'dummy');
  if (error) console.error('Error deleting all employees:', error);
}

// --- Attendance API ---
export const fetchAttendanceRecords = async (): Promise<AttendanceRecord[]> => {
  if (!isSupabaseConfigured) {
    const records = getLocalItem<AttendanceRecord[]>('face_attendance', []);
    // Sort descending by timestamp
    return records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  const { data, error } = await supabase.from('attendance_records').select('*').order('timestamp', { ascending: false });
  if (error) {
    console.error('Error fetching attendance records:', error);
    return [];
  }
  return data.map((rec: any) => ({
    id: rec.id,
    employeeId: rec.employee_id,
    employeeName: rec.employee_name,
    position: rec.position || '',
    level: rec.level || '',
    department: rec.department || '',
    age: rec.age || 0,
    type: rec.type,
    timestamp: rec.timestamp,
    timeFormatted: rec.time_formatted,
    dateFormatted: rec.date_formatted,
    status: rec.status,
    capturedPhoto: rec.captured_photo,
    confidenceScore: rec.confidence_score,
    matchReason: rec.match_reason,
    location: {
      latitude: rec.location_lat,
      longitude: rec.location_lng,
      accuracy: rec.location_accuracy,
      inOfficeZone: rec.in_office_zone,
      distanceFromOfficeMeters: rec.distance_from_office_meters
    },
    syncedToGoogleSheets: rec.synced_to_google_sheets,
    googleSheetRowId: rec.google_sheet_row_id,
    device: rec.device,
    notes: rec.notes
  }));
};

export const saveAttendanceRecord = async (record: AttendanceRecord) => {
  if (!isSupabaseConfigured) {
    const records = getLocalItem<AttendanceRecord[]>('face_attendance', []);
    const index = records.findIndex(r => r.id === record.id);
    if (index > -1) {
      records[index] = record;
    } else {
      records.push(record);
    }
    setLocalItem('face_attendance', records);
    return;
  }

  const { error } = await supabase.from('attendance_records').upsert({
    id: record.id,
    employee_id: record.employeeId,
    employee_name: record.employeeName,
    position: record.position,
    level: record.level,
    department: record.department,
    age: record.age,
    type: record.type,
    timestamp: record.timestamp,
    time_formatted: record.timeFormatted,
    date_formatted: record.dateFormatted,
    status: record.status,
    captured_photo: record.capturedPhoto,
    confidence_score: record.confidenceScore,
    match_reason: record.matchReason,
    location_lat: record.location.latitude,
    location_lng: record.location.longitude,
    location_accuracy: record.location.accuracy,
    in_office_zone: record.location.inOfficeZone,
    distance_from_office_meters: record.location.distanceFromOfficeMeters,
    synced_to_google_sheets: record.syncedToGoogleSheets,
    google_sheet_row_id: record.googleSheetRowId,
    device: record.device,
    notes: record.notes
  });
  if (error) console.error('Error saving attendance record:', error);
};

export const deleteAttendanceRecord = async (id: string) => {
  if (!isSupabaseConfigured) {
    const records = getLocalItem<AttendanceRecord[]>('face_attendance', []);
    setLocalItem('face_attendance', records.filter(r => r.id !== id));
    return;
  }

  const { error } = await supabase.from('attendance_records').delete().eq('id', id);
  if (error) console.error('Error deleting attendance record:', error);
};

export const deleteAllAttendanceRecords = async () => {
  if (!isSupabaseConfigured) {
    setLocalItem('face_attendance', []);
    return;
  }

  const { error } = await supabase.from('attendance_records').delete().neq('id', 'dummy');
  if (error) console.error('Error deleting all attendance records:', error);
};

// --- App Settings API ---
export const fetchAppSetting = async <T>(key: string, defaultValue: T): Promise<T> => {
  if (!isSupabaseConfigured) {
    return getLocalItem<T>(`face_setting_${key}`, defaultValue);
  }

  const { data, error } = await supabase.from('app_settings').select('config_value').eq('config_key', key).maybeSingle();
  if (error || !data) {
    return defaultValue;
  }
  return data.config_value as T;
};

export const saveAppSetting = async (key: string, value: any) => {
  if (!isSupabaseConfigured) {
    setLocalItem(`face_setting_${key}`, value);
    return;
  }

  const { error } = await supabase.from('app_settings').upsert({
    config_key: key,
    config_value: value
  });
  if (error) console.error(`Error saving setting ${key}:`, error);
};
