/* =======================================================
   SIPER IPM - Sistem Persuratan PD IPM Bojonegoro
   Data disimpan bersama di Google Sheets lewat
   Google Apps Script (API).

   PENTING:
   Ganti nilai API_URL di bawah ini dengan URL Web App
   hasil Deploy dari Google Apps Script (lihat Code.gs).
======================================================= */

const API_URL = "https://script.google.com/macros/s/AKfycbytMeeJiEHDZ-mX-3qS5BIwCg0c1AFZUvCHmol7R3ULnmZW2CGeg1N67sdJAuTSRyH0TQ/exec";

let suratData = [];
let editId = null;
let isSubmitting = false;

// role: "admin" | "user" | null
let currentRole = null;
let currentName = "";
let currentPassword = ""; // hanya diisi kalau login sebagai admin

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", () => {
  checkConfig();
  setupLogin();
  setupNavigation();
  setupSidebarToggle();
  setupForm();
  setupSearchFilter();
  setupRefreshButton();

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

  // Login sebagai Anggota (tanpa password)
  document.getElementById("formLoginUser").addEventListener("submit", (e) => {
    e.preventDefault();
    const nama = document.getElementById("namaAnggota").value.trim();
    if (!nama) return;

    currentRole = "user";
    currentName = nama;
    currentPassword = "";
    simpanSesi();
    masukKeAplikasi();
  });

  // Login sebagai Admin (dengan password, diverifikasi ke server)
  const formAdmin = document.getElementById("formLoginAdmin");
  const btnLoginAdmin = document.getElementById("btnLoginAdmin");

  formAdmin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.getElementById("passwordAdmin").value;
    if (!password) return;

    if (!API_URL || API_URL.includes("GANTI_DENGAN_URL")) {
      showToast("API_URL belum dikonfigurasi. Lihat peringatan di bawah.", "error");
      return;
    }

    btnLoginAdmin.disabled = true;
    btnLoginAdmin.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Memeriksa...`;

    try {
      const result = await kirimData({ action: "login", password });
      if (result.success) {
        currentRole = "admin";
        currentName = "Admin";
        currentPassword = password;
        simpanSesi();
        masukKeAplikasi();
      } else {
        showToast(result.message || "Password admin salah", "error");
      }
    } catch (err) {
      showToast("Gagal terhubung ke server. Periksa koneksi internet.", "error");
      console.error(err);
    }

    btnLoginAdmin.disabled = false;
    btnLoginAdmin.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Masuk sebagai Admin`;
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

  if (currentRole === "admin") {
    // Admin: akses penuh, mulai dari Dashboard
    menuDashboard.style.display = "flex";
    document.querySelector('.menu-item[data-page="daftar"]').click();
    document.querySelector('.menu-item[data-page="dashboard"]').click();
  } else {
    // Anggota: tidak bisa lihat Dashboard, langsung ke Daftar Surat
    menuDashboard.style.display = "none";
    document.querySelector('.menu-item[data-page="daftar"]').click();
  }

  muatData();
}

/* ---------- AMBIL DATA DARI GOOGLE SHEETS ---------- */
async function muatData() {
  showLoading(true);
  try {
    const res = await fetch(API_URL);
    const json = await res.json();

    if (json.success) {
      suratData = json.data.map((item) => ({
        ...item,
        id: String(item.id),
      }));
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

/* ---------- FORM TAMBAH / EDIT SURAT ---------- */
function setupForm() {
  const form = document.getElementById("formSurat");
  const btnReset = document.getElementById("btnReset");
  const btnSubmit = document.getElementById("btnSubmit");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const item = {
      id: editId !== null ? editId : String(Date.now()),
      jenisSurat: document.getElementById("jenisSurat").value,
      nomorSurat: document.getElementById("nomorSurat").value.trim(),
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
}

/* ---------- RENDER DASHBOARD ---------- */
function renderDashboard() {
  const masuk = suratData.filter((s) => s.jenisSurat === "Surat Masuk").length;
  const keluar = suratData.filter((s) => s.jenisSurat === "Surat Keluar").length;

  document.getElementById("countMasuk").textContent = masuk;
  document.getElementById("countKeluar").textContent = keluar;
  document.getElementById("countTotal").textContent = suratData.length;

  const recent = [...suratData]
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, 5);

  const tbody = document.querySelector("#tableRecent tbody");
  tbody.innerHTML = "";

  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--gray-400); padding:24px;">Belum ada data surat.</td></tr>`;
    return;
  }

  recent.forEach((s, i) => {
    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${jenisBadge(s.jenisSurat)}</td>
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

  let filtered = [...suratData].sort((a, b) => Number(b.id) - Number(a.id));

  if (filterJenis !== "Semua") {
    filtered = filtered.filter((s) => s.jenisSurat === filterJenis);
  }

  if (keyword) {
    filtered = filtered.filter(
      (s) =>
        (s.nomorSurat || "").toLowerCase().includes(keyword) ||
        (s.perihal || "").toLowerCase().includes(keyword) ||
        (s.asalTujuan || "").toLowerCase().includes(keyword)
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
        <td>${jenisBadge(s.jenisSurat)}</td>
        <td>${escapeHtml(s.nomorSurat)}</td>
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
  document.getElementById("jenisSurat").value = item.jenisSurat;
  document.getElementById("nomorSurat").value = item.nomorSurat;
  document.getElementById("tanggalSurat").value = item.tanggalSurat;
  document.getElementById("asalTujuan").value = item.asalTujuan;
  document.getElementById("perihal").value = item.perihal;
  document.getElementById("status").value = item.status;
  document.getElementById("namaPenginput").value = item.namaPenginput;
  document.getElementById("linkDrive").value = item.linkDrive;
  document.getElementById("keterangan").value = item.keterangan;

  document.getElementById("formTitle").textContent = "Form Edit Surat";

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
function jenisBadge(jenis) {
  if (jenis === "Surat Masuk") {
    return `<span class="badge badge-masuk"><i class="fa-solid fa-inbox"></i> Masuk</span>`;
  }
  return `<span class="badge badge-keluar"><i class="fa-solid fa-paper-plane"></i> Keluar</span>`;
}

function statusBadge(status) {
  const map = {
    Draft: "badge-draft",
    Dikirim: "badge-dikirim",
    Selesai: "badge-selesai",
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
