function getPeriodeMinggu(){const input=document.getElementById("tglMulai").value;if(!input)return null;const start=new Date(input+"T00:00:00");start.setDate(start.getDate()-start.getDay());const end=new Date(start);end.setDate(end.getDate()+6);return {start:formatDateISO(start),end:formatDateISO(end)}}

function backupLocal(weekKey,data){try{localStorage.setItem(LOCAL_BACKUP_PREFIX+weekKey,JSON.stringify({weekStart:weekKey,savedAt:new Date().toISOString(),data:data}))}catch(e){console.warn("Local backup gagal:",e)}}
function readLocalBackup(weekKey){try{const raw=localStorage.getItem(LOCAL_BACKUP_PREFIX+weekKey);return raw?JSON.parse(raw):null}catch(e){return null}}
function dataSignature(data){return JSON.stringify((Array.isArray(data)?data:[]).map(normalisasiKaryawan))}

async function buatKaryawanMingguBaruDariMaster(){
  try{
    const res=await fetch(`${CONFIG.SCRIPT_URL}?action=master`,{cache:"no-store"});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const result=await res.json();
    if(!result||result.success!==true||!Array.isArray(result.data))throw new Error(result?.message||"Respons master tidak valid.");
    const aktif=result.data.filter(k=>String(k.status||"AKTIF").toUpperCase()==="AKTIF");
    if(aktif.length){
      return aktif.map(k=>buatStrukturKaryawan(String(k.nama||""),Number(k.gajiPokok)||0,null,String(k.id||"")));
    }
  }catch(e){
    console.warn("Master belum dapat digunakan untuk minggu baru, fallback ke default:",e);
  }
  return DEFAULT_KARYAWAN.map(k=>buatStrukturKaryawan(k.nama,k.gajiPokok));
}

function updatePeriodeTanggal(autoLoad=false){const p=getPeriodeMinggu();if(!p)return;clearTimeout(timerSave);timerSave=null;pendingSave=false;document.getElementById("tglMulai").value=p.start;document.getElementById("tglSelesai").value=p.end;const start=new Date(p.start+"T00:00:00");HARI.forEach((h,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);document.getElementById("date-"+h).innerText=d.toLocaleDateString("id-ID",{day:"numeric",month:"short"})});document.getElementById("periodeAktif").innerText=`PERIODE AKTIF: ${formatTanggalIndonesia(p.start)} — ${formatTanggalIndonesia(p.end)}`;if(autoLoad)muatDataDariCloud()}
function pindahMinggu(delta){const p=getPeriodeMinggu();if(!p)return;clearTimeout(timerSave);timerSave=null;pendingSave=false;const d=new Date(p.start+"T00:00:00");d.setDate(d.getDate()+delta*7);document.getElementById("tglMulai").value=formatDateISO(d);updatePeriodeTanggal(true)}

async function bacaMingguDariCloud(periode){const res=await fetch(`${CONFIG.SCRIPT_URL}?action=get&weekStart=${encodeURIComponent(periode.start)}`,{cache:"no-store"});if(!res.ok)throw new Error(`HTTP ${res.status}`);const result=await res.json();if(!result||result.success!==true)throw new Error(result?.message||"Respons cloud tidak valid");if(result.weekStart&&result.weekStart!==periode.start)throw new Error("Cloud mengembalikan periode yang berbeda.");if(!Array.isArray(result.data))throw new Error("Format data cloud tidak valid.");return result.data}

async function verifikasiSimpanCloud(periode,expectedData){const cloudData=await bacaMingguDariCloud(periode);if(!cloudData.length)throw new Error("Verifikasi gagal: cloud tidak mengembalikan data minggu yang baru disimpan.");if(dataSignature(cloudData)!==dataSignature(expectedData))throw new Error("Verifikasi gagal: data cloud berbeda dari data yang dikirim.");return cloudData}

async function muatDataDariCloud(){if(loadingWeek)return;loadingWeek=true;cloudReadyForWeek=false;pendingSave=false;const p=getPeriodeMinggu();if(!p){loadingWeek=false;return}setStatusSync("loading",`Mengambil data ${p.start} s/d ${p.end}...`);try{const cloudData=await bacaMingguDariCloud(p);if(cloudData.length>0){dataKaryawan=cloudData.map(normalisasiKaryawan);loadedWeekKey=p.start;cloudReadyForWeek=true;backupLocal(p.start,dataKaryawan);setStatusSync("active",`Cloud aktif — ${formatTanggalIndonesia(p.start)} s/d ${formatTanggalIndonesia(p.end)}`);renderTabel();return}
// GET berhasil dan benar-benar kosong: buat minggu baru berdasarkan Master Karyawan aktif.
dataKaryawan=await buatKaryawanMingguBaruDariMaster();if(!dataKaryawan.length){throw new Error("Tidak ada karyawan aktif untuk membuat minggu baru.")};loadedWeekKey=p.start;cloudReadyForWeek=true;backupLocal(p.start,dataKaryawan);setStatusSync("loading",`Minggu baru — ${dataKaryawan.length} karyawan dari Master...`);renderTabel();await simpanDataKeCloudDirect(true,p,JSON.parse(JSON.stringify(dataKaryawan)));
}catch(e){console.error(e);cloudReadyForWeek=false;pendingSave=false;const localBackup=readLocalBackup(p.start);if(localBackup&&Array.isArray(localBackup.data)){dataKaryawan=localBackup.data.map(normalisasiKaryawan);setStatusSync("error",`Cloud gagal — backup lokal ditampilkan untuk ${formatTanggalIndonesia(p.start)}. Perubahan dikunci sampai cloud pulih.`);renderTabel()}else{setStatusSync("error","Cloud gagal dimuat. Data TIDAK diubah dan TIDAK disimpan ulang.")}}finally{loadingWeek=false}}

function pemicuAutoSave(){renderTabel();clearTimeout(timerSave);const p=getPeriodeMinggu();if(!p||!cloudReadyForWeek||loadedWeekKey!==p.start){setStatusSync("error","Cloud belum siap. Perubahan TIDAK disimpan untuk mencegah kehilangan data.");return}const snapshot=JSON.parse(JSON.stringify(dataKaryawan));backupLocal(p.start,snapshot);pendingSave=true;setStatusSync("loading","Perubahan menunggu disimpan...");timerSave=setTimeout(()=>simpanDataKeCloudDirect(false,p,snapshot),800)}

async function simpanDataKeCloudDirect(silent=false,periodeOverride=null,dataOverride=null){const p=periodeOverride||getPeriodeMinggu();if(!p)return;if(!cloudReadyForWeek||loadedWeekKey!==p.start){setStatusSync("error","Cloud belum siap. Penyimpanan dibatalkan agar data lama tidak tersentuh.");return false}const payloadData=dataOverride||dataKaryawan;if(!Array.isArray(payloadData)||payloadData.length===0){setStatusSync("error","Penyimpanan dibatalkan: data kosong. Data lama tidak disentuh.");pendingSave=false;return false}
if(saveInFlight){queuedSave={silent,periode:{start:p.start,end:p.end},data:JSON.parse(JSON.stringify(payloadData))};pendingSave=true;setStatusSync("loading","Penyimpanan sebelumnya masih berjalan. Perubahan terbaru diantrikan...");return false}
saveInFlight=true;let success=false;let next=null;const safetyBackup=JSON.parse(JSON.stringify(payloadData));backupLocal(p.start,safetyBackup);const payload={action:"save",weekStart:p.start,weekEnd:p.end,data:payloadData};try{if(!silent)setStatusSync("loading",`Menyimpan ${formatTanggalIndonesia(p.start)} s/d ${formatTanggalIndonesia(p.end)}...`);await fetch(CONFIG.SCRIPT_URL,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});await verifikasiSimpanCloud(p,payloadData);pendingSave=false;success=true;setStatusSync("active",`Tersimpan & terverifikasi — ${formatTanggalIndonesia(p.start)} s/d ${formatTanggalIndonesia(p.end)}`)}catch(e){console.error(e);cloudReadyForWeek=false;pendingSave=false;setStatusSync("error","Penyimpanan belum terverifikasi. Backup lokal dipertahankan dan data cloud lama tidak dianggap aman tertimpa.")}finally{saveInFlight=false;next=queuedSave;queuedSave=null}
if(next){return simpanDataKeCloudDirect(next.silent,next.periode,next.data)}return success}
