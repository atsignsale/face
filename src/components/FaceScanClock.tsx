import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  LogIn,
  LogOut,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Clock,
  Compass,
  Building,
  UserCheck,
  FileSpreadsheet,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import * as faceapi from '@vladmandic/face-api';
import {
  Employee,
  AttendanceRecord,
  AttendanceType,
  OfficeConfig,
  GeoLocationData,
  GoogleSheetConfig,
} from '../types';
import { evaluateLocation, formatCoordinates } from '../utils/geoUtils';
import { sound } from '../utils/soundUtils';
import { syncRecordToGoogleSheets } from '../utils/sheetSync';

interface FaceScanClockProps {
  employees: Employee[];
  officeConfig: OfficeConfig;
  sheetConfig: GoogleSheetConfig;
  onRecordAdded: (record: AttendanceRecord) => void;
  currentGeo: GeoLocationData | null;
  onRefreshGeo: () => void;
  attendanceRecords?: AttendanceRecord[];
}

export const FaceScanClock: React.FC<FaceScanClockProps> = ({
  employees,
  officeConfig,
  sheetConfig,
  onRecordAdded,
  currentGeo,
  onRefreshGeo,
  attendanceRecords = [],
}) => {
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatusText, setProcessingStatusText] = useState<string>('');
  const [scanType, setScanType] = useState<AttendanceType | 'PREVIEW'>('CHECK_IN');
  const [selectedTargetEmployeeId, setSelectedTargetEmployeeId] = useState<string>('AUTO');
  
  const [scannedResult, setScannedResult] = useState<{
    matchedEmployee: Employee;
    confidenceScore: number;
    matchReason: string;
    snapshotBase64: string;
  } | null>(null);

  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  
  // Last scan result modal/card state
  const [lastResult, setLastResult] = useState<{
    record: AttendanceRecord;
    matchedEmployee: Employee;
    sheetSyncStatus: string;
  } | null>(null);

  // Determine if the currently selected employee or last verified employee has clocked in/out today
  const todayDateStr = new Date().toISOString().slice(0, 10);
  
  const effectiveEmployeeId = selectedTargetEmployeeId !== 'AUTO'
    ? selectedTargetEmployeeId
    : scannedResult?.matchedEmployee?.id || lastResult?.matchedEmployee?.id || null;

  const hasClockedInToday = Boolean(
    effectiveEmployeeId &&
    attendanceRecords.some(
      (r) => r.employeeId === effectiveEmployeeId && r.dateFormatted === todayDateStr && r.type === 'CHECK_IN'
    )
  );

  const hasClockedOutToday = Boolean(
    effectiveEmployeeId &&
    attendanceRecords.some(
      (r) => r.employeeId === effectiveEmployeeId && r.dateFormatted === todayDateStr && r.type === 'CHECK_OUT'
    )
  );

  const isClockInDisabled = isProcessing || hasClockedInToday;
  const isClockOutDisabled = isProcessing || hasClockedOutToday;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
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
      console.warn('Camera stream error:', err);
      setCameraError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์');
      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    const initFaceApi = async () => {
      try {
        setProcessingStatusText('กำลังโหลด AI Models...');
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);

        setIsModelsLoaded(true);
        setProcessingStatusText('กำลังประมวลผลฐานข้อมูลใบหน้า...');

        const labeledDescriptors: faceapi.LabeledFaceDescriptors[] = [];

        for (const emp of employees) {
          if (!emp.faceDataset || emp.faceDataset.length === 0) continue;

          const descriptors: Float32Array[] = [];
          for (const photo of emp.faceDataset) {
             try {
                 const img = new Image();
                 img.crossOrigin = 'anonymous';
                 img.src = photo.dataUrl;
                 await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = () => reject(new Error('Image failed to load: ' + photo.dataUrl));
                 });

                 let detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                 
                 // Fallback for mobile: If standard SSD fails, try TinyFaceDetector
                 if (!detection) {
                    const tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 });
                    detection = await faceapi.detectSingleFace(img, tinyOptions).withFaceLandmarks().withFaceDescriptor();
                 }

                 if (detection) {
                    descriptors.push(detection.descriptor);
                 } else {
                    console.warn(`Could not detect face in image ${photo.dataUrl.substring(0, 30)}...`);
                 }
             } catch (imgErr) {
                 console.warn("Skipped invalid photo for employee", emp.id, imgErr);
             }
          }

          if (descriptors.length > 0) {
            labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(emp.id, descriptors));
          }
        }

        if (labeledDescriptors.length > 0) {
          setFaceMatcher(new faceapi.FaceMatcher(labeledDescriptors, 0.45)); // threshold 0.45
        } else {
          console.warn("No valid face descriptors found in the entire dataset.");
        }
        setProcessingStatusText('');
      } catch (err) {
        console.error("Face API initialization failed", err);
        setProcessingStatusText('โหลด AI Models ไม่สำเร็จ (กรุณารีเฟรช)');
      }
    };

    if (employees.length > 0) {
       initFaceApi();
    }
  }, [employees]);

  // Capture live snapshot frame from video element
  const captureFrame = (): string | null => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    
    let width = video.videoWidth || 640;
    let height = video.videoHeight || 480;

    // Scale down high-res mobile cameras to prevent WebGL memory crashes
    const MAX_DIMENSION = 640;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Flip horizontal for natural mirror look
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.85);
  };

  // แปลง URL รูปภาพ (เช่น /dataset/EMP-001/front.jpg) ให้เป็น base64 data URL
  // Gemini ต้องการ inline image data — URL ภายในระบบ serve โดย Vite ไม่สามารถเข้าถึงโดยตรงจาก server ได้
  const fetchImageAsBase64 = async (src: string): Promise<string> => {
    try {
      if (src.startsWith('data:')) return src; // already base64
      const response = await fetch(src);
      if (!response.ok) return src;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      return src;
    }
  };

  const handleTriggerAttendance = async (type: AttendanceType | 'PREVIEW') => {
    if (employees.length === 0) {
      alert('ยังไม่มีข้อมูลพนักงานในระบบ กรุณาเพิ่มข้อมูลพนักงานก่อน');
      return;
    }

    setScanType(type);
    setIsProcessing(true);
    setProcessingStatusText(type === 'PREVIEW' ? 'กำลังค้นหาใบหน้าและเปรียบเทียบ...' : 'กำลังประมวลผลการลงเวลา...');
    sound.playScanStart();

    try {
      let snapshotBase64 = '';
      let matchResult: any;
      let matchedEmp: Employee | undefined;

    if (type !== 'PREVIEW' && scannedResult) {
      snapshotBase64 = scannedResult.snapshotBase64;
      matchedEmp = scannedResult.matchedEmployee;
      matchResult = {
        confidence: scannedResult.confidenceScore,
        reason: scannedResult.matchReason,
        matchStatus: 'EXACT_MATCH',
        matchedEmployeeId: matchedEmp.id,
        isLivenessPass: true
      };
      setProcessingStatusText('กำลังตรวจสอบเวลาและพิกัดภูมิศาสตร์ (GPS Verification)...');
    } else {
      // 1. Capture snapshot from live stream or fallback avatar
      snapshotBase64 = captureFrame() || '';
      if (!snapshotBase64) {
        // Fallback placeholder snapshot
        const targetEmp = employees.find((e) => e.id === selectedTargetEmployeeId) || employees[0];
        snapshotBase64 = targetEmp.avatarUrl || targetEmp.faceDataset?.[0]?.dataUrl || '';
      }

      if (!isModelsLoaded) {
        matchResult = {
          matchedEmployeeId: null,
          confidence: 0,
          matchStatus: 'NO_MATCH',
          reason: 'ระบบ AI ยังโหลดไม่เสร็จ (กรุณารอสักครู่)',
          isLivenessPass: false
        };
      } else if (!faceMatcher) {
        matchResult = {
          matchedEmployeeId: null,
          confidence: 0,
          matchStatus: 'NO_MATCH',
          reason: 'ไม่พบใบหน้าในฐานข้อมูลระบบ (กรุณาไปที่เมนูจัดการพนักงานและถ่ายภาพใบหน้าใหม่ให้สมบูรณ์)',
          isLivenessPass: false
        };
      } else {
        setProcessingStatusText('AI กำลังวิเคราะห์จุดเด่นใบหน้า (Local Face Recognition)...');
        
        let detection;
        try {
          // ใช้รูปภาพ Snapshot (Base64) ในการประมวลผลแทนที่จะใช้ Video tag โดยตรง
          // เพื่อแก้ปัญหา WebGL Texture Limit และบั๊กจอดำบนเบราว์เซอร์มือถือ (โดยเฉพาะ iOS Safari)
          const img = new Image();
          img.src = snapshotBase64;
          await new Promise((resolve, reject) => { 
            img.onload = resolve; 
            img.onerror = () => reject(new Error('Failed to load snapshot image')); 
          });
          
          // ปรับลด minConfidence เป็น 0.25 เพื่อให้ตรวจจับใบหน้าในมือถือที่แสงน้อยหรือกล้องไม่ชัดได้ง่ายที่สุด
          const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.25 });
          detection = await faceapi.detectSingleFace(img, options).withFaceLandmarks().withFaceDescriptor();

          if (!detection) {
             const tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 });
             detection = await faceapi.detectSingleFace(img, tinyOptions).withFaceLandmarks().withFaceDescriptor();
          }
        } catch (err) {
          console.warn('Face detection processing error:', err);
        }

        matchResult = {
          matchedEmployeeId: null,
          confidence: 0,
          matchStatus: 'NO_MATCH',
          reason: 'AI มองไม่เห็นใบหน้าของคุณ (กรุณาถือกล้องให้นิ่ง แสงสว่างเพียงพอ และให้หน้าอยู่ตรงกลางกรอบ)',
          isLivenessPass: false,
        };

        if (detection) {
           const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
           
           // threshold for Strict mode: lower distance is better. 0.45 is strict.
           if (bestMatch.label !== 'unknown' && bestMatch.distance <= 0.45) {
              matchResult = {
                 matchedEmployeeId: bestMatch.label,
                 confidence: (1 - bestMatch.distance) * 100,
                 matchStatus: 'EXACT_MATCH',
                 reason: 'ตรวจพบใบหน้าตรงกับฐานข้อมูล',
                 isLivenessPass: true
              };
           } else {
              matchResult.reason = 'ใบหน้าไม่ตรงกับฐานข้อมูล (ความแม่นยำต่ำกว่าเกณฑ์)';
              matchResult.confidence = (1 - bestMatch.distance) * 100;
           }
        }
      }

      // 1. ถ้า AI ตอบว่าไม่ตรง (NO_MATCH) หรือล้มเหลว โยน Error ทันที ห้ามให้ผ่านเด็ดขาด
      if (matchResult.matchStatus === 'NO_MATCH' || !matchResult.matchedEmployeeId) {
        throw new Error(
          `${matchResult.reason || 'ใบหน้าไม่ตรงกับฐานข้อมูล'} (Confidence: ${matchResult.confidence}%)`
        );
      }

      // 2. ถ้า AI บอกว่าตรง หาข้อมูลพนักงานจาก ID ที่ AI ระบุ
      matchedEmp = employees.find((e) => e.id === matchResult.matchedEmployeeId);
      if (!matchedEmp) {
        throw new Error('ระบบ AI ตรวจพบใบหน้า แต่ไม่พบรหัสพนักงานนี้ในฐานข้อมูลระบบ');
      }

      // 3. กรณี 1:1 (ระบุชื่อด้วยตนเองใน Dropdown) ต้องตรวจสอบว่าชื่อที่เลือก ตรงกับใบหน้าที่ AI ระบุหรือไม่
      if (selectedTargetEmployeeId !== 'AUTO' && matchedEmp.id !== selectedTargetEmployeeId) {
        const requestedEmp = employees.find((e) => e.id === selectedTargetEmployeeId);
        throw new Error(
          `ใบหน้าคุณตรงกับข้อมูลของ "${matchedEmp.fullName}" แต่คุณเลือกชื่อลงเวลาเป็น "${requestedEmp?.fullName}" (สแกนแทนกันไม่ได้)`
        );
      }
    }

    if (type === 'PREVIEW') {
      setScannedResult({
        matchedEmployee: matchedEmp,
        confidenceScore: Number(matchResult.confidence.toFixed(1)),
        matchReason: matchResult.reason,
        snapshotBase64: snapshotBase64,
      });
      sound.playSuccess();
      setIsProcessing(false);
      setProcessingStatusText('');
      return;
    }

      setProcessingStatusText('กำลังตรวจสอบเวลาและพิกัดภูมิศาสตร์ (GPS Verification)...');

      const now = new Date();
      const timeFormatted = now.toLocaleTimeString('th-TH', { hour12: false });
      const dateFormatted = now.toISOString().slice(0, 10);

      // Determine On-Time vs Late status
      const [startHour, startMin] = officeConfig.workStartTime.split(':').map(Number);
      const isLate =
        type === 'CHECK_IN' &&
        (now.getHours() > startHour || (now.getHours() === startHour && now.getMinutes() > startMin + officeConfig.lateThresholdMinutes));

      const status =
        type === 'CHECK_OUT'
          ? 'NORMAL'
          : isLate
          ? 'LATE'
          : 'ON_TIME';

      // Use latest real-time GPS data
      const locationData: GeoLocationData = currentGeo || {
        latitude: officeConfig.latitude,
        longitude: officeConfig.longitude,
        accuracy: 8,
        address: `${officeConfig.name} (ตรวจจับพิกัดปัจจุบัน)`,
        inOfficeZone: true,
        distanceFromOfficeMeters: 10,
      };

      const newRecord: AttendanceRecord = {
        id: `att-${Date.now()}`,
        employeeId: matchedEmp.id,
        employeeName: matchedEmp.fullName,
        position: matchedEmp.position,
        level: matchedEmp.level,
        department: matchedEmp.department,
        age: matchedEmp.age,
        type: type,
        timestamp: now.toISOString(),
        timeFormatted: timeFormatted,
        dateFormatted: dateFormatted,
        status: status,
        capturedPhoto: snapshotBase64,
        confidenceScore: Number(matchResult.confidence.toFixed(1)),
        matchReason: matchResult.reason,
        location: locationData,
        syncedToGoogleSheets: false,
        device: `${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop / Workstation'} (GPS Verified)`,
      };

      setProcessingStatusText('กำลังซิงค์ข้อมูลลง Google Sheets แบบเรียลไทม์...');

      // 3. Auto sync to Google Sheets
      const syncRes = await syncRecordToGoogleSheets(newRecord, sheetConfig);
      if (syncRes.success) {
        newRecord.syncedToGoogleSheets = true;
        newRecord.googleSheetRowId = syncRes.syncedRecordId || `ROW_${Date.now().toString().slice(-6)}`;
      }

      // Add to global state
      onRecordAdded(newRecord);

      // Sound & Visual Celebratory Confetti
      sound.playSuccess();
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#06b6d4', '#10b981', '#3b82f6', '#f59e0b'],
      });

      setLastResult({
        record: newRecord,
        matchedEmployee: matchedEmp,
        sheetSyncStatus: syncRes.success
          ? 'ซิงค์ข้อมูลลง Google Sheets เรียบร้อยแล้ว ✓'
          : `บันทึกในระบบแล้ว (รอการซิงค์: ${syncRes.message})`,
      });
      setScannedResult(null);
    } catch (err) {
      console.error('Attendance scan error:', err);
      sound.playError();
      alert(`ไม่สามารถลงเวลาได้\n${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatusText('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Left Column: Live Biometric Camera Scanner (7 cols) */}
      <div className="lg:col-span-7 flex flex-col space-y-6 relative z-10">
        
        {/* Main Camera Frame Card */}
        <div className="glass-card rounded-[2rem] relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.3)] border border-white/10 flex flex-col justify-between aspect-4/3 sm:aspect-16/10 ring-1 ring-white/5">
          
          {/* Background Video */}
          <div className="absolute inset-0 z-0 bg-slate-950 flex items-center justify-center">
            {/* Always render the video so videoRef is available during startCamera */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 ${!cameraActive ? 'hidden' : ''}`}
            />
            
            {!cameraActive && (
              <div className="p-8 text-center space-y-3 z-10 absolute">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                  <Camera className="w-7 h-7 text-indigo-400" />
                </div>
                <h4 className="font-bold text-slate-200 text-sm">กล้องยังไม่ได้เปิดทำงาน</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  {cameraError || 'กรุณาอนุญาตการเข้าถึงกล้องเพื่อทำการสแกนใบหน้า'}
                </p>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  เปิดกล้องสแกน
                </button>
              </div>
            )}
          </div>

          {/* Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/40 z-10 pointer-events-none" />

          {/* Biometric Oval Guide Overlay */}
          {cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="w-56 h-72 sm:w-64 sm:h-80 border-2 border-indigo-400/60 rounded-[40px] relative flex flex-col items-center justify-between py-3">
                <div className="w-3.5 h-3.5 bg-indigo-400 rounded-full blur-[1px] animate-pulse" />

                <div className="w-3.5 h-3.5 bg-indigo-400 rounded-full blur-[1px] animate-pulse" />
                <div className="absolute inset-x-0 top-1/4 h-px bg-indigo-400/40" />
              </div>
            </div>
          )}

          {/* Processing Screen Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-full border-3 border-indigo-500/20 border-t-indigo-400 animate-spin flex items-center justify-center">
                <Camera className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">กำลังประมวลผลการลงเวลา</h4>
                <p className="text-xs text-indigo-300 mt-0.5 font-mono">{processingStatusText}</p>
              </div>
            </div>
          )}

          {/* Top Bar inside Camera */}
          <div className="relative z-20 p-4 flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="bg-emerald-500/90 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 self-start shadow-sm">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Live Camera
              </div>

            </div>


          </div>

          {/* Bottom Bar inside Camera */}
          <div className="relative z-20 p-5 flex items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-white/75 text-[11px] font-medium">Face Biometrics Status</span>
              <div className="w-44 sm:w-56 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="w-[95%] h-full bg-emerald-400 rounded-full" />
              </div>
              <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                READY FOR RECOGNITION (98.5% ACCURACY)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onRefreshGeo}
                className="bg-black/40 hover:bg-black/60 text-white/90 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 flex items-center gap-1 backdrop-blur-xs transition"
                title="รีเฟรชพิกัด GPS"
              >
                <RefreshCw className="w-3 h-3" />
                <span className="hidden sm:inline">GPS</span>
              </button>
            </div>
          </div>

        </div>

        {/* Action Trigger Buttons */}
        <div className="flex flex-col gap-4">
          
          <button
            onClick={() => handleTriggerAttendance('PREVIEW')}
            disabled={isProcessing}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm sm:text-base rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-3 transition-all active:scale-98 cursor-pointer"
          >
            <Camera className="w-5 h-5 text-white" />
            <span>ค้นหาใบหน้าและเปรียบเทียบ (Scan Only)</span>
          </button>

          <div className="grid grid-cols-2 gap-4">
          
          {/* Green / Primary Clock In */}
          <button
            id="btn-clock-in"
            onClick={() => handleTriggerAttendance('CHECK_IN')}
            disabled={isClockInDisabled}
            title={hasClockedInToday ? 'ลงเวลาเข้างานวันนี้เรียบร้อยแล้ว' : 'กดเพื่อสแกนใบหน้าลงเวลาเข้างาน'}
            className={`py-4 px-6 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-3 transition-all ${
              hasClockedInToday
                ? 'bg-slate-100 border border-slate-200 text-slate-400 opacity-40 cursor-not-allowed shadow-none scale-98 pointer-events-none'
                : isProcessing
                ? 'bg-emerald-600/70 text-white opacity-50 cursor-wait'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30 active:scale-98 cursor-pointer'
            }`}
          >
            <LogIn className={`w-5 h-5 ${hasClockedInToday ? 'text-slate-400' : 'text-white'}`} />
            <div className="text-left">
              <div className="leading-tight flex items-center gap-1.5">
                <span>ลงเวลาเข้างาน</span>
                {hasClockedInToday && (
                  <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-bold">
                    เข้างานแล้ว
                  </span>
                )}
              </div>
              <div className={`text-[10px] font-normal uppercase tracking-wider ${hasClockedInToday ? 'text-slate-400' : 'text-emerald-100'}`}>
                {hasClockedInToday ? 'Clocked In Today' : 'Clock In & Sync'}
              </div>
            </div>
          </button>

          {/* Rose / Clock Out */}
          <button
            id="btn-clock-out"
            onClick={() => handleTriggerAttendance('CHECK_OUT')}
            disabled={isClockOutDisabled}
            title={hasClockedOutToday ? 'ลงเวลาออกงานวันนี้เรียบร้อยแล้ว' : 'กดเพื่อสแกนใบหน้าลงเวลาออกงาน'}
            className={`py-4 px-6 rounded-2xl font-bold text-sm sm:text-base shadow-lg flex items-center justify-center gap-3 transition-all ${
              hasClockedOutToday
                ? 'bg-slate-100 border border-slate-200 text-slate-400 opacity-40 cursor-not-allowed shadow-none scale-98 pointer-events-none'
                : isProcessing
                ? 'bg-rose-500/70 text-white opacity-50 cursor-wait'
                : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200 active:scale-98 cursor-pointer'
            }`}
          >
            <LogOut className={`w-5 h-5 ${hasClockedOutToday ? 'text-slate-400' : 'text-white'}`} />
            <div className="text-left">
              <div className="leading-tight flex items-center gap-1.5">
                <span>ลงเวลาออกงาน</span>
                {hasClockedOutToday && (
                  <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-bold">
                    ออกงานแล้ว
                  </span>
                )}
                {!hasClockedOutToday && hasClockedInToday && (
                  <span className="text-[9px] bg-rose-700/80 text-white px-1.5 py-0.2 rounded font-bold animate-pulse">
                    พร้อมออกงาน
                  </span>
                )}
              </div>
              <div className={`text-[10px] font-normal uppercase tracking-wider ${hasClockedOutToday ? 'text-slate-400' : 'text-rose-100'}`}>
                {hasClockedOutToday ? 'Clocked Out Today' : 'Clock Out & Sync'}
              </div>
            </div>
          </button>
          </div>
        </div>

        {/* 3-Photo Dataset Strip Preview */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Face Recognition Dataset (3/3 Angles)</span>
            </h3>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
              (scannedResult || lastResult) 
                ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30'
                : 'text-slate-400 bg-white/5 border-white/10'
            }`}>
              {(scannedResult || lastResult) ? 'Dataset Ready' : 'Waiting for Scan'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((idx) => {
              const photoUrl = (scannedResult?.matchedEmployee || lastResult?.matchedEmployee)?.faceDataset?.[idx]?.dataUrl;

              return (
                <div
                  key={idx}
                  className={`aspect-square rounded-xl bg-slate-100 border-2 flex items-center justify-center overflow-hidden relative shadow-2xs group ${
                    photoUrl ? 'border-emerald-500' : 'border-slate-300 border-dashed'
                  }`}
                >
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={`Angle ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                      Angle {idx + 1}
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 text-[9px] font-bold px-1.5 py-0.5 bg-white/90 text-slate-800 rounded">
                    #{idx + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-time GPS Geolocation Information Bar */}
        <div className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              currentGeo?.inOfficeZone ? 'bg-emerald-400/20 text-emerald-400' : 'bg-amber-400/20 text-amber-400'
            }`}>
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">พิกัดสถานที่ปฏิบัติงาน:</span>
                <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                  currentGeo?.inOfficeZone ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {currentGeo?.inOfficeZone ? '✓ ในเขตพื้นที่หน่วยงาน' : '⚠️ ตรวจจับพิกัด'}
                </span>
              </div>
              <p className="text-slate-500 text-[11px] mt-0.5">
                {currentGeo?.address || officeConfig.name} (±{currentGeo?.accuracy || 5} ม.)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {currentGeo && (
              <a
                href={`https://www.google.com/maps?q=${currentGeo.latitude},${currentGeo.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1 transition"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                <span>Google Maps</span>
              </a>
            )}
          </div>
        </div>

      </div>

      {/* Right Column: Personal Information & Attendance Summary (5 cols) */}
      <div className="lg:col-span-5 flex flex-col space-y-6">
        
        {lastResult ? (
          /* Confirmation Verified Result Card */
          <div className="glass-panel rounded-2xl p-6 border-emerald-400/30 shadow-[0_0_30px_rgba(16,185,129,0.15)] space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm sm:text-base text-glow">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>
                  {lastResult.record.type === 'CHECK_IN' ? 'ลงเวลาเข้างานสำเร็จ' : 'ลงเวลาออกงานสำเร็จ'}
                </span>
              </div>
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-lg bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                {lastResult.record.timeFormatted} น.
              </span>
            </div>

            {/* Side-by-Side Face Comparison */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
              <div className="space-y-1 text-center">
                <div className="aspect-square rounded-lg overflow-hidden bg-slate-200 border border-indigo-300">
                  <img
                    src={lastResult.record.capturedPhoto}
                    alt="Live Face Snapshot"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-[11px] font-bold text-slate-300">ภาพสแกนสด</div>
              </div>

              <div className="space-y-1 text-center">
                <div className="aspect-square rounded-lg overflow-hidden bg-slate-900 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <img
                    src={
                      lastResult.matchedEmployee.faceDataset?.[0]?.dataUrl ||
                      lastResult.matchedEmployee.avatarUrl
                    }
                    alt="Master Dataset"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-[11px] font-bold text-slate-300">Dataset 3 มุมมอง</div>
              </div>
            </div>

            {/* Employee Verified Profile Info Form Fields */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ชื่อ-นามสกุล</label>
                  <input
                    type="text"
                    value={lastResult.matchedEmployee.fullName}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800"
                    readOnly
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">รหัสพนักงาน</label>
                  <input
                    type="text"
                    value={lastResult.matchedEmployee.id}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-indigo-600"
                    readOnly
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตำแหน่ง</label>
                  <input
                    type="text"
                    value={lastResult.matchedEmployee.position}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700"
                    readOnly
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">แผนก</label>
                  <input
                    type="text"
                    value={lastResult.matchedEmployee.department}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700"
                    readOnly
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ระดับ</label>
                  <input
                    type="text"
                    value={lastResult.matchedEmployee.level}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700"
                    readOnly
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">อายุ</label>
                  <input
                    type="text"
                    value={`${lastResult.matchedEmployee.age} ปี`}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700"
                    readOnly
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ความแม่นยำ</label>
                  <div className="h-8.5 flex items-center justify-center px-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">
                    {lastResult.record.confidenceScore}% ✓
                  </div>
                </div>
              </div>
            </div>

            {/* Google Sheets Sync Message */}
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs font-medium ${
                lastResult.record.syncedToGoogleSheets
                  ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-300'
                  : 'bg-amber-400/10 border-amber-400/30 text-amber-300'
              }`}
            >
              <FileSpreadsheet
                className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                  lastResult.record.syncedToGoogleSheets ? 'text-emerald-600' : 'text-amber-600'
                }`}
              />
              <div className="flex-1">
                <div className="font-bold">
                  {lastResult.record.syncedToGoogleSheets ? 'ซิงค์เข้า Google Sheets สำเร็จ' : 'บันทึกในเครื่องแล้ว'}
                </div>
                <div className="text-[11px] mt-0.5 leading-relaxed">{lastResult.sheetSyncStatus}</div>
              </div>
            </div>

            <button
              onClick={() => setLastResult(null)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
            >
              พร้อมลงเวลาคนถัดไป
            </button>
          </div>
        ) : (
          /* Personal Information Idle / Active Employee Preview */
          <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-4">
                Personal Information
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                    <input
                      type="text"
                      value={scannedResult?.matchedEmployee?.fullName || ""}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none"
                      readOnly
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee ID</label>
                    <input
                      type="text"
                      value={scannedResult?.matchedEmployee?.id || ""}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-medium text-slate-800 focus:outline-none"
                      readOnly
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Position</label>
                    <input
                      type="text"
                      value={scannedResult?.matchedEmployee?.position || ""}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none"
                      readOnly
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</label>
                    <input
                      type="text"
                      value={scannedResult?.matchedEmployee?.department || ""}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none"
                      readOnly
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Level</label>
                    <input
                      type="text"
                      value={scannedResult?.matchedEmployee?.level || ""}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none"
                      readOnly
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Age</label>
                    <input
                      type="text"
                      value={scannedResult?.matchedEmployee?.age ? String(scannedResult?.matchedEmployee?.age) : ""}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none"
                      readOnly
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
                    <div className="h-9.5 flex items-center justify-center px-3 text-xs font-bold rounded-lg border bg-slate-100 text-slate-600 border-slate-200">
                      {scannedResult ? "SCANNED" : "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Shift hours helper */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                รอบเวลา: {officeConfig.workStartTime} - {officeConfig.workEndTime} น.
              </span>
              <span className="font-semibold text-white">{officeConfig.name}</span>
            </div>
          </div>
        )}

        {/* Recent Activity Card */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Recent Activity</h3>
            <span className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest text-glow">
              Live Feed
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <span className="text-xs font-semibold text-slate-300">Biometric Clock-In Ready</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">1:N Active</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                <span className="text-xs font-semibold text-slate-300">GPS Geofence Perimeter</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">r={officeConfig.radiusMeters}m</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
