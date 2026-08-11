document.getElementById("tglMulai").addEventListener("change",()=>updatePeriodeTanggal(true));
window.addEventListener("DOMContentLoaded",()=>{
  const now=new Date(),start=new Date(now);start.setDate(now.getDate()-now.getDay());
  document.getElementById("tglMulai").value=formatDateISO(start);
  updatePeriodeTanggal(false);
  muatDataDariCloud();
});
