function mingguSekarangStart(){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-d.getDay());return formatDateISO(d)}
function kembaliKeMingguIni(){const current=getPeriodeMinggu();const target=mingguSekarangStart();if(!current)return;document.getElementById("tglMulai").value=target;updatePeriodeTanggal(true)}
function updateStatusNavigasi(){const btn=document.getElementById("btnMingguIni");if(!btn)return;const current=getPeriodeMinggu();const isCurrent=current&&current.start===mingguSekarangStart();btn.disabled=!!isCurrent;btn.classList.toggle("current",!!isCurrent);btn.textContent=isCurrent?"✓ Minggu Ini":"↩ Minggu Ini"}
document.getElementById("tglMulai").addEventListener("change",()=>updatePeriodeTanggal(true));
window.addEventListener("DOMContentLoaded",()=>{
  const now=new Date(),start=new Date(now);start.setDate(now.getDate()-now.getDay());
  document.getElementById("tglMulai").value=formatDateISO(start);
  updatePeriodeTanggal(false);
  muatDataDariCloud();
});
