// =====================================================================
// KONFIGURASI PENTING: isi dengan URL Web App Apps Script Anda
// Didapat dari: Deploy > Manage deployments > (ikon copy di kolom Web app)
// Formatnya seperti: https://script.google.com/macros/s/AKfycbx.../exec
// =====================================================================
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyTUvi9GrZyqHoV9VzMduxOhGVYiz_LwAkWj_fC3srQqcIjbWsrtLewbSHrwaf3a_XKWg/exec';

// =====================================================================
// KONFIGURASI VALIDASI CLIENT-SIDE
// =====================================================================
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_CV = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_KTP_KK_IJAZAH = ['application/pdf', 'image/jpeg', 'image/png'];

const form = document.getElementById('jobApplicationForm');
const btnSubmit = document.getElementById('btnSubmit');
const btnReset = document.getElementById('btnReset');
const loadingOverlay = document.getElementById('loadingOverlay');
const alertArea = document.getElementById('alertArea');
const motivasiInput = document.getElementById('motivasi');
const motivasiCounter = document.getElementById('motivasiCounter');

// =====================================================================
// HELPER: Panggil Apps Script Web App sebagai API (pengganti google.script.run)
//
// PENTING: Content-Type WAJIB 'text/plain;charset=utf-8', BUKAN 'application/json'.
// Ini trik supaya browser tidak mengirim CORS preflight (OPTIONS), karena
// Apps Script Web App tidak bisa merespons preflight dengan header CORS yang benar.
// Isi body tetap JSON string seperti biasa, Code.gs yang mem-parsingnya.
// =====================================================================
async function callAppsScript(action, extraPayload) {
  const body = Object.assign({ action: action }, extraPayload);

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error('Gagal menghubungi server (status ' + response.status + ').');
  }

  return response.json();
}

// =====================================================================
// COUNTER KARAKTER MOTIVASI
// =====================================================================
motivasiInput.addEventListener('input', function () {
  const len = motivasiInput.value.trim().length;
  motivasiCounter.textContent = len + ' / 50 karakter';
  motivasiCounter.classList.toggle('text-danger', len < 50);
  motivasiCounter.classList.toggle('text-success', len >= 50);
});

// =====================================================================
// VALIDASI NIK: hanya boleh angka saat mengetik
// =====================================================================
document.getElementById('nik').addEventListener('input', function (e) {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 16);
});
document.getElementById('noHp').addEventListener('input', function (e) {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 15);
});

// =====================================================================
// HELPER: Tampilkan alert di atas form
// =====================================================================
function showAlert(type, message) {
  alertArea.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearAlert() {
  alertArea.innerHTML = '';
}

// =====================================================================
// HELPER: Validasi satu file (tipe & ukuran) di sisi client
// =====================================================================
function validateFileClient(inputEl, allowedTypes, feedbackEl, labelDokumen, wajib) {
  const file = inputEl.files[0];

  if (!file) {
    if (wajib) {
      inputEl.classList.add('is-invalid');
      feedbackEl.textContent = 'File ' + labelDokumen + ' wajib diunggah.';
      return false;
    }
    inputEl.classList.remove('is-invalid');
    return true;
  }

  if (allowedTypes.indexOf(file.type) === -1) {
    inputEl.classList.add('is-invalid');
    const allowedExt = allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ');
    feedbackEl.textContent = 'Format file ' + labelDokumen + ' tidak diizinkan. Gunakan: ' + allowedExt + '.';
    return false;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    inputEl.classList.add('is-invalid');
    feedbackEl.textContent = 'Ukuran file ' + labelDokumen + ' melebihi ' + MAX_FILE_SIZE_MB + ' MB.';
    return false;
  }

  inputEl.classList.remove('is-invalid');
  return true;
}

// =====================================================================
// HELPER: Konversi File menjadi base64 (tanpa prefix data:...;base64,)
// =====================================================================
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// =====================================================================
// VALIDASI BOOTSTRAP BAWAAN (nama, alamat, no HP, motivasi)
// =====================================================================
function validateTextFields() {
  let valid = true;

  const fieldsToCheck = ['namaLengkap', 'nik', 'alamat', 'noHp', 'tempatKerja', 'motivasi'];
  fieldsToCheck.forEach(function (id) {
    const el = document.getElementById(id);
    if (!el.checkValidity()) {
      el.classList.add('is-invalid');
      valid = false;
    } else {
      el.classList.remove('is-invalid');
    }
  });

  return valid;
}

// =====================================================================
// TOGGLE LOADING STATE
// =====================================================================
function setLoading(isLoading) {
  if (isLoading) {
    loadingOverlay.classList.remove('d-none');
    btnSubmit.disabled = true;
    btnReset.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Mengirim...';
  } else {
    loadingOverlay.classList.add('d-none');
    btnSubmit.disabled = false;
    btnReset.disabled = false;
    btnSubmit.innerHTML = '<i class="bi bi-send-fill me-1"></i> Kirim';
  }
}

// =====================================================================
// SUBMIT HANDLER UTAMA
// =====================================================================
form.addEventListener('submit', async function (e) {
  e.preventDefault();
  clearAlert();

  // 1. Validasi field teks
  const textValid = validateTextFields();

  // 2. Validasi masing-masing file
  const ktpInput = document.getElementById('ktp');
  const cvInput = document.getElementById('cv');
  const kkInput = document.getElementById('kk');
  const ijazahInput = document.getElementById('ijazah');

  const ktpValid = validateFileClient(ktpInput, ALLOWED_KTP_KK_IJAZAH, document.getElementById('ktpFeedback'), 'KTP', true);
  const cvValid = validateFileClient(cvInput, ALLOWED_CV, document.getElementById('cvFeedback'), 'CV', false);
  const kkValid = validateFileClient(kkInput, ALLOWED_KTP_KK_IJAZAH, document.getElementById('kkFeedback'), 'Kartu Keluarga', true);
  const ijazahValid = validateFileClient(ijazahInput, ALLOWED_KTP_KK_IJAZAH, document.getElementById('ijazahFeedback'), 'Ijazah', true);

  if (!textValid || !ktpValid || !cvValid || !kkValid || !ijazahValid) {
    showAlert('danger', '<i class="bi bi-exclamation-triangle-fill me-1"></i> Mohon periksa kembali data yang belum sesuai.');
    return;
  }

  setLoading(true);

  try {
    const nik = document.getElementById('nik').value.trim();

    // 3. Cek duplikasi NIK ke server sebelum upload file (efisiensi)
    //    Sebelumnya: google.script.run.checkNikExists(nik)
    //    Sekarang: fetch ke doPost dengan action 'checkNik'
    const checkResult = await callAppsScript('checkNik', { nik: nik });

    if (!checkResult.success) {
      throw new Error(checkResult.message || 'Gagal memeriksa NIK.');
    }

    if (checkResult.exists) {
      setLoading(false);
      showAlert('danger', '<i class="bi bi-x-circle-fill me-1"></i> NIK sudah terdaftar.');
      document.getElementById('nik').classList.add('is-invalid');
      return;
    }

    // 4. Konversi semua file ke base64 (CV bersifat opsional)
    const [ktpBase64, kkBase64, ijazahBase64] = await Promise.all([
      fileToBase64(ktpInput.files[0]),
      fileToBase64(kkInput.files[0]),
      fileToBase64(ijazahInput.files[0])
    ]);

    const cvFile = cvInput.files[0];
    const cvBase64 = cvFile ? await fileToBase64(cvFile) : null;

    // 5. Susun payload data untuk dikirim ke server
    const payload = {
      namaLengkap: document.getElementById('namaLengkap').value,
      nik: nik,
      alamat: document.getElementById('alamat').value,
      noHp: document.getElementById('noHp').value,
      tempatKerja: document.getElementById('tempatKerja').value,
      motivasi: document.getElementById('motivasi').value,
      ktp: {
        base64: ktpBase64,
        mimeType: ktpInput.files[0].type,
        fileName: ktpInput.files[0].name
      },
      cv: cvFile ? {
        base64: cvBase64,
        mimeType: cvFile.type,
        fileName: cvFile.name
      } : null,
      kk: {
        base64: kkBase64,
        mimeType: kkInput.files[0].type,
        fileName: kkInput.files[0].name
      },
      ijazah: {
        base64: ijazahBase64,
        mimeType: ijazahInput.files[0].type,
        fileName: ijazahInput.files[0].name
      }
    };

    // 6. Kirim ke server (Code.gs -> doPost -> submitApplication)
    //    Sebelumnya: google.script.run.submitApplication(payload)
    const response = await callAppsScript('submit', { data: payload });
    onSubmitSuccess(response);

  } catch (err) {
    onSubmitError(err);
  }
});

// =====================================================================
// CALLBACK SUKSES / GAGAL DARI SERVER
// =====================================================================
function onSubmitSuccess(response) {
  setLoading(false);

  if (response.success) {
    showAlert('success', '<i class="bi bi-check-circle-fill me-1"></i> ' + response.message);
    form.reset();
    motivasiCounter.textContent = '0 / 50 karakter';
    motivasiCounter.classList.remove('text-success');
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  } else {
    showAlert('danger', '<i class="bi bi-x-circle-fill me-1"></i> ' + response.message);
  }
}

function onSubmitError(error) {
  setLoading(false);
  showAlert('danger', '<i class="bi bi-exclamation-triangle-fill me-1"></i> Gagal mengirim data: ' + error.message);
}

// =====================================================================
// RESET FORM
// =====================================================================
btnReset.addEventListener('click', function () {
  setTimeout(function () {
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    motivasiCounter.textContent = '0 / 50 karakter';
    motivasiCounter.classList.remove('text-success', 'text-danger');
    clearAlert();
  }, 0);
});
