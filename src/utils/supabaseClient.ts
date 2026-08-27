import { createClient } from '@supabase/supabase-js';
import { Employee, AttendanceRecord, OfficeConfig, GoogleSheetConfig, FacePhotoItem } from '../types';

// TODO: นำค่า URL และ Anon Key จาก Supabase Project settings มาใส่ที่นี่
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- Employees API ---
export const fetchEmployees = async (): Promise<Employee[]> => {
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
  const { error } = await supabase.from('employees').upsert({
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
  if (error) console.error('Error saving employee:', error);
};

export const deleteEmployee = async (id: string) => {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) console.error('Error deleting employee:', error);
};

export const deleteMultipleEmployees = async (ids: string[]) => {
  const { error } = await supabase.from('employees').delete().in('id', ids);
  if (error) console.error('Error deleting employees:', error);
}

export const deleteAllEmployees = async () => {
  const { error } = await supabase.from('employees').delete().neq('id', 'dummy');
  if (error) console.error('Error deleting all employees:', error);
}

// --- Attendance API ---
export const fetchAttendanceRecords = async (): Promise<AttendanceRecord[]> => {
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
  const { error } = await supabase.from('attendance_records').delete().eq('id', id);
  if (error) console.error('Error deleting attendance record:', error);
};

export const deleteAllAttendanceRecords = async () => {
  const { error } = await supabase.from('attendance_records').delete().neq('id', 'dummy');
  if (error) console.error('Error deleting all attendance records:', error);
};

// --- App Settings API ---
export const fetchAppSetting = async <T>(key: string, defaultValue: T): Promise<T> => {
  const { data, error } = await supabase.from('app_settings').select('config_value').eq('config_key', key).maybeSingle();
  if (error || !data) {
    return defaultValue;
  }
  return data.config_value as T;
};

export const saveAppSetting = async (key: string, value: any) => {
  const { error } = await supabase.from('app_settings').upsert({
    config_key: key,
    config_value: value
  });
  if (error) console.error(`Error saving setting ${key}:`, error);
};
