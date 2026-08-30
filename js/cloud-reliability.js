/* Cloud reliability layer — loaded after cloud.js. Backend/API contract unchanged. */
async function verifikasiSimpanCloud(periode,expectedData,expectedPayments){
  const maxAttempts=4;
  let lastError=null;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try{
      const cloud=await bacaMingguDariCloud(periode);
      if(!cloud.data.length)throw new Error("Cloud belum mengembalikan data minggu yang baru disimpan.");
      if(dataSignature(cloud.data)!==dataSignature(expectedData))throw new Error("Data cloud belum sama dengan data yang dikirim.");
      if(paymentSignature(cloud.payrollPayments)!==paymentSignature(expectedPayments))throw new Error("Status pembayaran cloud belum sama dengan yang dikirim.");
      return cloud;
    }catch(e){
      lastError=e;
      if(attempt<maxAttempts)await new Promise(resolve=>setTimeout(resolve,attempt*900));
    }
  }
  throw lastError||new Error("Verifikasi penyimpanan gagal.");
}

async function simpanDataKeCloudDirect(silent=false,periodeOverride=null,dataOverride=null,paymentOverride=null){
  const p=periodeOverride||getPeriodeMinggu();
  if(!p)return false;
  if(!cloudReadyForWeek||loadedWeekKey!==p.start){setStatusSync("error","Cloud belum siap. Penyimpanan dibatalkan agar data lama tidak tersentuh.");return false}
  const payloadData=dataOverride||dataKaryawan;
  const payloadPayments=normalisasiPayrollPayments(paymentOverride||payrollPayments);
  if(!Array.isArray(payloadData)||payloadData.length===0){setStatusSync("error","Penyimpanan dibatalkan: data kosong. Data lama tidak disentuh.");pendingSave=false;return false}
  if(saveInFlight){queuedSave={silent,periode:{start:p.start,end:p.end},data:JSON.parse(JSON.stringify(payloadData)),payments:JSON.parse(JSON.stringify(payloadPayments))};pendingSave=true;setStatusSync("loading","Penyimpanan sebelumnya masih berjalan. Perubahan terbaru diantrikan...");return false}
  saveInFlight=true;
  let success=false;
  let next=null;
  backupLocal(p.start,JSON.parse(JSON.stringify(payloadData)));
  const payload={action:"save",weekStart:p.start,weekEnd:p.end,data:payloadData,payrollPayments:payloadPayments};
  try{
    if(!silent)setStatusSync("loading",`Menyimpan ${formatTanggalIndonesia(p.start)} s/d ${formatTanggalIndonesia(p.end)}...`);
    await fetch(CONFIG.SCRIPT_URL,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});
    await verifikasiSimpanCloud(p,payloadData,payloadPayments);
    payrollPayments=payloadPayments;
    pendingSave=false;
    success=true;
    setStatusSync("active",`Tersimpan & terverifikasi — ${formatTanggalIndonesia(p.start)} s/d ${formatTanggalIndonesia(p.end)}`);
  }catch(e){
    console.error("Cloud save verification:",e);
    /* A temporary verification delay must not immediately lock the week. */
    cloudReadyForWeek=true;
    pendingSave=false;
    setStatusSync("error","Cloud belum terverifikasi. Backup lokal dipertahankan; silakan coba Simpan lagi bila status belum pulih.");
  }finally{
    saveInFlight=false;
    next=queuedSave;
    queuedSave=null;
  }
  if(next){payrollPayments=next.payments;return simpanDataKeCloudDirect(next.silent,next.periode,next.data,next.payments)}
  return success;
}
