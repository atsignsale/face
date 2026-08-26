import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Info,
  Check,
} from 'lucide-react';
import { Employee, FacePhotoItem } from '../types';
import { ANGLE_DEFINITIONS } from '../data/initialData';
import { sound } from '../utils/soundUtils';

interface FaceDatasetModalProps {
  employee: Employee;
  isOpen: boolean;
  onClose: () => void;
  onSaveDataset: (employeeId: string, updatedDataset: FacePhotoItem[]) => void;
}

export const FaceDatasetModal: React.FC<FaceDatasetModalProps> = ({
  employee,
  isOpen,
  onClose,
  onSaveDataset,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [photos, setPhotos] = useState<FacePhotoItem[]>([]);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize or load existing employee dataset
  useEffect(() => {
    if (isOpen) {
      if (employee.faceDataset && employee.faceDataset.length > 0) {
        setPhotos([...employee.faceDataset]);
      } else {
        setPhotos([]);
      }
      setCurrentStepIndex(0);
      setShowSuccessPopup(false);
      startCamera();
    } else {
      stopCamera();
      setShowSuccessPopup(false);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, employee]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 720 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.warn('Cannot access camera:', err);
      setCameraError('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้อง หรือใช้การอัปโหลดรูปภาพ');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    sound.playScanStart();
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally for natural mirror feel
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const targetAngle = ANGLE_DEFINITIONS[currentStepIndex];

    const newPhotoItem: FacePhotoItem = {
      id: `face-${employee.id}-${targetAngle.index}-${Date.now()}`,
      angleIndex: targetAngle.index,
      angleName: targetAngle.name,
      dataUrl: dataUrl,
      capturedAt: new Date().toISOString(),
    };

    const handleDatasetPersist = async (updated: FacePhotoItem[]) => {
      try {
        const response = await fetch('/api/dataset/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: employee.id, dataset: updated })
        });
        const data = await response.json();
        if (data.success && data.updatedDataset) {
           onSaveDataset(employee.id, data.updatedDataset);
           setPhotos(data.updatedDataset);
        } else {
           console.error('Failed to upload dataset:', data.message);
           onSaveDataset(employee.id, updated);
        }
      } catch (e) {
        console.error('API Error:', e);
        onSaveDataset(employee.id, updated);
      }
    };

    setPhotos((prev) => {
      const filtered = prev.filter((p) => p.angleIndex !== targetAngle.index);
      const updated = [...filtered, newPhotoItem].sort((a, b) => a.angleIndex - b.angleIndex);
      
      handleDatasetPersist(updated);

      const isCompletedAll = ANGLE_DEFINITIONS.every((angle) =>
        updated.some((p) => p.angleIndex === angle.index)
      );

      if (isCompletedAll) {
        sound.playSuccess();
        setTimeout(() => {
          setShowSuccessPopup(true);
        }, 300);
      } else {
        sound.playSuccess();
        if (currentStepIndex < ANGLE_DEFINITIONS.length - 1) {
          setCurrentStepIndex((curr) => curr + 1);
        }
      }

      return updated;
    });
  }, [currentStepIndex, employee.id, onSaveDataset, photos]);

  const triggerCountdownCapture = () => {
    if (countdown !== null) return;
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          capturePhoto();
          return null;
        }
        return prev - 1;
      });
    }, 800);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const targetAngle = ANGLE_DEFINITIONS[currentStepIndex];
      const newPhotoItem: FacePhotoItem = {
        id: `face-${employee.id}-${targetAngle.index}-${Date.now()}`,
        angleIndex: targetAngle.index,
        angleName: targetAngle.name,
        dataUrl: dataUrl,
        capturedAt: new Date().toISOString(),
      };

      const handleDatasetPersist = async (updated: FacePhotoItem[]) => {
        try {
          const response = await fetch('/api/dataset/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId: employee.id, dataset: updated })
          });
          const data = await response.json();
          if (data.success && data.updatedDataset) {
             onSaveDataset(employee.id, data.updatedDataset);
             setPhotos(data.updatedDataset);
          } else {
             console.error('Failed to upload dataset:', data.message);
             onSaveDataset(employee.id, updated);
          }
        } catch (err) {
          console.error('API Error:', err);
          onSaveDataset(employee.id, updated);
        }
      };

      setPhotos((prev) => {
        const filtered = prev.filter((p) => p.angleIndex !== targetAngle.index);
        const updated = [...filtered, newPhotoItem].sort((a, b) => a.angleIndex - b.angleIndex);
        
        handleDatasetPersist(updated);

        const isCompletedAll = ANGLE_DEFINITIONS.every((angle) =>
          updated.some((p) => p.angleIndex === angle.index)
        );

        if (isCompletedAll) {
          sound.playSuccess();
          setTimeout(() => {
            setShowSuccessPopup(true);
          }, 300);
        } else {
          sound.playSuccess();
          if (currentStepIndex < ANGLE_DEFINITIONS.length - 1) {
            setCurrentStepIndex((curr) => curr + 1);
          }
        }

        return updated;
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = () => {
    setIsSaving(true);
    sound.playSuccess();

    if (photos.length >= ANGLE_DEFINITIONS.length) {
      setIsSaving(false);
      setShowSuccessPopup(true);
    } else {
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 400);
    }
  };

  const handleCloseCompletionPopup = () => {
    setShowSuccessPopup(false);
    onClose();
  };

  if (!isOpen) return null;

  const currentAngle = ANGLE_DEFINITIONS[currentStepIndex] || ANGLE_DEFINITIONS[0];
  const photoForCurrentAngle = photos.find((p) => p.angleIndex === currentAngle.index);
  const isAllCaptured = photos.length >= ANGLE_DEFINITIONS.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-slate-800 my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Camera className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                บันทึก Dataset ใบหน้า 3 มุมมอง
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {photos.length}/3 รูป
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                พนักงาน: <span className="text-slate-900 font-semibold">{employee.fullName}</span> ({employee.id}) • {employee.department}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left / Top: Live Camera Capture Area (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            
            {/* Step Progress Pills (3 steps) */}
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-50 rounded-xl border border-slate-200">
              {ANGLE_DEFINITIONS.map((angle, idx) => {
                const hasPhoto = photos.some((p) => p.angleIndex === angle.index);
                const isCurrent = currentStepIndex === idx;
                return (
                  <button
                    key={angle.index}
                    onClick={() => setCurrentStepIndex(idx)}
                    className={`flex flex-col items-center py-2 px-2 rounded-lg text-center transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-indigo-600 text-white font-bold shadow-xs'
                        : hasPhoto
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    <span className="text-xs font-bold">มุม {angle.index}</span>
                    <span className="text-[10px] truncate max-w-full opacity-90">
                      {hasPhoto ? '✓ บันทึกแล้ว' : angle.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Current Angle Directive Banner */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                  {currentAngle.index}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-indigo-950">{currentAngle.name}</h4>
                  <p className="text-xs text-indigo-700/80">{currentAngle.hint}</p>
                </div>
              </div>
              {photoForCurrentAngle && (
                <span className="px-2 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> บันทึกแล้ว
                </span>
              )}
            </div>

            {/* Video Viewport / Biometric Oval Frame */}
            <div className="relative aspect-square max-h-[360px] w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  
                  {/* Biometric Oval Guide Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-56 h-72 rounded-[50%] border-2 border-indigo-400 border-dashed animate-pulse flex flex-col items-center justify-between py-4">
                      <div className="w-8 h-1 bg-indigo-400 rounded-full" />
                      <div className="text-[11px] font-semibold text-white bg-slate-900/80 px-3 py-1 rounded-full backdrop-blur-xs">
                        จัดตำแหน่งใบหน้าให้อยู่ในกรอบ
                      </div>
                      <div className="w-8 h-1 bg-indigo-400 rounded-full" />
                    </div>
                  </div>

                  {/* Countdown overlay */}
                  {countdown !== null && (
                    <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center z-20">
                      <span className="text-7xl font-extrabold text-white animate-ping">
                        {countdown}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-6 text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400">
                    <Camera className="w-7 h-7" />
                  </div>
                  <p className="text-sm text-slate-300">
                    {cameraError || 'กำลังเปิดกล้อง... หรือกดปุ่มด้านล่างเพื่อเริ่มถ่าย'}
                  </p>
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition cursor-pointer"
                  >
                    เปิดกล้องอีกครั้ง
                  </button>
                </div>
              )}
            </div>

            {/* Controls Bar */}
            <div className="flex items-center gap-3">
              <button
                id="btn-capture-dataset-angle"
                onClick={triggerCountdownCapture}
                disabled={!cameraActive || countdown !== null}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>ถ่ายภาพมุม {currentAngle.index} (นับถอยหลัง 3 วิ)</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center gap-2 transition cursor-pointer"
                title="อัปโหลดรูปภาพจากอุปกรณ์"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">อัปโหลดไฟล์</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>

          {/* Right / Bottom: 3-Angle Dataset Gallery & Summary (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  ชุดภาพเปรียบเทียบ (Dataset 3 มุมมอง)
                </h4>
                <span className="text-xs font-semibold text-slate-500">{photos.length}/3 รูป</span>
              </div>

              {/* 3-Photo Dataset List */}
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {ANGLE_DEFINITIONS.map((angle, idx) => {
                  const photo = photos.find((p) => p.angleIndex === angle.index);
                  const isCurrent = currentStepIndex === idx;

                  return (
                    <div
                      key={angle.index}
                      onClick={() => setCurrentStepIndex(idx)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-white border-indigo-500 shadow-xs ring-2 ring-indigo-500/20'
                          : photo
                          ? 'bg-white border-slate-200 hover:border-slate-300'
                          : 'bg-slate-100/70 border-dashed border-slate-300 opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 flex items-center justify-center">
                          {photo ? (
                            <img
                              src={photo.dataUrl}
                              alt={angle.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Camera className="w-6 h-6 text-slate-400" />
                          )}
                          <span className="absolute bottom-0 right-0 px-1.5 py-0.5 text-[9px] font-bold bg-slate-900 text-white rounded-tl">
                            #{angle.index}
                          </span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{angle.name}</span>
                            {photo && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {photo ? 'บันทึกภาพเรียบร้อยแล้ว' : 'ยังไม่มีภาพ — คลิกเพื่อถ่าย'}
                          </p>
                        </div>
                      </div>

                      <div className="text-xs text-slate-400">
                        {isCurrent ? (
                          <span className="text-indigo-600 font-bold text-xs bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                            มุมปัจจุบัน
                          </span>
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quality Checklist */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-600 shadow-2xs">
              <div className="flex items-center gap-1.5 text-slate-900 font-semibold">
                <Info className="w-3.5 h-3.5 text-indigo-600" />
                <span>คำแนะนำการจัดเก็บ Dataset 3 ภาพ:</span>
              </div>
              <p>• มุม 1 (หน้าตรง): มองตรง แสงสว่างสม่ำเสมอ</p>
              <p>• มุม 2 & 3 (หันซ้าย/ขวา 20°): เอียงหน้าเล็กน้อยเพื่อจับสันจมูกและโหนกแก้ม</p>
              <p>• ครบทั้ง 3 มุมมอง จะช่วยให้ AI สแกนผ่านได้แม่นยำภายใน 1 วินาที</p>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <button
                id="btn-save-face-dataset"
                type="button"
                onClick={handleSave}
                disabled={photos.length === 0 || isSaving}
                className="w-2/3 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-200 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'กำลังบันทึก...' : `บันทึก Dataset (${photos.length}/3 รูป)`}</span>
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* SUCCESS COMPLETION POPUP: แสดงเมื่อถ่ายภาพครบ 3 ภาพตามที่ User กำหนด */}
      {/* ========================================================================= */}
      {showSuccessPopup && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md bg-white border border-emerald-200 rounded-3xl shadow-2xl p-6 text-slate-800 space-y-5 text-center">
            
            {/* Success Animation Badge */}
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-lg shadow-emerald-100">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>

            {/* Title & Info */}
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>บันทึกชุดข้อมูลสำเร็จ</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                คุณได้บันทึกภาพครบแล้ว
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                ระบบได้จัดเก็บและบันทึกชุดข้อมูลภาพถ่ายใบหน้าครบทั้ง <strong>3 มุมมอง</strong> สำหรับ <strong>{employee.fullName}</strong> ({employee.id}) ไว้อย่างสมบูรณ์แล้ว
              </p>
            </div>

            {/* 3 Photos Thumbnails Showcase */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                ชุดภาพ Dataset 3 มุมมองที่บันทึกแล้ว
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {ANGLE_DEFINITIONS.map((angle) => {
                  const photo = photos.find((p) => p.angleIndex === angle.index);
                  return (
                    <div key={angle.index} className="space-y-1">
                      <div className="aspect-square rounded-xl overflow-hidden bg-white border-2 border-emerald-500 shadow-2xs relative">
                        {photo ? (
                          <img
                            src={photo.dataUrl}
                            alt={angle.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                            <Camera className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                        <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold shadow-xs">
                          ✓
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-700 truncate">
                        มุม {angle.index}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ready for Biometric Scan Confirmation */}
            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-100 text-xs text-emerald-800 flex items-center gap-2 text-left">
              <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span className="text-[11px] font-medium leading-snug">
                ข้อมูลภาพถ่ายพร้อมใช้งานในระบบสแกนใบหน้าและลงเวลาทำงานชีวมิติได้ทันที
              </span>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowSuccessPopup(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
              >
                ดู / แก้ไขรูป
              </button>
              <button
                id="btn-confirm-dataset-complete"
                type="button"
                onClick={handleCloseCompletionPopup}
                className="flex-1 py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-200 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>ตกลง / ปิดหน้าต่าง</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
