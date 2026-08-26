import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Camera,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Layers,
  Building,
  Calendar,
  Phone,
  Mail,
  ShieldAlert,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Employee, FacePhotoItem } from '../types';
import { FaceDatasetModal } from './FaceDatasetModal';
import { sound } from '../utils/soundUtils';

interface EmployeeManagementProps {
  employees: Employee[];
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onUpdateDataset: (employeeId: string, dataset: FacePhotoItem[]) => void;
}

export const EmployeeManagement: React.FC<EmployeeManagementProps> = ({
  employees,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onUpdateDataset,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  
  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [datasetModalTarget, setDatasetModalTarget] = useState<Employee | null>(null);

  // In-app Delete Confirmation Modal for single item
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  // Form State for Adding / Editing Employee
  const [formData, setFormData] = useState({
    id: '',
    fullName: '',
    position: '',
    level: 'ระดับชำนาญการ (C7)',
    department: 'ฝ่ายเทคโนโลยีสารสนเทศและการสื่อสาร',
    age: 30,
    phone: '',
    email: '',
  });

  const departmentList = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.position.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDepartment === 'ALL' || emp.department === selectedDepartment;
    return matchesSearch && matchesDept;
  });

  const openAddModal = () => {
    setEditingEmployee(null);
    const nextId = `PEA-${String(employees.length + 1).padStart(3, '0')}`;
    setFormData({
      id: nextId,
      fullName: '',
      position: '',
      level: 'ระดับปฏิบัติการ (C5)',
      department: departmentList[0] || 'ฝ่ายปฏิบัติการและบำรุงรักษา',
      age: 28,
      phone: '',
      email: '',
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      id: emp.id,
      fullName: emp.fullName,
      position: emp.position,
      level: emp.level,
      department: emp.department,
      age: emp.age,
      phone: emp.phone || '',
      email: emp.email || '',
    });
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) return;

    if (editingEmployee) {
      const updated: Employee = {
        ...editingEmployee,
        fullName: formData.fullName.trim(),
        position: formData.position.trim(),
        level: formData.level,
        department: formData.department,
        age: Number(formData.age) || 25,
        phone: formData.phone.trim(),
        email: formData.email.trim(),
      };
      onUpdateEmployee(updated);
      sound.playSuccess();
    } else {
      const newEmp: Employee = {
        id: formData.id || `PEA-${Date.now().toString().slice(-4)}`,
        fullName: formData.fullName.trim(),
        position: formData.position.trim(),
        level: formData.level,
        department: formData.department,
        age: Number(formData.age) || 25,
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        faceDataset: [],
        avatarUrl: '',
        registeredAt: new Date().toISOString(),
        status: 'active',
      };
      onAddEmployee(newEmp);
      sound.playSuccess();
    }
    setIsFormModalOpen(false);
  };

  // Confirm Single Delete
  const handleConfirmSingleDelete = () => {
    if (!employeeToDelete) return;
    onDeleteEmployee(employeeToDelete.id);
    setEmployeeToDelete(null);
    sound.playSuccess();
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-indigo-400" />
            <span>ทะเบียนประวัติบุคลากร & Dataset ใบหน้า 3 รูป</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            พนักงานทั้งหมดในระบบ: <strong className="text-white font-semibold">{employees.length} คน</strong> • รองรับการบันทึกรูป 3 มุมมอง
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Add Employee Button */}
          <button
            id="btn-add-employee"
            type="button"
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(99,102,241,0.4)] active:scale-98 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>เพิ่มพนักงานใหม่</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* Search Input */}
        <div className="md:col-span-7 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="input-search-employee"
            type="text"
            placeholder="ค้นหาด้วยชื่อ-นามสกุล, รหัสพนักงาน หรือตำแหน่ง..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 shadow-inner transition backdrop-blur-md"
          />
        </div>

        {/* Department Filter */}
        <div className="md:col-span-5 relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            id="select-dept-filter"
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="w-full pl-11 pr-8 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 shadow-inner transition appearance-none backdrop-blur-md cursor-pointer"
          >
            <option value="ALL" className="bg-slate-900 text-white">ทุกแผนก / ทุกฝ่าย ({employees.length} คน)</option>
            {departmentList.map((dept) => (
              <option key={dept} value={dept} className="bg-slate-900 text-white">
                {dept}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Employee Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map((emp) => {
          const datasetCount = emp.faceDataset?.length || 0;
          const isDatasetComplete = datasetCount >= 3;

          return (
            <div
              key={emp.id}
              className="glass-card rounded-2xl p-5 shadow-[0_0_20px_rgba(0,0,0,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.15)] hover:-translate-y-1 transition-all flex flex-col justify-between space-y-4 relative"
            >
              
              {/* Card Header: Avatar & Main Info */}
              <div className="flex items-start gap-3.5">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-900 border border-white/10 flex-shrink-0 flex items-center justify-center">
                  {emp.faceDataset && emp.faceDataset[0] ? (
                    <img
                      src={emp.faceDataset[0].dataUrl}
                      alt={emp.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : emp.avatarUrl ? (
                    <img
                      src={emp.avatarUrl}
                      alt={emp.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Users className="w-7 h-7 text-slate-600" />
                  )}
                  <span className="absolute bottom-0 right-0 px-1 text-[9px] font-bold bg-indigo-600 text-white rounded-tl">
                    {emp.id}
                  </span>
                </div>

                <div className="flex-1 min-w-0 pr-6">
                  <h3 className="font-bold text-base text-white truncate">{emp.fullName}</h3>
                  <p className="text-xs text-indigo-400 font-semibold truncate flex items-center gap-1">
                    <Briefcase className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{emp.position}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    <span className="truncate">{emp.level}</span>
                  </p>
                </div>
              </div>

              {/* Card Details: Department, Age, Contact */}
              <div className="space-y-1.5 text-xs text-slate-400 bg-black/20 rounded-xl p-3 border border-white/5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">สังกัดฝ่าย:</span>
                  <span className="font-medium text-slate-300 truncate max-w-[170px]">{emp.department}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">อายุ:</span>
                  <span className="font-medium text-slate-300">{emp.age} ปี</span>
                </div>
                {emp.phone && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">เบอร์โทร:</span>
                    <span className="font-mono text-slate-300">{emp.phone}</span>
                  </div>
                )}
              </div>

              {/* Dataset Status Progress */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-400 font-medium flex items-center gap-1">
                    <Camera className="w-3 h-3 text-slate-500" />
                    <span>ชุดภาพ Dataset</span>
                  </span>
                  <span
                    className={`font-bold text-[11px] ${
                      isDatasetComplete ? 'text-emerald-400 text-glow' : 'text-amber-400'
                    }`}
                  >
                    {datasetCount}/3 มุมมอง {isDatasetComplete && '✓'}
                  </span>
                </div>

                {/* 3-dot Angle Indicator */}
                <div className="grid grid-cols-3 gap-1.5">
                  {[1, 2, 3].map((angleIdx) => {
                    const hasAngle = emp.faceDataset?.some((item) => item.angleIndex === angleIdx);
                    return (
                      <div
                        key={angleIdx}
                        className={`h-1.5 rounded-full transition-all ${
                          hasAngle ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]' : 'bg-white/10'
                        }`}
                        title={`มุม ${angleIdx}: ${hasAngle ? 'บันทึกแล้ว' : 'ยังไม่ได้ถ่าย'}`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Card Action Buttons */}
              <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                <button
                  id={`btn-open-dataset-${emp.id}`}
                  type="button"
                  onClick={() => setDatasetModalTarget(emp)}
                  className="flex-1 py-2 px-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-400/30 text-indigo-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{datasetCount === 0 ? 'ถ่ายรูป 3 มุม' : 'จัดการ Dataset'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openEditModal(emp)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/20 border border-white/10 text-slate-300 hover:text-white transition cursor-pointer"
                  title="แก้ไขประวัติข้อมูล"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>

                {/* Trash Button - Opens in-app confirmation modal */}
                <button
                  id={`btn-delete-emp-${emp.id}`}
                  type="button"
                  onClick={() => setEmployeeToDelete(emp)}
                  className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/30 border border-rose-500/20 text-rose-400 hover:text-rose-300 transition cursor-pointer"
                  title={`ลบข้อมูลพนักงาน ${emp.fullName}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="text-center py-16 glass-panel rounded-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <h4 className="font-bold text-white text-base">
              {employees.length === 0 ? 'ยังไม่มีข้อมูลพนักงานในระบบ' : 'ไม่พบข้อมูลพนักงานที่ค้นหา'}
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {employees.length === 0
                ? 'กดปุ่ม "เพิ่มพนักงานใหม่" เพื่อเริ่มต้นลงทะเบียนบุคลากรเข้าสู่ระบบ'
                : 'ลองปรับเปลี่ยนคำค้นหา หรือเลือกตัวกรองแผนกใหม่'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.5)]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>เพิ่มพนักงานใหม่</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* In-App Delete Confirmation Modal: Single Employee */}
      {/* ========================================================================= */}
      {employeeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 text-slate-800 space-y-4">
            
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">ยืนยันการลบข้อมูลพนักงาน</h3>
                <p className="text-xs text-slate-500">การดำเนินการนี้ไม่สามารถยกเลิกได้</p>
              </div>
            </div>

            {/* Employee Preview Box */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                {employeeToDelete.faceDataset && employeeToDelete.faceDataset[0] ? (
                  <img
                    src={employeeToDelete.faceDataset[0].dataUrl}
                    alt={employeeToDelete.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : employeeToDelete.avatarUrl ? (
                  <img
                    src={employeeToDelete.avatarUrl}
                    alt={employeeToDelete.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Users className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-slate-900 truncate">{employeeToDelete.fullName}</div>
                <div className="text-xs text-slate-500">{employeeToDelete.id} • {employeeToDelete.position}</div>
                <div className="text-[11px] text-slate-400 truncate">{employeeToDelete.department}</div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลพนักงาน <strong>"{employeeToDelete.fullName}"</strong> ออกจากระบบ? ข้อมูลประวัติและชุดภาพ Face Recognition Dataset ({employeeToDelete.faceDataset?.length || 0} รูป) จะถูกลบออกทันที
            </p>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEmployeeToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                id="btn-confirm-single-delete"
                type="button"
                onClick={handleConfirmSingleDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-200 transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ยืนยันลบข้อมูล</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Add / Edit Employee Profile Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 text-slate-800 my-8">
            
            <div className="flex items-center justify-between pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">
                    {editingEmployee ? 'แก้ไขประวัติข้อมูลพนักงาน' : 'เพิ่มประวัติข้อมูลพนักงานใหม่'}
                  </h3>
                  <p className="text-xs text-slate-500">บันทึกข้อมูลเพื่อใช้สำหรับการระบุตัวตนและลงเวลา</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="mt-6 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Employee ID */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    รหัสพนักงาน (Employee ID) <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    id="input-form-empid"
                    type="text"
                    required
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    placeholder="เช่น PEA-005"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ชื่อ-นามสกุล (Full Name) <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    id="input-form-fullname"
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="เช่น นายสมชาย สายใจดี"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ตำแหน่ง (Position) <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    id="input-form-position"
                    type="text"
                    required
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="เช่น วิศวกรไฟฟ้า"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Level */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ระดับ (Level) <span className="text-indigo-600">*</span>
                  </label>
                  <select
                    id="select-form-level"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ระดับปฏิบัติการ (C5)">ระดับปฏิบัติการ (C5)</option>
                    <option value="ระดับชำนาญการ (C7)">ระดับชำนาญการ (C7)</option>
                    <option value="ระดับชำนาญการพิเศษ (C8)">ระดับชำนาญการพิเศษ (C8)</option>
                    <option value="ระดับเชี่ยวชาญ (C9)">ระดับเชี่ยวชาญ (C9)</option>
                    <option value="ระดับทรงคุณวุฒิ (C10)">ระดับทรงคุณวุฒิ (C10)</option>
                    <option value="เจ้าหน้าที่ปฏิบัติงานทั่วไป">เจ้าหน้าที่ปฏิบัติงานทั่วไป</option>
                    <option value="หัวหน้าฝ่าย / ผู้จัดการ">หัวหน้าฝ่าย / ผู้จัดการ</option>
                  </select>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    แผนก / ฝ่าย (Department) <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    id="input-form-department"
                    type="text"
                    required
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="เช่น ฝ่ายปฏิบัติการและบำรุงรักษา"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Age */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    อายุ (Age) <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    id="input-form-age"
                    type="number"
                    min="18"
                    max="99"
                    required
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    เบอร์โทรศัพท์ (Phone)
                  </label>
                  <input
                    id="input-form-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="เช่น 081-234-5678"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    อีเมลองค์กร (Email)
                  </label>
                  <input
                    id="input-form-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="เช่น employee@pea.co.th"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

              </div>

              {/* Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  id="btn-submit-employee-form"
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition cursor-pointer"
                >
                  {editingEmployee ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลพนักงาน'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 5-Photo Face Dataset Capture Modal */}
      {datasetModalTarget && (
        <FaceDatasetModal
          employee={datasetModalTarget}
          isOpen={!!datasetModalTarget}
          onClose={() => setDatasetModalTarget(null)}
          onSaveDataset={onUpdateDataset}
        />
      )}

    </div>
  );
};
