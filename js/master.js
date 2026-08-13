let masterKaryawan=[];
let masterLoaded=false;
let masterSaveInFlight=false;

async function bukaMasterKaryawan(){
  const modal=document.getElementById('masterModal');
  if(!modal)return;
  modal.classList.add('show');
  const panel=document.getElementById('salaryHistoryPanel');if(panel)panel.innerHTML='';
  await muatMasterKaryawan();
}
function tutupMasterKaryawan(){document.getElementById('masterModal')?.classList.remove('show');}

async function muatMasterKaryawan(){
  const list=document.getElementById('masterEmployeeList');
  if(list)list.innerHTML='<div class="master-loading">⏳ Mengambil master karyawan dari cloud...</div>';
  try{
    const res=await fetch(`${CONFIG.SCRIPT_URL}?action=master`,{cache:'no-store'});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const result=await res.json();
    if(!result||result.success!==true||!Array.isArray(result.data))throw new Error(result?.message||'Respons master tidak valid.');
    masterKaryawan=result.data.map(normalisasiMaster);
    masterLoaded=true;
    renderMasterKaryawan();
  }catch(e){
    console.error(e);
    if(list)list.innerHTML='<div class="master-error">🔴 Master karyawan gagal dimuat. Data absensi mingguan tidak diubah.</div>';
  }
}

function normalisasiMaster(k){return {id:String(k.id||''),nama:String(k.nama||''),gajiPokok:Number(k.gajiPokok)||0,status:String(k.status||'AKTIF').toUpperCase(),createdAt:k.createdAt||'',updatedAt:k.updatedAt||''};}

function renderMasterKaryawan(){
  const list=document.getElementById('masterEmployeeList');
  if(!list)return;
  const aktif=masterKaryawan.filter(k=>k.status==='AKTIF');
  const nonaktif=masterKaryawan.filter(k=>k.status!=='AKTIF');
  const ordered=[...aktif,...nonaktif];
  if(!ordered.length){list.innerHTML='<div class="master-empty">Belum ada master karyawan.</div>';return;}
  list.innerHTML=ordered.map(k=>`
    <div class="master-employee-row ${k.status!=='AKTIF'?'inactive':''}">
      <div class="master-employee-info">
        <strong>${escapeHtml(k.nama)}</strong>
        <span>${escapeHtml(k.id)} · ${formatRupiah(k.gajiPokok)}/hari</span>
      </div>
      <div class="master-employee-meta"><span class="status-pill">${escapeHtml(k.status)}</span><button class="btn secondary mini" onclick="lihatRiwayatGaji('${escapeJs(k.id)}')">Riwayat</button><button class="btn secondary mini" onclick="editMasterKaryawan('${escapeJs(k.id)}')">Edit</button></div>
    </div>`).join('');
}

async function lihatRiwayatGaji(id){
  const k=masterKaryawan.find(x=>x.id===id);if(!k)return;
  const panel=document.getElementById('salaryHistoryPanel');
  if(panel)panel.innerHTML=`<div class="salary-history-card"><div class="salary-history-title">⏳ Riwayat Gaji — ${escapeHtml(k.nama)}</div></div>`;
  try{
    const res=await fetch(`${CONFIG.SCRIPT_URL}?action=salary_history&employeeId=${encodeURIComponent(id)}`,{cache:'no-store'});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const result=await res.json();
    if(!result||result.success!==true||!Array.isArray(result.data))throw new Error(result?.message||'Respons riwayat gaji tidak valid.');
    renderRiwayatGaji(k,result.data);
  }catch(e){
    console.error(e);
    if(panel)panel.innerHTML='<div class="master-error">🔴 Riwayat gaji gagal dimuat. Data master dan absensi tidak diubah.</div>';
  }
}

function renderRiwayatGaji(k,history){
  const panel=document.getElementById('salaryHistoryPanel');if(!panel)return;
  if(!history.length){panel.innerHTML=`<div class="salary-history-card"><div class="salary-history-title">Riwayat Gaji — ${escapeHtml(k.nama)}</div><div class="master-empty">Belum ada riwayat perubahan gaji.</div></div>`;return;}
  panel.innerHTML=`<div class="salary-history-card"><div class="salary-history-head"><strong>📈 Riwayat Gaji — ${escapeHtml(k.nama)}</strong><button class="btn secondary mini" onclick="tutupRiwayatGaji()">Tutup</button></div><div class="salary-history-table"><div class="salary-history-row salary-history-header"><span>Tanggal</span><span>Gaji Lama</span><span>Gaji Baru</span><span>Alasan</span></div>${history.map(h=>`<div class="salary-history-row"><span>${escapeHtml(h.changedAt||'-')}</span><span>${formatRupiah(h.gajiLama||0)}</span><span>${formatRupiah(h.gajiBaru||0)}</span><span>${escapeHtml(h.alasan||'-')}</span></div>`).join('')}</div></div>`;
}
function tutupRiwayatGaji(){const panel=document.getElementById('salaryHistoryPanel');if(panel)panel.innerHTML='';}

function editMasterKaryawan(id){
  const k=masterKaryawan.find(x=>x.id===id);if(!k)return;
  if(!verifikasiPin())return;
  const nama=prompt('Nama karyawan:',k.nama);if(nama===null)return;
  const gaji=prompt('Gaji harian (Rp):',String(k.gajiPokok));if(gaji===null)return;
  const salary=Number(gaji);if(!nama.trim()||!Number.isFinite(salary)||salary<=0){alert('Nama dan gaji harus valid.');return;}
  const status=prompt('Status (AKTIF/NONAKTIF):',k.status);if(status===null)return;
  const normalizedStatus=status.trim().toUpperCase();if(!['AKTIF','NONAKTIF'].includes(normalizedStatus)){alert('Status harus AKTIF atau NONAKTIF.');return;}
  k.nama=nama.trim();k.gajiPokok=salary;k.status=normalizedStatus;
  simpanMasterKaryawan();
}

function tambahMasterKaryawan(){
  if(!verifikasiPin())return;
  const nama=prompt('Nama karyawan baru:');if(nama===null)return;
  const gaji=prompt('Gaji harian (Rp):');if(gaji===null)return;
  const salary=Number(gaji);if(!nama.trim()||!Number.isFinite(salary)||salary<=0){alert('Nama dan gaji harus valid.');return;}
  const id='K_'+Date.now().toString(36).toUpperCase();
  masterKaryawan.push({id,nama:nama.trim(),gajiPokok:salary,status:'AKTIF',createdAt:'',updatedAt:''});
  simpanMasterKaryawan();
}

async function simpanMasterKaryawan(){
  if(masterSaveInFlight)return;
  if(!masterKaryawan.length){alert('Master karyawan tidak boleh kosong.');return;}
  masterSaveInFlight=true;
  const snapshot=JSON.parse(JSON.stringify(masterKaryawan));
  setStatusSync('loading','Menyimpan master karyawan...');
  try{
    await fetch(CONFIG.SCRIPT_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'save_master',data:snapshot})});
    await new Promise(r=>setTimeout(r,350));
    const verifyRes=await fetch(`${CONFIG.SCRIPT_URL}?action=master`,{cache:'no-store'});
    if(!verifyRes.ok)throw new Error(`HTTP ${verifyRes.status}`);
    const result=await verifyRes.json();
    if(!result||result.success!==true||!Array.isArray(result.data))throw new Error(result?.message||'Verifikasi master gagal.');
    const verified=result.data.map(normalisasiMaster);
    if(JSON.stringify(verified.map(x=>[x.id,x.nama,x.gajiPokok,x.status]))!==JSON.stringify(snapshot.map(x=>[x.id,x.nama,x.gajiPokok,x.status])))throw new Error('Data master cloud berbeda dari data yang dikirim.');
    masterKaryawan=verified;renderMasterKaryawan();setStatusSync('active','Master karyawan tersimpan & terverifikasi');
  }catch(e){console.error(e);setStatusSync('error','Master gagal diverifikasi. Data absensi mingguan tidak diubah.');alert('Master karyawan belum berhasil diverifikasi. Tidak ada perubahan pada absensi mingguan.');}
  finally{masterSaveInFlight=false;}
}

function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function escapeJs(v){return String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
