const PAYROLL_PAYMENT_SHEET_NAME = 'STATUS_PEMBAYARAN_GAJI';

function getPayrollPayment_(weekStart) {
  if (!isIsoDate_(weekStart)) throw new Error('weekStart tidak valid.');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PAYROLL_PAYMENT_SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) {
    return {status:'UNPAID', paidAt:null, paidAmount:0, updatedAt:null};
  }
  const values = sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues();
  for (let i=values.length-1;i>=0;i--) {
    if (normalizeDateValue_(values[i][0]) === weekStart) {
      return {status:String(values[i][2]||'UNPAID'), paidAt:normalizeDateTimeValue_(values[i][3]), paidAmount:Number(values[i][4])||0, updatedAt:normalizeDateTimeValue_(values[i][5])};
    }
  }
  return {status:'UNPAID', paidAt:null, paidAmount:0, updatedAt:null};
}

function savePayrollPayment_(payload) {
  const weekStart = String(payload.weekStart||'').trim();
  const weekEnd = String(payload.weekEnd||'').trim();
  if (!isIsoDate_(weekStart) || !isIsoDate_(weekEnd)) throw new Error('weekStart/weekEnd tidak valid.');
  if (weekEnd !== addDaysIso_(weekStart,6)) throw new Error('weekEnd tidak sesuai dengan weekStart.');
  const status = String(payload.status||'UNPAID').trim().toUpperCase();
  if (!['UNPAID','PAID'].includes(status)) throw new Error('Status pembayaran tidak valid.');
  const amount = Math.max(0, Number(payload.paidAmount)||0);
  const now = new Date();
  const paidAt = status === 'PAID' ? (payload.paidAt ? new Date(payload.paidAt) : now) : '';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PAYROLL_PAYMENT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PAYROLL_PAYMENT_SHEET_NAME);
    sheet.getRange(1,1,1,6).setValues([['WEEK_START','WEEK_END','STATUS','PAID_AT','PAID_AMOUNT','UPDATED_AT']]);
    sheet.setFrozenRows(1);
  }
  const lastRow = sheet.getLastRow();
  let found = -1;
  if (lastRow > 1) {
    const starts = sheet.getRange(2,1,lastRow-1,1).getValues();
    for (let i=0;i<starts.length;i++) if (normalizeDateValue_(starts[i][0]) === weekStart) { found=i+2; break; }
  }
  const row=[weekStart,weekEnd,status,paidAt,amount,now];
  if(found===-1) sheet.appendRow(row); else sheet.getRange(found,1,1,6).setValues([row]);
  SpreadsheetApp.flush();
  return jsonResponse({success:true,message:'Status pembayaran berhasil disimpan.',weekStart,weekEnd,payrollPayment:{status,paidAt:normalizeDateTimeValue_(paidAt),paidAmount:amount,updatedAt:normalizeDateTimeValue_(now)}});
}

function getPayrollPaymentHistory_() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const sheet=ss.getSheetByName(PAYROLL_PAYMENT_SHEET_NAME);
  if(!sheet || sheet.getLastRow()<=1) return jsonResponse({success:true,data:[]});
  const values=sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues();
  const data=values.filter(r=>String(r[0]||'').trim()).map(r=>({weekStart:normalizeDateValue_(r[0]),weekEnd:normalizeDateValue_(r[1]),status:String(r[2]||'UNPAID'),paidAt:normalizeDateTimeValue_(r[3]),paidAmount:Number(r[4])||0,updatedAt:normalizeDateTimeValue_(r[5])})).reverse();
  return jsonResponse({success:true,data});
}