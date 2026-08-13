function buatAbsensiKosong(){return {hadir:false,setengahHari:false,jamLembur:0,jamTelat:0}}
function buatStrukturKaryawan(nama,gaji,id=null,masterId=null){const abs={};HARI.forEach(h=>abs[h]=buatAbsensiKosong());return {id:id||("k_"+Date.now()+"_"+Math.random().toString(36).slice(2,9)),masterId:masterId?String(masterId):null,nama:String(nama),gajiPokok:Number(gaji)||0,absensi:abs,bonus:0,kasbon:0}}
function normalisasiKaryawan(k){const x=buatStrukturKaryawan(k.nama,k.gajiPokok,k.id,k.masterId||k.employeeId||null);x.bonus=Number(k.bonus)||0;x.kasbon=Number(k.kasbon)||0;HARI.forEach(h=>{const a=k.absensi&&k.absensi[h]?k.absensi[h]:{};x.absensi[h]={hadir:!!a.hadir,setengahHari:!!a.setengahHari,jamLembur:Number(a.jamLembur)||0,jamTelat:Number(a.jamTelat)||0}});return x}
function karyawanSudahAdaDiPeriode(masterId){return !!masterId&&dataKaryawan.some(k=>String(k.masterId||k.employeeId||'')===String(masterId))}

async function daftarKaryawanKeMasterDariAbsensi(nama,gaji){
  if(!masterLoaded)await muatMasterKaryawan();
  if(!masterLoaded)throw new Error('Master karyawan tidak dapat dimuat. Karyawan belum ditambahkan agar data tidak setengah tersimpan.');
  const existing=masterKaryawan.find(k=>k.nama.trim().toLowerCase()===nama.trim().toLowerCase());
  if(existing){
    if(existing.status!=='AKTIF')throw new Error(`${existing.nama} sudah ada di Master dengan status NONAKTIF. Aktifkan dari Kelola Master Karyawan terlebih dahulu.`);
    return existing;
  }
  const id='K_'+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,5).toUpperCase();
  masterKaryawan.push({id,nama:nama.trim(),gajiPokok:Number(gaji),status:'AKTIF',createdAt:'',updatedAt:''});
  await simpanMasterKaryawan();
  const created=masterKaryawan.find(k=>k.id===id);
  if(!created)throw new Error('Karyawan belum dapat diverifikasi dari Master.');
  return created;
}

async function tambahKaryawan(){
  const n=document.getElementById("namaKaryawan"),g=document.getElementById("gajiPokok"),enroll=document.getElementById("daftarKeMaster");
  const nama=n.value.trim(),gaji=Number(g.value);
  if(!nama||!Number.isFinite(gaji)||gaji<=0){alert("Mohon isi nama dan gaji pokok harian yang valid!");return}
  const shouldEnroll=!enroll||enroll.checked;
  try{
    let masterId=null;
    if(shouldEnroll){
      setStatusSync('loading','Mendaftarkan karyawan ke Master...');
      const master=await daftarKaryawanKeMasterDariAbsensi(nama,gaji);
      masterId=master.id;
      n.value="";g.value="";
      dataKaryawan.push(buatStrukturKaryawan(master.nama,master.gajiPokok,null,masterId));
      pemicuAutoSave();
      setStatusSync('active',`${master.nama} ditambahkan ke periode dan Master`);
    }else{
      dataKaryawan.push(buatStrukturKaryawan(nama,gaji));
      n.value="";g.value="";
      pemicuAutoSave();
    }
  }catch(e){
    console.error(e);setStatusSync('error',e.message||'Karyawan belum berhasil ditambahkan.');alert(e.message||'Karyawan belum berhasil ditambahkan.');
  }
}

function tambahKaryawanDariMaster(masterId){const master=masterKaryawan.find(k=>String(k.id)===String(masterId));if(!master){alert("Karyawan master tidak ditemukan.");return}if(master.status!=="AKTIF"){alert("Karyawan tersebut berstatus NONAKTIF dan tidak dapat ditambahkan ke periode baru.");return}if(karyawanSudahAdaDiPeriode(master.id)){alert(`${master.nama} sudah ada di periode ini.`);return}dataKaryawan.push(buatStrukturKaryawan(master.nama,master.gajiPokok,null,master.id));tutupPilihMaster();pemicuAutoSave()}
async function bukaPilihMaster(){const modal=document.getElementById("selectMasterModal");if(!modal)return;modal.classList.add("show");modal.setAttribute("aria-hidden","false");const list=document.getElementById("selectMasterEmployeeList");if(list)list.innerHTML='<div class="master-loading">⏳ Mengambil karyawan aktif dari Master...</div>';if(!masterLoaded){await muatMasterKaryawan()}renderPilihMaster()}
function tutupPilihMaster(){const modal=document.getElementById("selectMasterModal");if(!modal)return;modal.classList.remove("show");modal.setAttribute("aria-hidden","true")}
function renderPilihMaster(){const list=document.getElementById("selectMasterEmployeeList");if(!list)return;const aktif=masterKaryawan.filter(k=>k.status==="AKTIF");if(!aktif.length){list.innerHTML='<div class="master-empty">Belum ada karyawan AKTIF di Master Karyawan.</div>';return}list.innerHTML=aktif.map(k=>{const sudah=karyawanSudahAdaDiPeriode(k.id);return `<button class="select-master-row ${sudah?'already':''}" ${sudah?'disabled':''} onclick="tambahKaryawanDariMaster('${escapeJs(k.id)}')"><span><strong>${escapeHtml(k.nama)}</strong><small>${escapeHtml(k.id)} · ${formatRupiah(k.gajiPokok)}/hari</small></span><span>${sudah?'✓ Sudah ditambahkan':'Tambah'}</span></button>`}).join('')}
function hapusKaryawan(id){if(dataKaryawan.length<=1){alert("Karyawan terakhir tidak dapat dihapus agar data minggu tidak pernah menjadi kosong.");return}if(!verifikasiPin())return;dataKaryawan=dataKaryawan.filter(k=>k.id!==id);pemicuAutoSave()}
function resetSemuaKeDefault(){if(!verifikasiPin())return;if(!confirm("Kembalikan daftar karyawan minggu aktif ke default? Minggu lain tetap aman."))return;dataKaryawan=DEFAULT_KARYAWAN.map(k=>buatStrukturKaryawan(k.nama,k.gajiPokok));pemicuAutoSave()}
