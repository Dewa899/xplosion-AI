# Panduan Implementasi dan Konfigurasi Fitur Laporan AI

Fitur Laporan Keselamatan Proses AI telah diimplementasikan menggunakan arsitektur backend yang aman dan siap untuk produksi. Panduan ini menjelaskan cara kerja sistem saat ini dan langkah-langkah yang perlu Anda lakukan untuk mengaktifkannya di lingkungan Cloudflare Anda.

---

## 1. Arsitektur Saat Ini (Aman untuk Produksi)

Sistem tidak lagi menyimpan API key di browser pengguna. Sebagai gantinya, aplikasi menggunakan **Cloudflare Function** sebagai perantara (proxy) yang aman.

**Alur Kerja:**
1.  **Browser Pengguna**: Mengirim permintaan (skenario kasus dan data log) ke endpoint API lokal di aplikasi Anda (`/api/generateReport`).
2.  **Cloudflare Function**: Menerima permintaan tersebut, mengambil konteks tambahan dari sumber eksternal (lihat Bagian 3), dan secara aman menambahkan `GEMINI_API_KEY` Anda dari environment secret.
3.  **Google Gemini API**: Menerima permintaan yang sudah lengkap dari Cloudflare Function dan mengembalikan hasilnya.
4.  **Browser Pengguna**: Menerima hasil laporan dari Cloudflare Function dan menampilkannya.

**File Terkait:**
-   **Backend Logic**: `xplosion-2.0/functions/api/generateReport.js`
-   **Frontend Caller**: `xplosion-2.0/public/js/gemini-report-generator.js` (sekarang memanggil `/api/generateReport`)

Pendekatan ini memastikan API key Anda **tidak pernah terekspos** ke publik dan merupakan praktik terbaik untuk keamanan.

---

## 2. Konfigurasi Wajib untuk Deployment

Agar fitur AI dapat berfungsi di lingkungan produksi (saat di-deploy ke Cloudflare), Anda **WAJIB** mengatur API key Anda sebagai *secret* di dashboard Cloudflare.

### Langkah-langkah Konfigurasi:

1.  **Dapatkan API Key**: Jika Anda belum punya, dapatkan API key Anda dari [Google AI Studio](https://aistudio.google.com/app/apikey).

2.  **Buka Proyek di Cloudflare**: Login ke akun Cloudflare Anda dan pilih proyek Pages yang sesuai.

3.  **Navigasi ke Environment Variables**:
    -   Pergi ke **Settings** > **Environment variables**.

4.  **Tambahkan Secret Variable**:
    -   Di bawah **Production** (dan **Preview** jika perlu), klik **Add variable**.
    -   Masukkan nama variabel: `GEMINI_API_KEY`
    -   Masukkan API key asli Anda sebagai nilainya.
    -   Klik **Encrypt** untuk menyimpan kunci Anda sebagai *secret*. Ini sangat penting untuk keamanan.

5.  **Simpan dan Deploy**:
    -   Simpan perubahan Anda. Cloudflare akan secara otomatis memulai proses deployment baru untuk menerapkan variabel lingkungan ini.

Setelah deployment selesai, fitur Laporan AI akan berfungsi sepenuhnya di situs Anda. Jika variabel ini tidak diatur, backend akan mengembalikan pesan error.

---

## 3. Fitur Baru: Konteks Tambahan dari URL Eksternal

Backend sekarang memiliki kemampuan untuk mengambil konteks tambahan dari URL eksternal dan memasukkannya ke dalam prompt yang dikirim ke Gemini. Ini berguna untuk memberikan panduan atau data referensi tambahan kepada AI.

### Konfigurasi URL Konteks

-   **File**: `xplosion-2.0/functions/api/generateReport.js`
-   **Variabel**: `DUMMY_DRIVE_URL`

Saat ini, URL tersebut diatur ke link Google Docs dummy:
```javascript
const DUMMY_DRIVE_URL = "https://docs.google.com/document/d/12345/export?format=txt";
```

Dan kontennya disimulasikan dengan teks statis untuk pengembangan:
```javascript
/*
---
DUMMY EXTERNAL CONTEXT:
Title: Guidelines for Process Safety Reports
...
---
*/
```

### Cara Mengganti dengan Link Asli Anda

1.  Buat sebuah dokumen di Google Docs.
2.  Pastikan dokumen tersebut **dapat diakses oleh siapa saja yang memiliki link** (*anyone with the link can view*).
3.  Salin ID dokumen dari URL. Contoh: `https://docs.google.com/document/d/DOKUMEN_ID_ANDA/edit`.
4.  Ganti nilai `DUMMY_DRIVE_URL` di file `generateReport.js` dengan URL ekspor dokumen Anda, seperti format di bawah:
    ```javascript
    const DUMMY_DRIVE_URL = "https://docs.google.com/document/d/DOKUMEN_ID_ANDA/export?format=txt";
    ```
5.  Ubah fungsi `getContextFromDrive` untuk benar-benar melakukan `fetch` ke URL tersebut. Saat ini, fungsi tersebut hanya mengembalikan teks dummy.

Dengan mengikuti panduan ini, Anda dapat mengelola dan mendeploy fitur AI dengan aman dan efektif.
