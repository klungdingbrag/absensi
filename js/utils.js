function setStatusSync(type,text){document.getElementById("syncDot").className="dot "+type;document.getElementById("syncText").innerText=text}
function formatRupiah(n){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0)}
function formatDateISO(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function formatTanggalIndonesia(s){return new Date(s+"T00:00:00").toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})}
function verifikasiPin(){const x=prompt("Masukkan PIN Admin:");if(x===CONFIG.PIN_ADMIN)return true;alert("PIN Salah!");return false}
