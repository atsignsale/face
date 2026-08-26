import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// High payload limit for handling multi-shot face photos and base64 datasets
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aiEngine: process.env.GEMINI_API_KEY ? 'Gemini 3.7 Flash Active' : 'Fallback Simulator',
  });
});

// Removed Face Recognition endpoint as it is now client-side

// 2.5 Dataset Upload Endpoint
app.post('/api/dataset/upload', async (req, res) => {
  try {
    const { employeeId, dataset } = req.body;
    
    if (!employeeId || !dataset || !Array.isArray(dataset)) {
      res.status(400).json({ success: false, message: 'Invalid data payload' });
      return;
    }

    const dirPath = path.join(process.cwd(), 'public', 'dataset', employeeId);
    
    // Ensure directory exists
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const updatedDataset = [];

    for (const photo of dataset) {
      // Determine file name based on angleIndex
      let fileName = 'front.jpg';
      if (photo.angleIndex === 2) fileName = 'left.jpg';
      else if (photo.angleIndex === 3) fileName = 'right.jpg';

      const filePath = path.join(dirPath, fileName);
      const fileUrl = `/dataset/${employeeId}/${fileName}`;

      // Extract Base64 if needed
      let base64Data = photo.dataUrl;
      if (base64Data && base64Data.startsWith('data:image')) {
        base64Data = base64Data.split(';base64,').pop();
        // Write file only if it's new base64 data
        fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });
      }

      // Add updated photo object
      updatedDataset.push({
        ...photo,
        dataUrl: fileUrl, // Override base64 with URL
      });
    }

    res.json({
      success: true,
      message: 'Upload successful',
      updatedDataset,
    });
  } catch (error) {
    console.error('Error uploading dataset:', error);
    res.status(500).json({ success: false, message: 'Server error during upload' });
  }
});

// 3. Google Sheets Sync Proxy
app.post('/api/google-sheets/sync', async (req, res) => {
  try {
    const { scriptUrl, appsScriptUrl, sheetId, sheetName, data } = req.body;
    const targetUrl = ((scriptUrl || appsScriptUrl) as string || '').trim();

    if (!targetUrl || !targetUrl.startsWith('http')) {
      res.status(400).json({
        success: false,
        message: 'ยังไม่ได้ระบุ Google Apps Script Webhook URL กรุณาไปที่เมนู "ตั้งค่า" เพื่อใส่ Webhook URL',
      });
      return;
    }

    try {
      // Forward payload to Google Apps Script Web App with automatic redirect following
      const scriptResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body: JSON.stringify({
          action: 'APPEND_ATTENDANCE',
          sheetId: sheetId || '',
          sheetName: sheetName || 'Attendance_Logs',
          record: data,
          data: data,
        }),
      });

      const responseText = await scriptResponse.text();

      // Check if Google returned an Auth Login page (happens when Deploy was set to 'Only Myself' instead of 'Anyone')
      if (
        responseText.includes('accounts.google.com') ||
        responseText.includes('ServiceLogin') ||
        responseText.includes('Sign in - Google Accounts')
      ) {
        res.status(401).json({
          success: false,
          message: 'Google Sheets ปฏิเสธการเข้าถึง: กรุณาแก้ไขการ Deploy ใน Apps Script โดยเลือก "ผู้มีสิทธิ์เข้าถึง (Who has access)" เป็น "ทุกคน (Anyone)"',
          rawResponse: responseText.slice(0, 300),
        });
        return;
      }

      let parsedJson: { status?: string; message?: string; row?: number; error?: string } = {};
      try {
        parsedJson = JSON.parse(responseText);
      } catch {
        // If not JSON but 200 OK
      }

      if (scriptResponse.ok && (parsedJson.status === 'success' || !parsedJson.status)) {
        res.json({
          success: true,
          message: parsedJson.message || 'ซิงค์ข้อมูลลง Google Sheets เรียบร้อยแล้ว',
          details: parsedJson,
          sheetRow: parsedJson.row,
        });
        return;
      } else {
        res.status(scriptResponse.ok ? 400 : scriptResponse.status).json({
          success: false,
          message: parsedJson.message || parsedJson.error || `Google Apps Script ตอบกลับข้อผิดพลาด (${scriptResponse.status})`,
          rawResponse: responseText.slice(0, 300),
        });
        return;
      }
    } catch (scriptErr) {
      console.warn('Apps Script forward error:', scriptErr);
      res.status(502).json({
        success: false,
        message: `ไม่สามารถเชื่อมต่อไปยัง Webhook URL ได้: ${scriptErr instanceof Error ? scriptErr.message : 'Network Error'} กรุณาตรวจสอบ URL ในเมนูตั้งค่า`,
      });
      return;
    }
  } catch (error) {
    console.error('Google Sheets Sync Proxy Error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์ในการซิงค์ข้อมูล',
    });
  }
});

// 4. Google Apps Script Code Generator Endpoint
app.get('/api/google-sheets/generate-script', (req, res) => {
  const code = `/**
 * Google Apps Script for Face Recognition Attendance System
 * คัดลอกโค้ดนี้ไปวางใน Google Sheet -> ส่วนขยาย (Extensions) -> Apps Script
 * แล้วกดบันทึก และกด 'ทำให้ใช้งานได้' (Deploy) -> 'การทำให้ใช้งานได้ใหม่' (New deployment) -> ชนิด 'เว็บแอป' (Web app)
 * กำหนด 'ผู้มีสิทธิ์เข้าถึง' (Who has access) = 'ทุกคน' (Anyone)
 */

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var json = JSON.parse(rawData);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Create Header if Sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "รหัสบันทึก (Record ID)",
        "รหัสพนักงาน (Emp ID)",
        "ชื่อ-นามสกุล (Full Name)",
        "ตำแหน่ง (Position)",
        "ระดับ (Level)",
        "แผนก (Department)",
        "อายุ (Age)",
        "ประเภทการลงเวลา (Type)",
        "วันที่ (Date)",
        "เวลา (Time)",
        "สถานะ (Status)",
        "ความแม่นยำ AI (%)",
        "ละติจูด (Latitude)",
        "ลองจิจูด (Longitude)",
        "สถานที่ / พิกัด (Location)",
        "สถานะพื้นที่ (Office Zone)",
        "ระยะห่าง (Meters)",
        "Google Maps URL",
        "เหตุผลการระบุตัวตน (AI Reason)",
        "อุปกรณ์ (Device)",
        "วันเวลาสากล (Timestamp)"
      ]);
      sheet.getRange("A1:U1").setFontWeight("bold").setBackground("#0f172a").setFontColor("#38bdf8");
    }
    
    var r = json.record || json.data || {};
    
    sheet.appendRow([
      r.recordId || Utilities.getUuid(),
      r.employeeId || "",
      r.fullName || "",
      r.position || "",
      r.level || "",
      r.department || "",
      r.age || "",
      r.type || "",
      r.date || "",
      r.time || "",
      r.status || "",
      r.confidence || "",
      r.latitude || "",
      r.longitude || "",
      r.locationAddress || "",
      r.inOfficeZone || "",
      r.distanceFromOffice || "",
      r.googleMapsLink || "",
      r.matchReason || "",
      r.device || "",
      r.timestamp || new Date().toISOString()
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "บันทึกข้อมูลลงเวลาเข้า Google Sheet สำเร็จ",
      row: sheet.getLastRow()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    service: "Face Attendance Google Sheet Sync Engine",
    time: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(code);
});

// 5. Mount Vite middleware for dev or static dist for production
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // เสิร์ฟไฟล์ในโฟลเดอร์ public/dataset โดยตรงเพื่อให้รูปที่อัปโหลดใหม่เข้าถึงได้
    app.use('/dataset', express.static(path.join(process.cwd(), 'public', 'dataset')));
    
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Face Recognition Attendance Server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite();
