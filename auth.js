const express = require("express");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const DB_PATH = path.join(__dirname, "database_user.json");
const COURSES_PATH = path.join(__dirname, "course_list.json");
const PAYMENT_HISTORY_PATH = path.join(__dirname, "payment_history.json");

const PLAN_LIMITS = { 1: 2, 2: 10, 3: 50 };
const PLAN_NAMES  = { 1: "Free", 2: "Starter", 3: "Pro" };

function readDB() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); } catch { return []; }
}
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

function readCourses() {
    try { return JSON.parse(fs.readFileSync(COURSES_PATH, "utf-8")); } catch { return []; }
}

function readPaymentHistory() {
    try { return JSON.parse(fs.readFileSync(PAYMENT_HISTORY_PATH, "utf-8")); } catch { return []; }
}
function writePaymentHistory(data) { fs.writeFileSync(PAYMENT_HISTORY_PATH, JSON.stringify(data, null, 2)); }

function generateInvoiceId() {
    const now  = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const history = readPaymentHistory();
    const seq  = String(history.length + 1).padStart(3, "0");
    return `INV-${date}-${seq}`;
}

const PACKAGES = [
    { id: 1, name: "Starter Boost", price: 9000,  credit: 10,  tier: 2, desc: "Untuk coba pertama kali" },
    { id: 2, name: "Smart Learner", price: 19000, credit: 25,  tier: 2, desc: "Cocok untuk mahasiswa aktif" },
    { id: 3, name: "Creator Pack",  price: 35000, credit: 50,  tier: 3, desc: "Pilihan terbaik kreator" },
    { id: 4, name: "Campus Pro",    price: 59000, credit: 100, tier: 3, desc: "Untuk kelas & organisasi" }
];

// POST /api/register
router.post("/register", async (req, res) => {
    const { namaLengkap, email, password } = req.body;

    if (!namaLengkap || !email || !password)
        return res.status(400).json({ success: false, message: "Semua field wajib diisi." });

    if (password.length < 6)
        return res.status(400).json({ success: false, message: "Password minimal 6 karakter." });

    const users = readDB();
    if (users.find(u => u.email === email))
        return res.status(409).json({ success: false, message: "Email sudah terdaftar." });

    const hashed = await bcrypt.hash(password, 10);
    users.push({ namaLengkap, email, password: hashed, plan: 1, creditLeft: 10, courseCreated: 0 });
    writeDB(users);

    return res.json({ success: true, message: "Register berhasil." });
});

// POST /api/login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return res.status(400).json({ success: false, message: "Email dan password wajib diisi." });

    const users = readDB();
    const user = users.find(u => u.email === email);

    if (!user)
        return res.status(404).json({ success: false, message: "User tidak ditemukan." });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
        return res.status(401).json({ success: false, message: "Password salah." });

    req.session.user = { namaLengkap: user.namaLengkap, email: user.email, plan: user.plan, creditLeft: user.creditLeft, courseCreated: user.courseCreated };

    return res.json({ success: true, user: req.session.user });
});

// GET /api/me
router.get("/me", (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ success: false, message: "Belum login." });

    // Ambil data terbaru dari DB
    const users = readDB();
    const user = users.find(u => u.email === req.session.user.email);
    if (!user) return res.status(404).json({ success: false, message: "User tidak ditemukan." });

    const { password: _, ...safeUser } = user;
    return res.json({ success: true, user: safeUser });
});

// POST /api/logout
router.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true, message: "Logout berhasil." });
    });
});

// GET /api/courses
router.get("/courses", (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ success: false, message: "Belum login." });

    const courses = readCourses();
    const userCourses = courses.filter(c => c.courseOwner === req.session.user.email);
    return res.json({ success: true, courses: userCourses });
});

// POST /api/update-profile
router.post("/update-profile", (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ success: false, message: "Belum login." });

    const { namaLengkap, sekolah } = req.body;
    if (!namaLengkap)
        return res.status(400).json({ success: false, message: "Nama lengkap wajib diisi." });

    const users = readDB();
    const idx = users.findIndex(u => u.email === req.session.user.email);
    if (idx === -1) return res.status(404).json({ success: false, message: "User tidak ditemukan." });

    users[idx].namaLengkap = namaLengkap;
    if (sekolah !== undefined) users[idx].sekolah = sekolah;
    writeDB(users);

    req.session.user.namaLengkap = namaLengkap;
    return res.json({ success: true, message: "Profil berhasil diperbarui." });
});

// POST /api/change-password
router.post("/change-password", async (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ success: false, message: "Belum login." });

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword)
        return res.status(400).json({ success: false, message: "Semua field wajib diisi." });

    if (newPassword.length < 6)
        return res.status(400).json({ success: false, message: "Kata sandi baru minimal 6 karakter." });

    if (newPassword !== confirmPassword)
        return res.status(400).json({ success: false, message: "Konfirmasi kata sandi tidak cocok." });

    const users = readDB();
    const idx = users.findIndex(u => u.email === req.session.user.email);
    if (idx === -1) return res.status(404).json({ success: false, message: "User tidak ditemukan." });

    const match = await bcrypt.compare(currentPassword, users[idx].password);
    if (!match)
        return res.status(401).json({ success: false, message: "Kata sandi saat ini salah." });

    users[idx].password = await bcrypt.hash(newPassword, 10);
    writeDB(users);

    return res.json({ success: true, message: "Kata sandi berhasil diperbarui." });
});

// GET /api/payment/history — riwayat transaksi user
router.get("/payment/history", (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ success: false, message: "Belum login." });

    const history = readPaymentHistory();
    const userHistory = history.filter(h => h.email === req.session.user.email);
    return res.json({ success: true, history: userHistory.reverse() });
});

// POST /api/payment/create
router.post("/payment/create", (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ success: false, message: "Belum login." });
    const { packageId } = req.body;
    const pkg = PACKAGES.find(p => p.id === packageId);
    if (!pkg) return res.status(400).json({ success: false, message: "Paket tidak ditemukan." });
    return res.json({ success: true, invoiceId: generateInvoiceId(), package: pkg });
});

// POST /api/payment/pay
router.post("/payment/pay", (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ success: false, message: "Belum login." });
    const { packageId } = req.body;
    const pkg = PACKAGES.find(p => p.id === packageId);
    if (!pkg) return res.status(400).json({ success: false, message: "Paket tidak ditemukan." });

    const users = readDB();
    const idx = users.findIndex(u => u.email === req.session.user.email);
    if (idx === -1) return res.status(404).json({ success: false, message: "User tidak ditemukan." });

    users[idx].creditLeft = (users[idx].creditLeft || 0) + pkg.credit;
    if (pkg.tier > (users[idx].plan || 1)) users[idx].plan = pkg.tier;
    writeDB(users);

    const history = readPaymentHistory();
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace("T", " ");
    const invoiceId = generateInvoiceId();
    history.push({ invoiceId, email: req.session.user.email, packageName: pkg.name, price: pkg.price, creditAdded: pkg.credit, status: "PAID", date: dateStr });
    writePaymentHistory(history);

    req.session.user.plan = users[idx].plan;
    req.session.user.creditLeft = users[idx].creditLeft;

    return res.json({ success: true, invoiceId, newPlan: PLAN_NAMES[users[idx].plan] || "Free", creditLeft: users[idx].creditLeft, creditAdded: pkg.credit });
});

module.exports = router;
