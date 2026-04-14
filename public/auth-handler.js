// ============================================================
// auth-handler.js — Include di index.html, about, pricing
// ============================================================

// Cek session saat halaman load, update navbar jika sudah login
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
    // Ganti tombol Login & Coba Gratis dengan nama user + tombol dashboard
    const loginBtns = document.querySelectorAll("[data-auth-login], [data-auth-register]");
    loginBtns.forEach(btn => btn.style.display = "none");

    const navActions = document.getElementById("nav-auth-actions");
    if (navActions) {
        navActions.innerHTML = `
            <a href="/dashboard" class="font-medium text-slate-600 hover:text-primary transition-colors">Dashboard</a>
            <span class="text-sm font-semibold text-dark">${user.namaLengkap}</span>
            <button onclick="handleLogout()" class="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-full font-medium transition-all text-sm">Logout</button>
        `;
    }
}

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
            // Auto login setelah register
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
