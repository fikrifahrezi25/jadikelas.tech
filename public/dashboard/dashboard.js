// ============================================================
// dashboard.js — Logic dashboard, load data dari /api/me
// ============================================================

const PLAN_NAMES = { 1: "Free", 2: "Starter", 3: "Pro" };
const PLAN_LIMITS = { 1: 2, 2: 10, 3: 50 };

async function loadDashboard() {
    try {
        const res = await fetch("/api/me");
        if (!res.ok) {
            window.location.href = "/"; // Belum login, redirect ke home
            return;
        }
        const data = await res.json();
        if (!data.success) { window.location.href = "/"; return; }

        const user = data.user;
        const planName = PLAN_NAMES[user.plan] || "Free";
        const planLimit = PLAN_LIMITS[user.plan] || 2;

        // Nama & greeting
        document.querySelectorAll("[data-user-name]").forEach(el => el.textContent = user.namaLengkap);
        document.querySelectorAll("[data-user-email]").forEach(el => el.textContent = user.email);
        document.querySelectorAll("[data-user-plan]").forEach(el => el.textContent = planName);
        document.querySelectorAll("[data-user-credit]").forEach(el => el.textContent = user.creditLeft);
//      document.querySelectorAll("[data-user-course]").forEach(el => el.textContent = `${user.courseCreated} / ${planLimit} Maks`);
        document.querySelectorAll("[data-user-course]").forEach(el => el.textContent = `${user.courseCreated}`);

        // Avatar initials
        const initials = user.namaLengkap.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
        document.querySelectorAll("[data-user-initials]").forEach(el => el.textContent = initials);

        // Avatar URL
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.namaLengkap)}&background=4F46E5&color=fff&size=256`;
        document.querySelectorAll("[data-user-avatar]").forEach(el => el.src = avatarUrl);

        // Profile form
        const nameInput = document.getElementById("profile-name");
        const emailInput = document.getElementById("profile-email");
        const sekolahInput = document.getElementById("profile-sekolah");
        if (nameInput) nameInput.value = user.namaLengkap;
        if (emailInput) emailInput.value = user.email;
        if (sekolahInput && user.sekolah) sekolahInput.value = user.sekolah;

        // Plan badge di profile
        document.querySelectorAll("[data-user-plan-badge]").forEach(el => el.textContent = `${planName} Plan`);

    } catch (err) {
        console.error("Gagal load dashboard:", err);
    }
}

async function loadCourses() {
    try {
        const res = await fetch("/api/courses");
        const data = await res.json();
        if (!data.success) return;

        const container = document.getElementById("course-container");
        if (!container) return;

        if (data.courses.length === 0) {
            document.getElementById("no-result").classList.remove("hidden");
            container.innerHTML = "";
            return;
        }

        container.innerHTML = data.courses.map(c => {
            // Determine file type and icon
            const fileType = c.fileType || 'pdf';
            let iconHtml = '<i class="ph-fill ph-file-pdf"></i>';
            let iconBg = 'bg-red-50';
            let iconColor = 'text-red-500';
            
            if (fileType === 'docx') {
                iconHtml = '<i class="ph-fill ph-file-doc"></i>';
                iconBg = 'bg-blue-50';
                iconColor = 'text-blue-500';
            } else if (fileType === 'pptx') {
                iconHtml = '<i class="ph-fill ph-file-ppt"></i>';
                iconBg = 'bg-orange-50';
                iconColor = 'text-orange-500';
            }
            
            return `
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4 hover:shadow-md transition-all course-card" data-title="${c.courseName.toLowerCase()}">
                <div class="w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center ${iconColor} text-2xl">
                    ${iconHtml}
                </div>
                <div class="flex-1">
                    <h3 class="font-bold text-dark text-base mb-1">${c.courseName}</h3>
                    <p class="text-xs text-slate-400">${c.courseCreated}</p>
                </div>
                <a href="${c.courseUrl}" target="_blank" class="w-full py-2.5 text-center bg-indigo-50 hover:bg-primary hover:text-white text-primary font-semibold rounded-xl transition-all text-sm">
                    Buka Course
                </a>
            </div>
            `;
        }).join("");
    } catch (err) {
        console.error("Gagal load courses:", err);
    }
}

// Search courses
function handleSearch() {
    const q = document.getElementById("course-search").value.toLowerCase();
    const cards = document.querySelectorAll(".course-card");
    let visible = 0;
    cards.forEach(card => {
        const match = card.dataset.title.includes(q);
        card.style.display = match ? "" : "none";
        if (match) visible++;
    });
    document.getElementById("no-result").classList.toggle("hidden", visible > 0);
}

// Update profile
async function handleUpdateProfile(e) {
    e.preventDefault();
    const namaLengkap = document.getElementById("profile-name").value.trim();
    const sekolah = document.getElementById("profile-sekolah")?.value.trim();
    const msgEl = document.getElementById("profile-msg");

    try {
        const res = await fetch("/api/update-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ namaLengkap, sekolah })
        });
        const data = await res.json();
        if (msgEl) {
            msgEl.textContent = data.message;
            msgEl.className = data.success ? "text-sm text-emerald-600 font-medium" : "text-sm text-red-500 font-medium";
        }
        if (data.success) loadDashboard();
    } catch (_) {
        if (msgEl) msgEl.textContent = "Terjadi kesalahan.";
    }
}

// Logout
async function logoutUser() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
}

// Change password
async function handleChangePassword(e) {
    e.preventDefault();
    const currentPassword = document.getElementById("pw-current").value;
    const newPassword = document.getElementById("pw-new").value;
    const confirmPassword = document.getElementById("pw-confirm").value;
    const msgEl = document.getElementById("password-msg");

    try {
        const res = await fetch("/api/change-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
        });
        const data = await res.json();

        msgEl.textContent = data.message;
        msgEl.className = data.success
            ? "text-sm font-medium text-emerald-600"
            : "text-sm font-medium text-red-500";

        if (data.success) {
            // Reset form setelah berhasil
            document.getElementById("password-form").reset();
        }
    } catch (_) {
        msgEl.textContent = "Terjadi kesalahan. Coba lagi.";
        msgEl.className = "text-sm font-medium text-red-500";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadDashboard();
    loadCourses();

    const profileForm = document.getElementById("profile-form");
    if (profileForm) profileForm.addEventListener("submit", handleUpdateProfile);

    const passwordForm = document.getElementById("password-form");
    if (passwordForm) passwordForm.addEventListener("submit", handleChangePassword);

    document.querySelectorAll("[data-logout]").forEach(btn => {
        btn.addEventListener("click", logoutUser);
    });
});
// ============================================================
// PAYMENT GATEWAY SIMULATION
// ============================================================

const PACKAGES = [
    { id: 1, name: "Starter Boost", price: 9000,  credit: 10,  tier: 2, desc: "Untuk coba pertama kali" },
    { id: 2, name: "Smart Learner", price: 19000, credit: 25,  tier: 2, desc: "Cocok untuk mahasiswa aktif" },
    { id: 3, name: "Creator Pack",  price: 35000, credit: 50,  tier: 3, desc: "Pilihan terbaik kreator" },
    { id: 4, name: "Campus Pro",    price: 59000, credit: 100, tier: 3, desc: "Untuk kelas & organisasi" }
];

let selectedPackageId = null;

function formatRupiah(n) {
    return "Rp " + n.toLocaleString("id-ID");
}

function openPaymentModal(pkgId) {
    const pkg = PACKAGES.find(p => p.id === pkgId);
    if (!pkg) return;
    selectedPackageId = pkgId;

    document.getElementById("pm-pkg-name").textContent = pkg.name;
    document.getElementById("pm-pkg-desc").textContent = pkg.desc;
    document.getElementById("pm-pkg-credit").textContent = `+${pkg.credit} Credit`;
    document.getElementById("pm-pkg-price").textContent = formatRupiah(pkg.price);

    // Reset steps
    document.getElementById("pm-step-1").classList.remove("hidden");
    document.getElementById("pm-step-2").classList.add("hidden");
    document.getElementById("pm-step-3").classList.add("hidden");

    const modal = document.getElementById("payment-modal");
    const card = document.getElementById("payment-modal-card");
    modal.classList.remove("hidden");
    setTimeout(() => {
        modal.classList.remove("opacity-0");
        card.classList.remove("translate-y-8");
    }, 10);
}

function closePaymentModal() {
    const modal = document.getElementById("payment-modal");
    const card = document.getElementById("payment-modal-card");
    modal.classList.add("opacity-0");
    card.classList.add("translate-y-8");
    setTimeout(() => modal.classList.add("hidden"), 280);
}

async function processPayment() {
    if (!selectedPackageId) return;

    // Show loading
    document.getElementById("pm-step-1").classList.add("hidden");
    document.getElementById("pm-step-2").classList.remove("hidden");

    // Simulate 2s processing
    await new Promise(r => setTimeout(r, 2000));

    try {
        const res = await fetch("/api/payment/pay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ packageId: selectedPackageId })
        });
        const data = await res.json();

        if (!data.success) {
            alert("Pembayaran gagal: " + data.message);
            closePaymentModal();
            return;
        }

        const pkg = PACKAGES.find(p => p.id === selectedPackageId);

        // Show success
        document.getElementById("pm-step-2").classList.add("hidden");
        document.getElementById("pm-step-3").classList.remove("hidden");
        document.getElementById("pm-success-msg").textContent = `${pkg.credit} Credit berhasil ditambahkan`;
        document.getElementById("pm-invoice-id").textContent = data.invoiceId;
        document.getElementById("pm-success-pkg").textContent = pkg.name;
        document.getElementById("pm-new-credit").textContent = data.creditLeft;
        document.getElementById("pm-new-plan").textContent = data.newPlan;

        // Refresh dashboard data tanpa reload
        loadDashboard();

    } catch (err) {
        console.error("Payment error:", err);
        alert("Terjadi kesalahan. Coba lagi.");
        closePaymentModal();
    }
}

// Close modal on backdrop click
document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("payment-modal");
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closePaymentModal();
        });
    }
});

// Load payment history
async function loadPaymentHistory() {
    try {
        const res = await fetch("/api/payment/history");
        const data = await res.json();
        const container = document.getElementById("history-container");
        if (!container) return;

        if (!data.success || data.history.length === 0) {
            container.innerHTML = `
                <div class="text-center py-16 text-slate-400">
                    <i class="ph ph-receipt text-5xl mb-3 block"></i>
                    <p class="font-medium">Belum ada transaksi</p>
                    <button onclick="switchPage('topup')" class="mt-4 px-6 py-2.5 bg-primary text-white font-bold rounded-xl text-sm hover:opacity-90 transition-all">Top Up Sekarang</button>
                </div>`;
            return;
        }

        container.innerHTML = data.history.map(h => `
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between gap-4">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 text-2xl shrink-0">
                        <i class="ph-fill ph-check-circle"></i>
                    </div>
                    <div>
                        <p class="font-bold text-dark">${h.packageName}</p>
                        <p class="text-xs text-slate-400 mt-0.5">${h.invoiceId} · ${h.date}</p>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <p class="font-extrabold text-dark">${formatRupiah(h.price)}</p>
                    <p class="text-xs text-emerald-600 font-semibold mt-0.5">+${h.creditAdded} Credit</p>
                    <span class="inline-block mt-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full">${h.status}</span>
                </div>
            </div>
        `).join("");
    } catch (err) {
        console.error("Gagal load history:", err);
    }
}

// ============================================================
// COURSE UPLOAD & GENERATION
// ============================================================

let selectedFile = null;

function handleDragOver(e) {
    e.preventDefault();
    document.getElementById('upload-dropzone').classList.add('border-primary', 'bg-indigo-50/60');
}

function handleDragLeave(e) {
    document.getElementById('upload-dropzone').classList.remove('border-primary', 'bg-indigo-50/60');
}

function handleDrop(e) {
    e.preventDefault();
    handleDragLeave(e);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
}

function setSelectedFile(file) {
    // Supported file types
    const supportedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' // PPTX
    ];
    
    if (!supportedTypes.includes(file.type)) {
        alert('Format file tidak didukung. Gunakan: PDF, DOCX, atau PPTX.');
        return;
    }
    if (file.size > 20 * 1024 * 1024) {
        alert('Ukuran file maksimal 20 MB.');
        return;
    }
    
    selectedFile = file;
    
    // Get file extension
    const ext = file.name.split('.').pop().toLowerCase();
    
    // Update icon and colors based on file type
    const iconContainer = document.getElementById('upload-file-icon');
    let iconHtml = '';
    let iconClass = '';
    
    if (ext === 'pdf') {
        iconHtml = '<i class="ph-fill ph-file-pdf"></i>';
        iconClass = 'w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-500 text-2xl shrink-0';
    } else if (ext === 'docx') {
        iconHtml = '<i class="ph-fill ph-file-doc"></i>';
        iconClass = 'w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 text-2xl shrink-0';
    } else if (ext === 'pptx') {
        iconHtml = '<i class="ph-fill ph-file-ppt"></i>';
        iconClass = 'w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 text-2xl shrink-0';
    }
    
    iconContainer.innerHTML = iconHtml;
    iconContainer.className = iconClass;
    
    // Update processing text based on file type
    const readText = document.getElementById('step-read-text');
    if (readText) {
        if (ext === 'pdf') {
            readText.textContent = 'Membaca PDF...';
        } else if (ext === 'docx') {
            readText.textContent = 'Membaca DOCX...';
        } else if (ext === 'pptx') {
            readText.textContent = 'Membaca PPTX...';
        }
    }
    
    document.getElementById('upload-dropzone').classList.add('hidden');
    document.getElementById('upload-preview').classList.remove('hidden');
    document.getElementById('upload-filename').textContent = file.name;
    document.getElementById('upload-filesize').textContent = (file.size / 1024).toFixed(1) + ' KB';
}

function clearFile() {
    selectedFile = null;
    document.getElementById('pdf-input').value = '';
    document.getElementById('upload-dropzone').classList.remove('hidden');
    document.getElementById('upload-preview').classList.add('hidden');
    document.getElementById('upload-processing').classList.add('hidden');
}

function setStep(stepId, done = false) {
    const el = document.getElementById(stepId);
    if (!el) return;
    const icon = el.querySelector('.step-icon');
    const text = el.querySelector('span');
    if (done) {
        icon.innerHTML = '<i class="ph-fill ph-check-circle text-emerald-500 text-base"></i>';
        icon.className = 'step-icon w-6 h-6 flex items-center justify-center shrink-0';
        text.className = 'text-dark font-semibold';
    } else {
        icon.innerHTML = '<div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>';
        icon.className = 'step-icon w-6 h-6 flex items-center justify-center shrink-0';
        text.className = 'text-primary font-medium';
    }
}

async function generateCourse() {
    if (!selectedFile) return;

    // Show processing UI
    document.getElementById('upload-preview').classList.add('hidden');
    document.getElementById('upload-processing').classList.remove('hidden');

    const steps = ['step-read', 'step-ai', 'step-fc', 'step-quiz', 'step-done'];
    const delays = [0, 3000, 8000, 14000, 20000];

    // Animate steps progressively
    steps.forEach((s, i) => {
        setTimeout(() => setStep(s, false), delays[i]);
        if (i > 0) setTimeout(() => setStep(steps[i - 1], true), delays[i]);
    });

    const formData = new FormData();
    formData.append('pdf', selectedFile);

    try {
        const res  = await fetch('/api/course/upload', { method: 'POST', body: formData });
        const data = await res.json();

        // Mark all steps done
        steps.forEach(s => setStep(s, true));

        if (!data.success) {
            if (data.insufficientCredit) {
                document.getElementById('upload-processing').classList.add('hidden');
                document.getElementById('upload-dropzone').classList.remove('hidden');
                document.getElementById('no-credit-modal').classList.remove('hidden');
                selectedFile = null;
            } else {
                alert('Gagal: ' + data.message);
                clearFile();
            }
            return;
        }

        // Refresh dashboard data
        loadDashboard();
        loadCourses();

        // Redirect ke course setelah 1 detik
        setTimeout(() => {
            window.location.href = data.courseUrl;
        }, 1200);

    } catch (err) {
        console.error('Upload error:', err);
        alert('Terjadi kesalahan saat upload. Coba lagi.');
        clearFile();
    }
}
