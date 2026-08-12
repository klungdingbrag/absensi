const SHEET_NAME = 'ABSENSI_MINGGUAN';
const BACKUP_SHEET_NAME = 'ABSENSI_BACKUP';

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || 'get';
    if (action !== 'get') return jsonResponse({ success:false, message:'Action tidak dikenal.' });

    const weekStart = String(params.weekStart || '').trim();
    if (!weekStart) return jsonResponse({ success:false, message:'weekStart tidak ditemukan.' });

    const sheet = getSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return jsonResponse({ success:true, data:[], weekStart:weekStart });

    const values = sheet.getRange(2,1,lastRow-1,4).getValues();
    for (let i=0;i<values.length;i++) {
      const storedWeekStart = normalizeDateValue_(values[i][0]);
      if (storedWeekStart === weekStart) {
        let data = [];
        try { data = JSON.parse(values[i][2] || '[]'); } catch (_) { throw new Error('DATA_JSON rusak untuk minggu '+weekStart); }
        if (!Array.isArray(data)) throw new Error('DATA_JSON bukan array untuk minggu '+weekStart);
        return jsonResponse({ success:true, data:data, weekStart:storedWeekStart, weekEnd:normalizeDateValue_(values[i][1]) });
      }
    }
    return jsonResponse({ success:true, data:[], weekStart:weekStart });
  } catch (error) {
    return jsonResponse({ success:false, message:error.message || String(error) });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('POST body kosong.');
    const payload = JSON.parse(e.postData.contents);
    if (payload.action !== 'save') throw new Error('Action POST tidak valid.');

    const weekStart = String(payload.weekStart || '').trim();
    const weekEnd = String(payload.weekEnd || '').trim();
    const data = Array.isArray(payload.data) ? payload.data : [];
    if (!weekStart || !weekEnd) throw new Error('weekStart dan weekEnd wajib diisi.');
    if (!data.length) throw new Error('Penyimpanan dibatalkan: data kosong. Data lama tidak disentuh.');

    const sheet = getSheet_();
    const lastRow = sheet.getLastRow();
    let foundRow = -1;
    let oldRow = null;

    if (lastRow > 1) {
      const values = sheet.getRange(2,1,lastRow-1,4).getValues();
      for (let i=0;i<values.length;i++) {
        if (normalizeDateValue_(values[i][0]) === weekStart) {
          foundRow = i + 2;
          oldRow = values[i];
          break;
        }
      }
    }

    // Backup sebelum overwrite. Jika update berikutnya bermasalah, histori lama masih tersedia.
    if (foundRow !== -1 && oldRow) {
      backupRow_(weekStart, oldRow);
    }

    const row = [weekStart, weekEnd, JSON.stringify(data), new Date()];
    if (foundRow === -1) sheet.appendRow(row);
    else sheet.getRange(foundRow,1,1,4).setValues([row]);

    SpreadsheetApp.flush();
    return jsonResponse({ success:true, message:'Data berhasil disimpan.', weekStart:weekStart, weekEnd:weekEnd });
  } catch (error) {
    return jsonResponse({ success:false, message:error.message || String(error) });
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1,1,1,4).setValues([['WEEK_START','WEEK_END','DATA_JSON','UPDATED_AT']]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getBackupSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(BACKUP_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(BACKUP_SHEET_NAME);
    sheet.getRange(1,1,1,6).setValues([['BACKUP_AT','WEEK_START','WEEK_END','DATA_JSON','SOURCE_UPDATED_AT','NOTE']]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function backupRow_(weekStart, row) {
  const backup = getBackupSheet_();
  backup.appendRow([new Date(), weekStart, normalizeDateValue_(row[1]), row[2], normalizeDateValue_(row[3]), 'Snapshot sebelum overwrite']);
}

function normalizeDateValue_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.substring(0,10);
  return text;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
