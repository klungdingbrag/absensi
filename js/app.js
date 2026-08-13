function mingguIniStart(){
  const d=new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate()-d.getDay());
  return formatDateISO(d);
}

function kembaliKeMingguIni(){
  const target=mingguIniStart();
  if(!target)return;

  const current=mendapatkanPeriodeAktif();
  if(current && current.start===target){
    updateStatusNavigasi();
    return;
  }

  clearTimeout(timerSave);
  timerSave=null;
  pendingSave=false;

  const input=document.getElementById('tglMulai');
  if(!input)return;

  // Jangan langsung memicu dua proses update sekaligus.
  input.value=target;
  updatePeriodeTanggal(false);
  updateStatusNavigasi();
  muatDataDariCloud();
}

function mendapatkanPeriodeAktif(){
  const input=document.getElementById('tglMulai')?.value;
  if(!input)return null;
  const start=new Date(input+'T00:00:00');
  start.setDate(start.getDate()-start.getDay());
  const end=new Date(start);
  end.setDate(end.getDate()+6);
  return {start:formatDateISO(start),end:formatDateISO(end)};
}

function updateStatusNavigasi(){
  const label=document.getElementById('periodeStatus');
  const btn=document.getElementById('btnMingguIni');
  const p=mendapatkanPeriodeAktif();
  if(!label||!p)return;
  const now=mingguIniStart();
  if(p.start===now){
    label.textContent='● MINGGU BERJALAN';
    label.className='period-status current';
    if(btn)btn.disabled=true;
  }else if(p.start<now){
    label.textContent='◷ HISTORI';
    label.className='period-status history';
    if(btn)btn.disabled=false;
  }else{
    label.textContent='→ MENDATANG';
    label.className='period-status future';
    if(btn)btn.disabled=false;
  }
}

// Sinkronkan label navigasi setiap kali periode berubah.
document.getElementById('tglMulai').addEventListener('change',()=>{
  updatePeriodeTanggal(true);
  updateStatusNavigasi();
});

window.addEventListener('DOMContentLoaded',()=>{
  const now=new Date(),start=new Date(now);
  start.setDate(now.getDate()-now.getDay());
  document.getElementById('tglMulai').value=formatDateISO(start);
  updatePeriodeTanggal(false);
  updateStatusNavigasi();
  muatDataDariCloud();
});
