# TB NUSANTARA — ABSENSI & GAJI

## Production Release v1.0.0

Status: **STABLE / PRODUCTION**

Baseline release dibuat dari commit final yang telah melewati pengujian fungsional.

### Fitur utama
- Absensi mingguan
- Perhitungan payroll
- Lembur, keterlambatan, bonus, dan kasbon
- Status pembayaran gaji
- Slip gaji dan WhatsApp
- Master Karyawan
- Riwayat perubahan gaji
- Backup histori
- Cloud synchronization dan local backup
- Responsive desktop/mobile
- Dark mode
- Last Sync dan status periode
- Fail-safe data protection

### Prinsip release
Versi ini menjadi **baseline production**. Jangan melakukan perubahan fitur langsung pada branch release. Pengembangan berikutnya dilakukan melalui branch baru dan diuji terlebih dahulu.

### Catatan keamanan
PIN admin pada frontend bukan security boundary tingkat tinggi. Untuk deployment dengan kebutuhan keamanan lebih tinggi, autentikasi perlu dipindahkan ke backend.

### Backend
Code.gs production tidak diubah pada proses finalisasi release ini.
