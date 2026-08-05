const API_URL = "https://script.google.com/macros/s/AKfycbz7Oy0s7ZdiWf6xuPMgnFNbMl4epyk_YSO-TBCOP4TbGcJxk1dicf_Y4DwHHLAr0k12OA/exec";

// Kunci akses API - HARUS SAMA PERSIS dengan APP_ACCESS_KEY di Code.gs
const APP_ACCESS_KEY = "b_oUISejzLl1rMEXGn5Fj4lcxmcjtMuC";

// Kredensial Admin
const ADMIN_USERNAME = "Admin";
const ADMIN_PASSWORD = "ipminboro123";

// Password bersama untuk Anggota
const MEMBER_PASSWORD = "ipmboro";

// Durasi sesi login (1 jam = 3600000 ms)
const SESSION_DURATION_MS = 1 * 60 * 60 * 1000;

let suratData = [];
let editId = null;
let isSubmitting = false;

// role: "admin" | "user" | null
let currentRole = null;
let currentName = "";
let currentPassword = ""; // hanya diisi kalau login sebagai admin

/* ---------- DAFTARKAN SERVICE WORKER (PWA) ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch((err) => console.error("Gagal mendaftarkan service worker:", err));
  });
}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", () => {
  checkConfig();
  setupLogin();
  setupNavigation();
  setupSidebarToggle();
  setupForm();
  setupSearchFilter();
  setupRefreshButton();
  setupPengaturan();
  fetchSettings();

  // Cek apakah sudah login sebelumnya (masih dalam sesi browser ini)
  const savedSession = sessionStorage.getItem("siperSession");
  if (savedSession) {
    const session = JSON.parse(savedSession);
    currentRole = session.role;
    currentName = session.name;
    currentPassword = session.password || "";
    masukKeAplikasi();
  }
});

/* ---------- CEK KONFIGURASI ---------- */
function checkConfig() {
  if (!API_URL || API_URL.includes("GANTI_DENGAN_URL")) {
    const content = document.querySelector(".content");
    const warning = document.createElement("div");
    warning.className = "config-warning";
    warning.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>Aplikasi belum terhubung ke database. Buka file <b>script.js</b>, lalu ganti nilai <b>API_URL</b> dengan URL Web App dari Google Apps Script Anda.</span>
    `;
    content.prepend(warning);
  }
}

/* ---------- LOGIN ---------- */
function setupLogin() {
  const tabs = document.querySelectorAll(".login-tab");
  const forms = document.querySelectorAll(".login-form");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      forms.forEach((f) => f.classList.remove("active"));
      document.getElementById("formLogin" + capitalize(tab.dataset.tab)).classList.add("active");
    });
  });

  // Toggle tampilkan/sembunyikan password admin
  const btnTogglePassword = document.getElementById("btnTogglePassword");
  const inputPassword = document.getElementById("passwordAdmin");
  btnTogglePassword.addEventListener("click", () => {
    const isHidden = inputPassword.type === "password";
    inputPassword.type = isHidden ? "text" : "password";
    btnTogglePassword.innerHTML = isHidden
      ? `<i class="fa-solid fa-eye-slash"></i>`
      : `<i class="fa-solid fa-eye"></i>`;
  });

  // Login sebagai Anggota (username bebas + password bersama)
  document.getElementById("formLoginUser").addEventListener("submit", (e) => {
    e.preventDefault();
    const nama = document.getElementById("namaAnggota").value.trim();
    const password = document.getElementById("passwordAnggota").value;
    if (!nama || !password) return;

    // Verifikasi password Anggota
    if (password !== MEMBER_PASSWORD) {
      showToast("Password Anggota salah", "error");
      return;
    }

    currentRole = "user";
    currentName = nama;
    currentPassword = "";
    simpanSesi();
    masukKeAplikasi();
  });

  // Login sebagai Admin (dengan username + password)
  const formAdmin = document.getElementById("formLoginAdmin");
  const btnLoginAdmin = document.getElementById("btnLoginAdmin");

  formAdmin.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("usernameAdmin").value;
    const password = document.getElementById("passwordAdmin").value;
    if (!username || !password) return;

    // Verifikasi username dan password Admin
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      showToast("Username atau password admin salah", "error");
      document.getElementById("passwordAdmin").value = "";
      return;
    }

    currentRole = "admin";
    currentName = "Admin";
    currentPassword = password;
    simpanSesi();
    masukKeAplikasi();
  });

  document.getElementById("btnLogout").addEventListener("click", () => {
    if (!confirm("Yakin ingin keluar?")) return;
    sessionStorage.removeItem("siperSession");
    location.reload();
  });
}

function simpanSesi() {
  sessionStorage.setItem(
    "siperSession",
    JSON.stringify({ role: currentRole, name: currentName, password: currentPassword })
  );
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ---------- MASUK KE APLIKASI SESUAI ROLE ---------- */
function masukKeAplikasi() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appScreen").style.display = "flex";

  document.getElementById("currentUserName").textContent = currentName;
  document.getElementById("currentUserRole").innerHTML =
    currentRole === "admin"
      ? `<span class="role-badge admin">Admin</span>`
      : `<span class="role-badge user">Anggota</span>`;

  // Prefill & kunci nama penginput untuk anggota (agar sesuai nama saat login)
  if (currentRole === "user") {
    const inputNama = document.getElementById("namaPenginput");
    inputNama.value = currentName;
    inputNama.readOnly = true;
  }

  const menuDashboard = document.querySelector('.menu-item[data-page="dashboard"]');
  const menuPengaturan = document.getElementById("menuPengaturan");

  if (currentRole === "admin") {
    // Admin: akses penuh, mulai dari Dashboard
    menuDashboard.style.display = "flex";
    menuPengaturan.style.display = "flex";
    document.querySelector('.menu-item[data-page="daftar"]').click();
    document.querySelector('.menu-item[data-page="dashboard"]').click();
  } else {
    // Anggota: tidak bisa lihat Dashboard & Pengaturan, langsung ke Daftar Surat
    menuDashboard.style.display = "none";
    menuPengaturan.style.display = "none";
    document.querySelector('.menu-item[data-page="daftar"]').click();
  }

  muatData();

  // Simpan waktu login sekarang (dalam ms)
  sessionStorage.setItem("siperLoginTime", Date.now().toString());

  // Cek session expiry setiap 30 detik
  setInterval(() => {
    const loginTime = parseInt(sessionStorage.getItem("siperLoginTime"));
    if (!loginTime) return;

    const elapsedTime = Date.now() - loginTime;
    if (elapsedTime > SESSION_DURATION_MS) {
      // Session sudah expired, logout otomatis
      showToast("Sesi login Anda telah berakhir (1 jam). Silakan login kembali.", "error");
      keluarAplikasi();
    }
  }, 30000); // Cek setiap 30 detik
}

/* ---------- AMBIL DATA DARI GOOGLE SHEETS ---------- */
async function muatData() {
  showLoading(true);
  try {
    const res = await fetch(API_URL + "?key=" + encodeURIComponent(APP_ACCESS_KEY));
    const json = await res.json();

    if (json.success) {
      suratData = json.data.map((item) => {
        const normalized = {};
        Object.keys(item).forEach((key) => {
          normalized[key] = item[key] === null || item[key] === undefined ? "" : String(item[key]);
        });
        return normalized;
      });
    } else {
      showToast("Gagal memuat data: " + (json.message || ""), "error");
    }
  } catch (err) {
    showToast("Tidak dapat terhubung ke database. Periksa koneksi internet atau konfigurasi API_URL.", "error");
    console.error(err);
  }
  showLoading(false);
  renderDashboard();
  renderTable();
}

/* ---------- KIRIM DATA (add/update/delete) ---------- */
async function kirimData(payload) {
  // Sertakan password admin (jika ada) untuk aksi yang perlu verifikasi
  if (currentPassword && !payload.password) {
    payload.password = currentPassword;
  }

  // Sertakan kunci akses API di setiap permintaan
  payload.key = APP_ACCESS_KEY;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

/* ---------- NAVIGASI MENU ---------- */
function setupNavigation() {
  const menuItems = document.querySelectorAll(".menu-item");
  const pageTitle = document.getElementById("pageTitle");

  menuItems.forEach((item) => {
    item.addEventListener("click", () => {
      const target = item.dataset.page;

      menuItems.forEach((m) => m.classList.remove("active"));
      item.classList.add("active");

      document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
      document.getElementById("page-" + target).classList.add("active");

      const titles = {
        dashboard: "Dashboard",
        tambah: "Tambah Surat",
        daftar: "Daftar Surat",
        pengaturan: "Pengaturan",
      };
      pageTitle.textContent = titles[target];

      if (target === "tambah" && editId === null) {
        resetForm();
      }

      if (target === "dashboard" || target === "daftar") {
        muatData();
      }

      closeSidebarMobile();
    });
  });
}

/* ---------- SIDEBAR TOGGLE (mobile) ---------- */
function setupSidebarToggle() {
  const sidebar = document.getElementById("sidebar");
  const btnHamburger = document.getElementById("btnHamburger");
  const overlay = document.getElementById("overlay");

  btnHamburger.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("show");
  });

  overlay.addEventListener("click", closeSidebarMobile);
}

function closeSidebarMobile() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
}

/* ---------- TOMBOL REFRESH ---------- */
function setupRefreshButton() {
  const btn = document.getElementById("btnRefresh");
  btn.addEventListener("click", async () => {
    btn.classList.add("spinning");
    await muatData();
    btn.classList.remove("spinning");
    showToast("Data berhasil dimuat ulang", "success");
  });
}

/* ---------- LOGO APLIKASI (Pengaturan) ---------- */
const MAX_LOGO_FILE_SIZE = 35 * 1024; // ~35 KB, aman untuk batas cell Google Sheets
let selectedLogoBase64 = "";

async function fetchSettings() {
  if (!API_URL || API_URL.includes("GANTI_DENGAN_URL")) return;
  try {
    const res = await fetch(API_URL + "?action=settings&key=" + encodeURIComponent(APP_ACCESS_KEY));
    const json = await res.json();
    if (json.success && json.settings && json.settings.logo) {
      applyLogo(json.settings.logo);
    }
  } catch (err) {
    console.error("Gagal memuat pengaturan logo:", err);
  }
}

function applyLogo(base64) {
  const DEFAULT_LOGO = "icons/logo-app.png";
  const targets = [
    { icon: "sidebarLogoIcon", img: "sidebarLogoImg" },
    { icon: "loginLogoIcon", img: "loginLogoImg" },
    { icon: "previewLogoIcon", img: "previewLogoImg" },
  ];

  targets.forEach(({ icon, img }) => {
    const iconEl = document.getElementById(icon);
    const imgEl = document.getElementById(img);
    if (!iconEl || !imgEl) return;

    imgEl.src = base64 || DEFAULT_LOGO;
    imgEl.style.display = "block";
    iconEl.style.display = "none";
  });
}

function setupPengaturan() {
  const inputLogo = document.getElementById("inputLogo");
  const btnSimpanLogo = document.getElementById("btnSimpanLogo");
  const btnHapusLogo = document.getElementById("btnHapusLogo");

  inputLogo.addEventListener("change", () => {
    const file = inputLogo.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("File harus berupa gambar (JPG/PNG)", "error");
      inputLogo.value = "";
      return;
    }

    if (file.size > MAX_LOGO_FILE_SIZE) {
      showToast("Ukuran gambar terlalu besar. Gunakan gambar di bawah 35 KB.", "error");
      inputLogo.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      selectedLogoBase64 = reader.result;
      applyLogo(selectedLogoBase64);
    };
    reader.readAsDataURL(file);
  });

  btnSimpanLogo.addEventListener("click", async () => {
    if (!selectedLogoBase64) {
      showToast("Pilih gambar logo terlebih dahulu", "error");
      return;
    }

    btnSimpanLogo.disabled = true;
    btnSimpanLogo.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

    try {
      const result = await kirimData({ action: "saveLogo", logo: selectedLogoBase64 });
      if (result.success) {
        showToast("Logo berhasil disimpan", "success");
      } else {
        showToast("Gagal menyimpan logo: " + (result.message || ""), "error");
      }
    } catch (err) {
      showToast("Terjadi kesalahan saat menyimpan logo.", "error");
      console.error(err);
    }

    btnSimpanLogo.disabled = false;
    btnSimpanLogo.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan Logo`;
  });

  btnHapusLogo.addEventListener("click", async () => {
    if (!confirm("Yakin ingin menghapus logo dan kembali ke ikon default?")) return;

    btnHapusLogo.disabled = true;

    try {
      const result = await kirimData({ action: "saveLogo", logo: "" });
      if (result.success) {
        selectedLogoBase64 = "";
        inputLogo.value = "";
        applyLogo("");
        showToast("Logo berhasil dihapus, kembali ke default", "success");
      } else {
        showToast("Gagal menghapus logo: " + (result.message || ""), "error");
      }
    } catch (err) {
      showToast("Terjadi kesalahan saat menghapus logo.", "error");
      console.error(err);
    }

    btnHapusLogo.disabled = false;
  });
}

/* ---------- FORM TAMBAH / EDIT SURAT ---------- */
function setupForm() {
  const form = document.getElementById("formSurat");
  const btnReset = document.getElementById("btnReset");
  const btnSubmit = document.getElementById("btnSubmit");
  const selectJenisData = document.getElementById("jenisData");

  // Tampilkan/sembunyikan field khusus Surat Keluar
  selectJenisData.addEventListener("change", () => {
    // Kosongkan field yang disembunyikan agar tidak ikut tersimpan
    if (selectJenisData.value !== "Surat Keluar") {
      document.getElementById("jenisSurat").value = "";
      document.getElementById("nomorUmum").value = "";
      document.getElementById("nomorKhusus").value = "";
    }
    toggleJenisSuratFields();
  });

  // Tampilkan Nomor Umum / Nomor Khusus sesuai pilihan Jenis Surat
  document.getElementById("jenisSurat").addEventListener("change", () => {
    toggleJenisSuratFields();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const item = {
      id: editId !== null ? editId : String(Date.now()),
      jenisData: document.getElementById("jenisData").value,
      jenisSurat: document.getElementById("jenisSurat").value,
      nomorSurat: document.getElementById("nomorSurat").value.trim(),
      nomorUmum: document.getElementById("nomorUmum").value.trim(),
      nomorKhusus: document.getElementById("nomorKhusus").value.trim(),
      tanggalSurat: document.getElementById("tanggalSurat").value,
      asalTujuan: document.getElementById("asalTujuan").value.trim(),
      perihal: document.getElementById("perihal").value.trim(),
      status: document.getElementById("status").value,
      namaPenginput: document.getElementById("namaPenginput").value.trim(),
      linkDrive: document.getElementById("linkDrive").value.trim(),
      keterangan: document.getElementById("keterangan").value.trim(),
    };

    isSubmitting = true;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

    try {
      const action = editId !== null ? "update" : "add";
      const result = await kirimData({ action, data: item });

      if (result.success) {
        showToast(editId !== null ? "Surat berhasil diperbarui" : "Surat berhasil disimpan", "success");
        resetForm();
        await muatData();
        document.querySelector('.menu-item[data-page="daftar"]').click();
      } else {
        showToast("Gagal menyimpan: " + (result.message || ""), "error");
      }
    } catch (err) {
      showToast("Terjadi kesalahan saat menyimpan data. Periksa koneksi internet.", "error");
      console.error(err);
    }

    isSubmitting = false;
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan`;
  });

  btnReset.addEventListener("click", () => {
    resetForm();
  });

  // Set kondisi awal (field khusus Surat Keluar tersembunyi)
  toggleJenisSuratFields();
}

function resetForm() {
  document.getElementById("formSurat").reset();
  document.getElementById("suratId").value = "";
  editId = null;
  document.getElementById("formTitle").textContent = "Form Tambah Surat";

  // Anggota: nama penginput tetap terisi & terkunci
  if (currentRole === "user") {
    document.getElementById("namaPenginput").value = currentName;
  }

  toggleJenisSuratFields();
}

/* ---------- TAMPILKAN/SEMBUNYIKAN FIELD SESUAI JENIS DATA ---------- */
function toggleJenisSuratFields(preselectStatus) {
  const jenisData = document.getElementById("jenisData").value;
  const jenisSurat = document.getElementById("jenisSurat").value;
  const isKeluar = jenisData === "Surat Keluar";
  const selectJenisSurat = document.getElementById("jenisSurat");

  // Field Jenis Surat (dropdown Umum/Khusus) - hanya untuk Surat Keluar
  document.querySelectorAll(".surat-keluar-only").forEach((field) => {
    field.style.display = isKeluar ? "flex" : "none";
  });

  // Jenis Surat wajib diisi hanya untuk Surat Keluar
  selectJenisSurat.required = isKeluar;

  // Nomor Khusus hanya muncul kalau Jenis Surat = Surat Khusus
  // (Nomor Umum tetap ikut aturan umum .surat-keluar-only di atas)
  const showKhusus = isKeluar && jenisSurat === "Surat Khusus";
  document.querySelector(".jenis-khusus-only").style.display = showKhusus ? "flex" : "none";
  if (!showKhusus) document.getElementById("nomorKhusus").value = "";

  updateStatusOptions(preselectStatus);
}

const STATUS_OPTIONS = {
  "Surat Masuk": ["Diterima", "Diproses", "Selesai"],
  "Surat Keluar": ["Draft", "Dikirim", "Selesai"],
};

function updateStatusOptions(preselectStatus) {
  const jenisData = document.getElementById("jenisData").value;
  const statusSelect = document.getElementById("status");
  const options = STATUS_OPTIONS[jenisData] || STATUS_OPTIONS["Surat Keluar"];

  let html = `<option value="">-- Pilih Status --</option>`;
  options.forEach((opt) => {
    html += `<option value="${opt}">${opt}</option>`;
  });
  statusSelect.innerHTML = html;

  if (preselectStatus) {
    statusSelect.value = preselectStatus;
  }
}

/* ---------- RENDER DASHBOARD ---------- */
function renderDashboard() {
  const masuk = suratData.filter((s) => s.jenisData === "Surat Masuk").length;
  const keluar = suratData.filter((s) => s.jenisData === "Surat Keluar").length;

  document.getElementById("countMasuk").textContent = masuk;
  document.getElementById("countKeluar").textContent = keluar;
  document.getElementById("countTotal").textContent = suratData.length;

  const recent = [...suratData]
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, 5);

  const tbody = document.querySelector("#tableRecent tbody");
  tbody.innerHTML = "";

  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--gray-400); padding:24px;">Belum ada data surat.</td></tr>`;
    return;
  }

  recent.forEach((s, i) => {
    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${jenisDataBadge(s.jenisData)}</td>
        <td>${jenisSuratBadge(s.jenisSurat)}</td>
        <td>${escapeHtml(s.nomorSurat)}</td>
        <td>${formatTanggal(s.tanggalSurat)}</td>
        <td>${escapeHtml(s.perihal)}</td>
        <td>${statusBadge(s.status)}</td>
      </tr>
    `;
  });
}

/* ---------- RENDER TABEL DAFTAR SURAT ---------- */
function renderTable() {
  const tbody = document.querySelector("#tableSurat tbody");
  const emptyState = document.getElementById("emptyState");
  const keyword = document.getElementById("searchInput").value.toLowerCase().trim();
  const filterJenis = document.getElementById("filterJenis").value;
  const sortBy = document.getElementById("sortBy").value;

  let filtered = [...suratData].sort(urutkanData(sortBy));

  if (filterJenis !== "Semua") {
    filtered = filtered.filter((s) => s.jenisData === filterJenis);
  }

  if (keyword) {
    filtered = filtered.filter(
      (s) =>
        String(s.nomorSurat || "").toLowerCase().includes(keyword) ||
        String(s.nomorUmum || "").toLowerCase().includes(keyword) ||
        String(s.nomorKhusus || "").toLowerCase().includes(keyword) ||
        String(s.perihal || "").toLowerCase().includes(keyword) ||
        String(s.asalTujuan || "").toLowerCase().includes(keyword)
    );
  }

  tbody.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.style.display = "block";
    return;
  } else {
    emptyState.style.display = "none";
  }

  const isAdmin = currentRole === "admin";

  filtered.forEach((s, i) => {
    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${jenisDataBadge(s.jenisData)}</td>
        <td>${jenisSuratBadge(s.jenisSurat)}</td>
        <td>${escapeHtml(s.nomorSurat)}</td>
        <td>${escapeHtml(s.nomorUmum) || "-"}</td>
        <td>${escapeHtml(s.nomorKhusus) || "-"}</td>
        <td>${formatTanggal(s.tanggalSurat)}</td>
        <td>${escapeHtml(s.asalTujuan)}</td>
        <td>${escapeHtml(s.perihal)}</td>
        <td>${statusBadge(s.status)}</td>
        <td>${escapeHtml(s.namaPenginput)}</td>
        <td>
          ${
            isAdmin
              ? `<div class="action-btns">
                  <button class="btn-icon btn-edit" onclick="editSurat('${s.id}')" title="Edit">
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button class="btn-icon btn-delete" onclick="hapusSurat('${s.id}')" title="Hapus">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>`
              : `<span style="color:var(--gray-400); font-size:12px;">-</span>`
          }
        </td>
      </tr>
    `;
  });
}

/* ---------- SEARCH & FILTER ---------- */
function setupSearchFilter() {
  document.getElementById("searchInput").addEventListener("input", renderTable);
  document.getElementById("filterJenis").addEventListener("change", renderTable);
  document.getElementById("sortBy").addEventListener("change", renderTable);
}

/* ---------- FUNGSI URUTKAN DATA ---------- */
function urutkanData(sortBy) {
  // Perbandingan angka & teks campuran (misal "001", "12A") tetap masuk akal
  const bandingkanTeks = (a, b) =>
    String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });

  switch (sortBy) {
    case "input_desc":
      return (a, b) => Number(b.id) - Number(a.id);
    case "tanggal_asc":
      return (a, b) => new Date(a.tanggalSurat) - new Date(b.tanggalSurat);
    case "tanggal_desc":
      return (a, b) => new Date(b.tanggalSurat) - new Date(a.tanggalSurat);
    case "nomorUmum_asc":
      return (a, b) => bandingkanTeks(a.nomorUmum, b.nomorUmum);
    case "nomorUmum_desc":
      return (a, b) => bandingkanTeks(b.nomorUmum, a.nomorUmum);
    case "nomorKhusus_asc":
      return (a, b) => bandingkanTeks(a.nomorKhusus, b.nomorKhusus);
    case "nomorKhusus_desc":
      return (a, b) => bandingkanTeks(b.nomorKhusus, a.nomorKhusus);
    case "nomorSurat_asc":
      return (a, b) => bandingkanTeks(a.nomorSurat, b.nomorSurat);
    case "nomorSurat_desc":
      return (a, b) => bandingkanTeks(b.nomorSurat, a.nomorSurat);
    case "input_asc":
    default:
      // Default: input terbaru ditaruh di bagian bawah
      return (a, b) => Number(a.id) - Number(b.id);
  }
}

/* ---------- EDIT & HAPUS ---------- */
function editSurat(id) {
  if (currentRole !== "admin") {
    showToast("Hanya Admin yang dapat mengedit data", "error");
    return;
  }

  const item = suratData.find((s) => s.id === id);
  if (!item) return;

  editId = id;

  document.getElementById("suratId").value = item.id;
  document.getElementById("jenisData").value = item.jenisData;
  document.getElementById("jenisSurat").value = item.jenisSurat;
  document.getElementById("nomorSurat").value = item.nomorSurat;
  document.getElementById("nomorUmum").value = item.nomorUmum;
  document.getElementById("nomorKhusus").value = item.nomorKhusus;
  document.getElementById("tanggalSurat").value = item.tanggalSurat;
  document.getElementById("asalTujuan").value = item.asalTujuan;
  document.getElementById("perihal").value = item.perihal;
  document.getElementById("namaPenginput").value = item.namaPenginput;
  document.getElementById("linkDrive").value = item.linkDrive;
  document.getElementById("keterangan").value = item.keterangan;

  document.getElementById("formTitle").textContent = "Form Edit Surat";
  toggleJenisSuratFields(item.status);

  document.querySelector('.menu-item[data-page="tambah"]').click();
}

async function hapusSurat(id) {
  if (currentRole !== "admin") {
    showToast("Hanya Admin yang dapat menghapus data", "error");
    return;
  }

  if (!confirm("Yakin ingin menghapus data surat ini?")) return;

  showLoading(true);
  try {
    const result = await kirimData({ action: "delete", id });
    if (result.success) {
      showToast("Surat berhasil dihapus", "success");
      await muatData();
    } else {
      showToast("Gagal menghapus: " + (result.message || ""), "error");
    }
  } catch (err) {
    showToast("Terjadi kesalahan saat menghapus data.", "error");
    console.error(err);
  }
  showLoading(false);
}

/* ---------- HELPER UI ---------- */
function showLoading(state) {
  document.getElementById("loadingOverlay").classList.toggle("show", state);
}

let toastTimeout = null;
function showToast(message, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "toast show" + (type ? " " + type : "");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

/* ---------- HELPER FORMAT ---------- */
function jenisDataBadge(jenis) {
  if (jenis === "Surat Masuk") {
    return `<span class="badge badge-masuk"><i class="fa-solid fa-inbox"></i> Masuk</span>`;
  }
  return `<span class="badge badge-keluar"><i class="fa-solid fa-paper-plane"></i> Keluar</span>`;
}

function jenisSuratBadge(jenis) {
  if (jenis === "Surat Umum") {
    return `<span class="badge badge-umum"><i class="fa-solid fa-file-lines"></i> Umum</span>`;
  }
  if (jenis === "Surat Khusus") {
    return `<span class="badge badge-khusus"><i class="fa-solid fa-file-shield"></i> Khusus</span>`;
  }
  return `<span style="color:var(--gray-400); font-size:12px;">-</span>`;
}

function statusBadge(status) {
  const map = {
    Draft: "badge-draft",
    Dikirim: "badge-dikirim",
    Selesai: "badge-selesai",
    Diterima: "badge-dikirim",
    Diproses: "badge-draft",
  };
  const cls = map[status] || "badge-draft";
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function formatTanggal(tanggal) {
  if (!tanggal) return "-";
  const d = new Date(tanggal);
  if (isNaN(d)) return tanggal;
  const bulan = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
