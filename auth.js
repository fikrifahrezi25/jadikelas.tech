const express = require("express");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const DB_PATH = path.join(__dirname, "database_user.json");
const COURSES_PATH = path.join(__dirname, "course_list.json");

const PLAN_LIMITS = { 1: 2, 2: 10, 3: 50 };
const PLAN_NAMES = { 1: "Free", 2: "Starter Boost", 3: "Smart Learner", 4: "Creator", 5: "Campus Pro" };

function readDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    } catch {
        return [];
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function readCourses() {
    try {
        return JSON.parse(fs.readFileSync(COURSES_PATH, "utf-8"));
    } catch {
        return [];
    }
}

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

module.exports = router;
