// ============================================================
// auth-handler.js — Include di index.html, about, pricing
// ============================================================

// Inject CSS untuk dropdown animation
(function() {
    const style = document.createElement("style");
    style.textContent = `
        #profile-dropdown {
            transform-origin: top right;
            transition: opacity 0.18s ease, transform 0.18s ease;
        }
        #profile-dropdown.opacity-0 { opacity: 0; transform: translateY(-8px); pointer-events: none; }
        #profile-dropdown.opacity-100 { opacity: 1; transform: translateY(0); pointer-events: auto; }
    `;
    document.head.appendChild(style);
})();

async function checkAuthState() {
    try {
        const res = await fetch("/api/me");
        if (res.ok) {
            const data = await res.json();
            if (data.success) updateNavbarLoggedIn(data.user);
        }
    } catch (_) {}
}

function updateNavbarLoggedIn(user) {
    // Sembunyikan tombol Login & Coba Gratis
    document.querySelectorAll("[data-auth-login]").forEach(el => el.style.display = "none");
    document.querySelectorAll("[data-auth-register]").forEach(el => el.style.display = "none");

    // Tampilkan avatar di desktop
    const avatarContainer = document.getElementById("nav-avatar-container");
    if (avatarContainer) {
        avatarContainer.style.display = "flex";
        const nameEl = avatarContainer.querySelector("[data-dropdown-name]");
        const emailEl = avatarContainer.querySelector("[data-dropdown-email]");
        if (nameEl) nameEl.textContent = user.namaLengkap;
        if (emailEl) emailEl.textContent = user.email;
    }

    // Tampilkan avatar button di mobile navbar
    const mobileNavAvatar = document.getElementById("mobile-nav-avatar");
    if (mobileNavAvatar) mobileNavAvatar.style.display = "block";

    // Tampilkan profile section di mobile menu
    const mobileAvatarContainer = document.getElementById("mobile-avatar-container");
    if (mobileAvatarContainer) {
        mobileAvatarContainer.style.display = "block";
        const nameEl = mobileAvatarContainer.querySelector("[data-dropdown-name]");
        const emailEl = mobileAvatarContainer.querySelector("[data-dropdown-email]");
        if (nameEl) nameEl.textContent = user.namaLengkap;
        if (emailEl) emailEl.textContent = user.email;
    }
}

// Toggle dropdown profile
function toggleProfileDropdown() {
    const dropdown = document.getElementById("profile-dropdown");
    if (!dropdown) return;
    const isHidden = dropdown.classList.contains("opacity-0");
    if (isHidden) {
        dropdown.classList.remove("opacity-0", "pointer-events-none", "translate-y-[-8px]");
        dropdown.classList.add("opacity-100", "translate-y-0");
    } else {
        dropdown.classList.add("opacity-0", "pointer-events-none", "translate-y-[-8px]");
        dropdown.classList.remove("opacity-100", "translate-y-0");
    }
}

// Tutup dropdown saat klik di luar
document.addEventListener("click", function(e) {
    const container = document.getElementById("nav-avatar-container");
    const dropdown = document.getElementById("profile-dropdown");
    if (container && dropdown && !container.contains(e.target)) {
        dropdown.classList.add("opacity-0", "pointer-events-none", "translate-y-[-8px]");
        dropdown.classList.remove("opacity-100", "translate-y-0");
    }
});

// ---- REGISTER ----
async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    const namaLengkap = form.querySelector("[name=namaLengkap]").value.trim();
    const email = form.querySelector("[name=email]").value.trim();
    const password = form.querySelector("[name=password]").value;
    const errEl = document.getElementById("register-error");

    try {
        const res = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ namaLengkap, email, password })
        });
        const data = await res.json();

        if (data.success) {
            const loginRes = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const loginData = await loginRes.json();
            if (loginData.success) window.location.href = "/dashboard";
        } else {
            if (errEl) errEl.textContent = data.message;
        }
    } catch (_) {
        if (errEl) errEl.textContent = "Terjadi kesalahan. Coba lagi.";
    }
}

// ---- LOGIN ----
async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const email = form.querySelector("[name=email]").value.trim();
    const password = form.querySelector("[name=password]").value;
    const errEl = document.getElementById("login-error");

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.success) {
            window.location.href = "/dashboard";
        } else {
            if (errEl) errEl.textContent = data.message;
        }
    } catch (_) {
        if (errEl) errEl.textContent = "Terjadi kesalahan. Coba lagi.";
    }
}

// ---- LOGOUT ----
async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
}

document.addEventListener("DOMContentLoaded", () => {
    checkAuthState();

    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    if (loginForm) loginForm.addEventListener("submit", handleLogin);
    if (registerForm) registerForm.addEventListener("submit", handleRegister);
});
