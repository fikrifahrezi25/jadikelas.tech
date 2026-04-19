// ============================================================
// dashboard.js — Logic dashboard, load data dari /api/me
// ============================================================

const PLAN_NAMES = { 1: "Free", 2: "Starter Boost", 3: "Smart Learner", 4: "Creator", 5: "Campus Pro" };
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
//        document.querySelectorAll("[data-user-course]").forEach(el => el.textContent = `${user.courseCreated} / ${planLimit} Maks`);
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

        container.innerHTML = data.courses.map(c => `
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4 hover:shadow-md transition-all course-card" data-title="${c.courseName.toLowerCase()}">
                <div class="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-primary text-2xl">
                    <i class="ph-fill ph-file-pdf"></i>
                </div>
                <div class="flex-1">
                    <h3 class="font-bold text-dark text-base mb-1">${c.courseName}</h3>
                    <p class="text-xs text-slate-400">${c.courseCreated}</p>
                </div>
                <a href="${c.courseUrl}" target="_blank" class="w-full py-2.5 text-center bg-indigo-50 hover:bg-primary hover:text-white text-primary font-semibold rounded-xl transition-all text-sm">
                    Buka Course
                </a>
            </div>
        `).join("");
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
