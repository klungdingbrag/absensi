const SHEET_NAME = 'ABSENSI_MINGGUAN';
const BACKUP_SHEET_NAME = 'ABSENSI_BACKUP';
const MASTER_SHEET_NAME = 'MASTER_KARYAWAN';
const MASTER_BACKUP_SHEET_NAME = 'MASTER_KARYAWAN_BACKUP';
const SALARY_HISTORY_SHEET_NAME = 'RIWAYAT_GAJI';
const MAX_DATA_JSON_LENGTH = 45000;

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = String(params.action || 'get').trim();
    if (action === 'master') return getMaster_();
    if (action !== 'get') return jsonResponse({success:false, message:'Action tidak dikenal.'});

    const weekStart = String(params.weekStart || '').trim();
    if (!isIsoDate_(weekStart)) throw new Error('weekStart tidak valid. Gunakan YYYY-MM-DD.');

    const sheet = getSheet_();
    const rows = findWeekRows_(sheet, weekStart);
    if (rows.length > 1) throw new Error('Ditemukan data duplikat untuk minggu '+weekStart+'. Data tidak diubah.');
    if (rows.length === 0) return jsonResponse({success:true, data:[], weekStart:weekStart});

    const row = rows[0].values;
    const rawJson = String(row[2] || '').trim();
    if (!rawJson) throw new Error('DATA_JSON kosong untuk minggu '+weekStart+'. Data tidak diubah.');
    let data;
    try { data = JSON.parse(rawJson); } catch (_) { throw new Error('DATA_JSON rusak untuk minggu '+weekStart+'. Data tidak diubah.'); }
    if (!Array.isArray(data) || data.length === 0) throw new Error('DATA_JSON kosong/tidak valid untuk minggu '+weekStart+'. Data tidak diubah.');

    return jsonResponse({success:true,data:data,weekStart:normalizeDateValue_(row[0]),weekEnd:normalizeDateValue_(row[1]),updatedAt:normalizeDateTimeValue_(row[3])});
  } catch (error) {
    return jsonResponse({success:false, message:error.message || String(error)});
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(10000)) throw new Error('Server sedang memproses penyimpanan lain. Silakan coba lagi.');
    if (!e || !e.postData || !e.postData.contents) throw new Error('POST body kosong.');
    const payload = JSON.parse(e.postData.contents);
    if (payload.action === 'save_master') return saveMaster_(payload.data);
    if (payload.action !== 'save') throw new Error('Action POST tidak valid.');

    const weekStart = String(payload.weekStart || '').trim();
    const weekEnd = String(payload.weekEnd || '').trim();
    const data = Array.isArray(payload.data) ? payload.data : [];
    if (!isIsoDate_(weekStart) || !isIsoDate_(weekEnd)) throw new Error('weekStart/weekEnd tidak valid.');
    if (weekEnd !== addDaysIso_(weekStart, 6)) throw new Error('weekEnd tidak sesuai dengan weekStart.');
    if (!data.length) throw new Error('Penyimpanan dibatalkan: data kosong. Data lama tidak disentuh.');
    const dataJson = JSON.stringify(data);
    if (dataJson.length > MAX_DATA_JSON_LENGTH) throw new Error('Data terlalu besar untuk satu record Google Sheets.');

    const sheet = getSheet_();
    const rows = findWeekRows_(sheet, weekStart);
    if (rows.length > 1) throw new Error('Ditemukan data duplikat untuk minggu '+weekStart+'. Penyimpanan dibatalkan agar tidak salah menimpa data.');
    let oldRow = null;
    let foundRow = -1;
    if (rows.length === 1) {
      foundRow = rows[0].rowNumber;
      oldRow = rows[0].values;
      const oldJson = String(oldRow[2] || '').trim();
      if (!oldJson) throw new Error('Data lama kosong/rusak. Penyimpanan dibatalkan agar data tidak tertimpa.');
      backupRow_(weekStart, oldRow);
    }
    const row = [weekStart, weekEnd, dataJson, new Date()];
    if (foundRow === -1) sheet.appendRow(row); else sheet.getRange(foundRow,1,1,4).setValues([row]);
    SpreadsheetApp.flush();
    return jsonResponse({success:true,message:'Data berhasil disimpan.',weekStart:weekStart,weekEnd:weekEnd});
  } catch (error) {
    return jsonResponse({success:false,message:error.message || String(error)});
  } finally { try { lock.releaseLock(); } catch (_) {} }
}

function getMaster_() {
  const sheet = getMasterSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return jsonResponse({success:true,data:[]});
  const values = sheet.getRange(2,1,lastRow-1,6).getValues();
  const data = values.filter(r=>String(r[0]||'').trim()).map(r=>({id:String(r[0]),nama:String(r[1]),gajiPokok:Number(r[2])||0,status:String(r[3]||'AKTIF'),createdAt:normalizeDateTimeValue_(r[4]),updatedAt:normalizeDateTimeValue_(r[5])}));
  return jsonResponse({success:true,data:data});
}

function saveMaster_(incoming) {
  if (!Array.isArray(incoming) || incoming.length === 0) throw new Error('Master karyawan tidak boleh kosong.');
  const clean = incoming.map((k,i)=>({id:String(k.id||'').trim(),nama:String(k.nama||'').trim(),gajiPokok:Number(k.gajiPokok)||0,status:String(k.status||'AKTIF').trim().toUpperCase()}));
  if (clean.some(k=>!k.id||!k.nama||k.gajiPokok<=0)) throw new Error('Master karyawan berisi ID, nama, atau gaji yang tidak valid.');
  const ids = clean.map(k=>k.id);
  if (new Set(ids).size !== ids.length) throw new Error('ID karyawan duplikat.');

  const sheet = getMasterSheet_();
  const old = readMasterMap_(sheet);
  backupMaster_(sheet);
  const now = new Date();
  const rows = clean.map(k=>{
    const prev=old[k.id];
    const created=prev&&prev.createdAt?prev.createdAt:now;
    if (prev && Number(prev.gajiPokok)!==Number(k.gajiPokok)) appendSalaryHistory_(k,prev.gajiPokok,now,'Perubahan gaji master');
    if (!prev) appendSalaryHistory_(k,0,now,'Karyawan baru');
    return [k.id,k.nama,k.gajiPokok,k.status,created,now];
  });
  if (sheet.getLastRow()>1) sheet.getRange(2,1,sheet.getLastRow()-1,6).clearContent();
  sheet.getRange(2,1,rows.length,6).setValues(rows);
  SpreadsheetApp.flush();
  return jsonResponse({success:true,message:'Master karyawan berhasil disimpan.',data:clean});
}

function getMasterSheet_() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let sheet=ss.getSheetByName(MASTER_SHEET_NAME);
  if (!sheet) {
    sheet=ss.insertSheet(MASTER_SHEET_NAME);
    sheet.getRange(1,1,1,6).setValues([['EMPLOYEE_ID','NAMA','GAJI_HARIAN','STATUS','CREATED_AT','UPDATED_AT']]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readMasterMap_(sheet) {
  const map={}; const lastRow=sheet.getLastRow();
  if(lastRow<=1)return map;
  const values=sheet.getRange(2,1,lastRow-1,6).getValues();
  values.forEach(r=>{const id=String(r[0]||'').trim();if(id)map[id]={nama:String(r[1]||''),gajiPokok:Number(r[2])||0,status:String(r[3]||'AKTIF'),createdAt:r[4],updatedAt:r[5]};});
  return map;
}

function backupMaster_(sheet) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let backup=ss.getSheetByName(MASTER_BACKUP_SHEET_NAME);
  if(!backup){backup=ss.insertSheet(MASTER_BACKUP_SHEET_NAME);backup.getRange(1,1,1,7).setValues([['BACKUP_AT','EMPLOYEE_ID','NAMA','GAJI_HARIAN','STATUS','CREATED_AT','UPDATED_AT']]);backup.setFrozenRows(1);}
  const lastRow=sheet.getLastRow(); if(lastRow<=1)return;
  const values=sheet.getRange(2,1,lastRow-1,6).getValues();
  values.filter(r=>String(r[0]||'').trim()).forEach(r=>backup.appendRow([new Date(),...r]));
  SpreadsheetApp.flush();
}

function appendSalaryHistory_(k,oldSalary,at,reason){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let sheet=ss.getSheetByName(SALARY_HISTORY_SHEET_NAME);
  if(!sheet){sheet=ss.insertSheet(SALARY_HISTORY_SHEET_NAME);sheet.getRange(1,1,1,7).setValues([['CHANGED_AT','EMPLOYEE_ID','NAMA','GAJI_LAMA','GAJI_BARU','BERLAKU_MULAI','ALASAN']]);sheet.setFrozenRows(1);}
  sheet.appendRow([at,k.id,k.nama,oldSalary,k.gajiPokok,at,reason]);
}

function getSheet_() { const ss=SpreadsheetApp.getActiveSpreadsheet(); const sheet=ss.getSheetByName(SHEET_NAME); if(!sheet)throw new Error('Sheet '+SHEET_NAME+' tidak ditemukan. Tidak ada sheet baru yang dibuat agar data tidak salah arah.'); if(sheet.getLastColumn()<4)throw new Error('Struktur sheet '+SHEET_NAME+' tidak lengkap.'); return sheet; }
function getBackupSheet_(){const ss=SpreadsheetApp.getActiveSpreadsheet();let sheet=ss.getSheetByName(BACKUP_SHEET_NAME);if(!sheet){sheet=ss.insertSheet(BACKUP_SHEET_NAME);sheet.getRange(1,1,1,6).setValues([['BACKUP_AT','WEEK_START','WEEK_END','DATA_JSON','SOURCE_UPDATED_AT','NOTE']]);sheet.setFrozenRows(1);}return sheet;}
function findWeekRows_(sheet,weekStart){const lastRow=sheet.getLastRow();if(lastRow<=1)return[];const values=sheet.getRange(2,1,lastRow-1,4).getValues();const matches=[];for(let i=0;i<values.length;i++){if(normalizeDateValue_(values[i][0])===weekStart)matches.push({rowNumber:i+2,values:values[i]});}return matches;}
function backupRow_(weekStart,row){getBackupSheet_().appendRow([new Date(),weekStart,normalizeDateValue_(row[1]),row[2],normalizeDateTimeValue_(row[3]),'Snapshot sebelum overwrite']);SpreadsheetApp.flush();}
function isIsoDate_(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''));}
function addDaysIso_(iso,days){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+days);return Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyy-MM-dd');}
function normalizeDateValue_(value){if(value instanceof Date)return Utilities.formatDate(value,Session.getScriptTimeZone(),'yyyy-MM-dd');const text=String(value||'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text;if(/^\d{4}-\d{2}-\d{2}T/.test(text))return text.substring(0,10);return text;}
function normalizeDateTimeValue_(value){if(value instanceof Date)return Utilities.formatDate(value,Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss');return String(value||'').trim();}
function jsonResponse(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
