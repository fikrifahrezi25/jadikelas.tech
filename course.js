// ============================================================
// course.js — JadiKelas 2.0 Interactive Learning Engine
// Full gamification + student auth + leaderboard + AI tutor
// ============================================================

const express = require("express");
const multer  = require("multer");
const axios   = require("axios");
const fs      = require("fs");
const path    = require("path");
const crypto  = require("crypto");
const bcrypt  = require("bcrypt");

// ── Document Extraction Service ──────────────────────────────
const {
    extractDocument,
    getFileTypeFromMimetype,
    getFileIcon
} = require("./services/documentExtractor");

const router = express.Router();

// ── Paths ────────────────────────────────────────────────────
const ROOT              = __dirname;
const UPLOADS_DIR       = path.join(ROOT, "uploads");
const COURSE_DATA_DIR   = path.join(ROOT, "course-data");
const GENERATED_DIR     = path.join(ROOT, "generated-course");
const PROGRESS_DIR      = path.join(ROOT, "course-progress");
const PROMPT_DIR        = path.join(ROOT, "course-system-prompt");
const TEMPLATE_PATH     = path.join(ROOT, "course_template", "index.html");
const AUTH_TEMPLATE_PATH = path.join(ROOT, "course_template", "auth.html");
const COURSES_PATH      = path.join(ROOT, "course_list.json");
const DB_PATH           = path.join(ROOT, "database_user.json");
const STUDENTS_DIR      = path.join(ROOT, "course-students");

const POLLINATIONS_API_KEY = "sk_RM9sUErPNlaj7kFenSIMljnIVvAyssUk";

// Ensure dirs exist
[UPLOADS_DIR, COURSE_DATA_DIR, GENERATED_DIR, PROGRESS_DIR, PROMPT_DIR, STUDENTS_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── Helpers ──────────────────────────────────────────────────
function readDB() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); } catch { return []; }
}
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

function readCourses() {
    try { return JSON.parse(fs.readFileSync(COURSES_PATH, "utf-8")); } catch { return []; }
}
function writeCourses(data) { fs.writeFileSync(COURSES_PATH, JSON.stringify(data, null, 2)); }

function readStudents(courseId) {
    const p = path.join(STUDENTS_DIR, `database_siswa_${courseId}.json`);
    try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return []; }
}
function writeStudents(courseId, data) {
    const p = path.join(STUDENTS_DIR, `database_siswa_${courseId}.json`);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function readProgress(courseId, studentId) {
    const key = `${courseId}-${studentId.replace(/[@.]/g, "_")}`;
    const p = path.join(PROGRESS_DIR, `${key}.json`);
    try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}
function writeProgress(courseId, studentId, data) {
    const key = `${courseId}-${studentId.replace(/[@.]/g, "_")}`;
    const p = path.join(PROGRESS_DIR, `${key}.json`);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function nowStr() {
    return new Date().toLocaleString("id-ID", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false
    }).replace(/\//g, "-");
}

function calcLevel(xp) {
    if (xp < 200) return 1;
    if (xp < 500) return 2;
    if (xp < 1000) return 3;
    if (xp < 2000) return 4;
    if (xp < 3500) return 5;
    if (xp < 5000) return 6;
    return Math.floor(xp / 1000) + 1;
}

function xpForNextLevel(level) {
    const thresholds = [0, 200, 500, 1000, 2000, 3500, 5000];
    return thresholds[level] || level * 1000;
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ── Multer ───────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename:    (req, file, cb) => {
        const ts   = Date.now();
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        cb(null, `${ts}-${safe}`);
    }
});
// ── Supported File Types ─────────────────────────────────────
const SUPPORTED_MIMETYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
    "application/vnd.openxmlformats-officedocument.presentationml.presentation" // PPTX
];

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (req, file, cb) => {
        if (SUPPORTED_MIMETYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Format file tidak didukung. Gunakan: PDF, DOCX, atau PPTX."));
        }
    }
});

// ── AI Course Generation System Prompt (UPGRADED) ────────────
const AI_SYSTEM_PROMPT = `Kamu adalah AI Learning Designer kelas dunia yang mengubah materi pembelajaran (PDF, DOCX, PPTX) menjadi pengalaman belajar interaktif seperti Duolingo + Khan Academy.

TUGAS: Baca materi dokumen (PDF/DOCX/PPTX), ubah menjadi INTERACTIVE LEARNING EXPERIENCE.

PENTING SEKALI: Jika materi berisi CODE/PROGRAMMING (JavaScript, Python, HTML, SQL, etc), kamu WAJIB membuat CODE PLAYGROUND untuk praktek hands-on!

CRITICAL: Return HANYA JSON valid yang bisa di-parse.
- JANGAN gunakan newline literal dalam string (gunakan space atau singkat saja)
- JANGAN gunakan control characters
- UNTUK CODE: gunakan space instead of \\n, atau tulis code dalam 1 line
- ESCAPE semua quotes dengan benar

Format JSON WAJIB:
{
  "title": "Judul course menarik berdasarkan isi materi",
  "summary": "Ringkasan singkat 2-3 kalimat yang engaging",
  "emoji": "emoji yang relevan dengan topik (📚 untuk umum, ⚡ untuk JavaScript, 🐍 untuk Python, 🌐 untuk HTML/web, 🗄️ untuk database, 🔧 untuk networking, 🧮 untuk matematika)",
  "color": "warna hex tema course (pilih: #f59e0b untuk coding, #6366f1 untuk umum, #8b5cf6 untuk design, #ec4899 untuk creative, #10b981 untuk data, #3b82f6 untuk networking)",
  "learningBlocks": [
    {
      "type": "concept_card",
      "title": "Judul konsep pendek dan menarik",
      "icon": "emoji icon",
      "explanation": "Penjelasan singkat 2-3 kalimat, bahasa sederhana seperti guru friendly",
      "analogy": "Analogi sehari-hari yang mudah dipahami siswa",
      "highlight": "kata kunci penting",
      "keyPoints": ["poin 1", "poin 2", "poin 3"]
    },
    {
      "type": "code_playground",
      "title": "Coba Praktek Coding!",
      "icon": "💻",
      "language": "javascript|python|html|css|sql|java",
      "instruction": "Instruksi yang jelas untuk siswa",
      "fileName": "nama_file.js",
      "defaultCode": "// Code default yang bisa diedit siswa\nconsole.log('Hello');",
      "hint": "Hint atau challenge tambahan"
    },
    {
      "type": "visual_summary",
      "title": "Ringkasan Visual",
      "icon": "📊",
      "items": [
        { "label": "Label", "value": "Nilai/Deskripsi", "icon": "emoji" }
      ]
    },
    {
      "type": "step_by_step",
      "title": "Langkah-langkah",
      "icon": "🪜",
      "steps": [
        { "number": 1, "title": "Judul langkah", "description": "Deskripsi singkat", "tip": "Tips praktis" }
      ]
    },
    {
      "type": "analogy_card",
      "title": "Analogi Mudah",
      "icon": "💡",
      "realWorld": "Situasi nyata",
      "connection": "Koneksi ke konsep materi",
      "insight": "Insight penting"
    },
    {
      "type": "key_terms",
      "title": "Kamus Mini",
      "icon": "📖",
      "terms": [
        { "term": "istilah", "definition": "definisi singkat", "example": "contoh penggunaan" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Pertanyaan quiz engaging, tidak membosankan",
      "options": ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],
      "answer": "Opsi yang benar (harus sama persis)",
      "explanation": "Penjelasan singkat mengapa jawaban ini benar",
      "xpReward": 50
    }
  ],
  "flashcards": [
    {
      "question": "Pertanyaan singkat",
      "answer": "Jawaban jelas dan lengkap",
      "emoji": "emoji relevan",
      "difficulty": "easy|medium|hard"
    }
  ],
  "achievements": [
    {
      "id": "first_complete",
      "title": "Penjelajah Pertama",
      "description": "Menyelesaikan materi pertama",
      "icon": "🏅",
      "condition": "complete_all_blocks"
    }
  ],
  "tutorContext": "Penjelasan LENGKAP semua isi materi untuk AI tutor, minimal 500 kata. Sertakan semua konsep penting, contoh, analogi, cara menjelaskan yang friendly."
}

RULES WAJIB:
- Buat minimal 6 learningBlocks (campuran berbagai type)
- JIKA materi tentang CODING/PROGRAMMING: WAJIB minimal 2 code_playground blocks!
- Code playground harus punya defaultCode yang bisa dijalankan (tidak error)
- Untuk JavaScript playground: gunakan console.log() untuk output
- Untuk HTML playground: buat HTML lengkap dengan tag <!DOCTYPE html>
- Buat minimal 8 soal quiz dengan penjelasan jawaban
- Buat minimal 8 flashcards dengan emoji dan difficulty
- learningBlocks HARUS berisi campuran: concept_card, code_playground (jika coding), visual_summary, step_by_step, analogy_card, key_terms
- Penjelasan harus seperti guru modern yang friendly, tidak formal
- Gunakan bahasa Indonesia yang menarik dan tidak kaku
- Buat analogi yang relatable untuk pelajar Indonesia
- Return JSON valid saja, TIDAK ADA teks lain

DETEKSI TOPIK OTOMATIS:
- Jika dokumen berisi: function, variable, console.log, def, print(), class, import → PASTI materi coding → WAJIB code_playground
- Jika dokumen berisi: <html>, <div>, CSS, style → Materi web development → WAJIB code_playground HTML
- Jika dokumen berisi: SELECT, INSERT, DATABASE, query → Materi database → buat playground SQL (atau simulasi)
- Jika dokumen berisi rumus matematika → gunakan analogy_card dan visual_summary lebih banyak
- Jika dokumen berisi konfigurasi jaringan/server → gunakan step_by_step dan visual_summary`;

// ── POST /api/course/upload ───────────────────────────────────
router.post("/course/upload", upload.single("pdf"), async (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ success: false, message: "Belum login." });

    if (!req.file)
        return res.status(400).json({ success: false, message: "File wajib diupload (PDF, DOCX, atau PPTX)." });

    const email = req.session.user.email;

    const users = readDB();
    const userIdx = users.findIndex(u => u.email === email);
    if (userIdx === -1) return res.status(404).json({ success: false, message: "User tidak ditemukan." });

    if ((users[userIdx].creditLeft || 0) < 5) {
        fs.unlink(req.file.path, () => {});
        return res.status(402).json({ success: false, message: "Credit tidak cukup. Minimal 5 credit untuk generate course.", insufficientCredit: true });
    }

    const courseId   = crypto.randomBytes(16).toString("hex");
    const filePath   = req.file.path;
    const fileName   = req.file.originalname;
    const fileMime   = req.file.mimetype;
    const fileType   = getFileTypeFromMimetype(fileMime);

    if (!fileType) {
        fs.unlink(filePath, () => {});
        return res.status(400).json({ success: false, message: "Format file tidak didukung." });
    }

    try {
        // Extract document text using unified extractor
        let documentText = "";
        try {
            const extracted = await extractDocument(filePath, fileType);
            documentText = extracted.text.slice(0, 15000); // Limit to 15000 chars
        } catch (extractErr) {
            console.error(`${fileType.toUpperCase()} extraction error:`, extractErr.message);
            fs.unlink(filePath, () => {});
            return res.status(400).json({ 
                success: false, 
                message: extractErr.message || `Gagal membaca ${fileType.toUpperCase()}. Pastikan file tidak terenkripsi atau corrupt.` 
            });
        }

        if (!documentText || documentText.trim().length < 50) {
            fs.unlink(filePath, () => {});
            return res.status(400).json({ success: false, message: "Dokumen tidak dapat dibaca atau terlalu pendek. Minimal 50 karakter." });
        }

        // Call Pollinations AI
        const aiResponse = await axios.post(
            "https://gen.pollinations.ai/v1/chat/completions",
            {
                model: "openai",
                messages: [
                    { role: "system", content: AI_SYSTEM_PROMPT },
                    { role: "user",   content: `Isi materi ${fileType.toUpperCase()}:\n\n${documentText}` }
                ]
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${POLLINATIONS_API_KEY}`
                },
                timeout: 120000
            }
        );

        const rawContent = aiResponse.data.choices?.[0]?.message?.content || "";

        let aiData;
        try {
            let cleaned = rawContent
                .replace(/^```json\s*/i, "")
                .replace(/^```\s*/i, "")
                .replace(/```\s*$/i, "")
                .trim();
            
            // Advanced cleaning for problematic characters
            // Replace literal newlines in strings with \\n
            cleaned = cleaned.replace(/(\\"[^"]*)"([^"]*\n[^"]*)"([^"]*\\")/g, (match, p1, p2, p3) => {
                return p1 + '"' + p2.replace(/\n/g, '\\n') + '"' + p3;
            });
            
            // Remove control characters except newlines in JSON structure
            cleaned = cleaned.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');
            
            // Fix common issues
            cleaned = cleaned
                .replace(/\r\n/g, '\n')  // Normalize line endings
                .replace(/\t/g, '    ')  // Replace tabs with spaces
                .replace(/\\'/g, "'");   // Fix escaped single quotes
            
            aiData = JSON.parse(cleaned);
            
        } catch (parseErr) {
            console.error("AI JSON parse error:", parseErr.message);
            console.error("Problematic JSON (first 500 chars):", rawContent.slice(0, 500));
            console.error("Last 200 chars:", rawContent.slice(-200));
            
            // Try one more time with aggressive cleaning
            try {
                let aggressive = rawContent
                    .replace(/^```json\s*/i, "")
                    .replace(/^```\s*/i, "")
                    .replace(/```\s*$/i, "")
                    .trim()
                    // Remove ALL control characters
                    .replace(/[\x00-\x1F\x7F]/g, '')
                    // Fix escaped characters
                    .replace(/\\\\/g, '\\')
                    // Fix quotes
                    .replace(/\\"/g, '"')
                    .replace(/\\'/g, "'");
                
                aiData = JSON.parse(aggressive);
                console.log("✅ Aggressive cleaning worked!");
                
            } catch (secondErr) {
                console.error("Second parse attempt failed:", secondErr.message);
                
                // Save raw output untuk debugging
                const debugPath = path.join(__dirname, `debug_output_${Date.now()}.txt`);
                fs.writeFileSync(debugPath, rawContent);
                console.error(`Raw AI output saved to: ${debugPath}`);
                
                return res.status(500).json({ 
                    success: false, 
                    message: "AI gagal menghasilkan format yang valid. Coba upload lagi atau coba PDF yang lebih simple." 
                });
            }
        }

        // Simpan course-data JSON
        const courseDataPath = path.join(COURSE_DATA_DIR, `${courseId}.json`);
        
        // Sanitize code playgrounds to ensure they're safe
        if (aiData.learningBlocks) {
            aiData.learningBlocks.forEach(block => {
                if (block.type === 'code_playground' && block.defaultCode) {
                    // Ensure code is properly formatted
                    block.defaultCode = block.defaultCode
                        .replace(/\\n/g, '\n')  // Convert \\n to actual newlines
                        .replace(/\\t/g, '\t')  // Convert \\t to actual tabs
                        .replace(/\\"/g, '"')   // Fix escaped quotes
                        .trim();
                }
            });
        }
        
        fs.writeFileSync(courseDataPath, JSON.stringify(aiData, null, 2));

        // Generate system prompt untuk AI Tutor
        const tutorPrompt = `Kamu adalah AI Tutor super friendly untuk course "${aiData.title}" di JadiKelas.tech.

Karakter kamu:
- Nama: Kela (AI Tutor JadiKelas)
- Gaya: Friendly, hangat, supportif seperti kakak yang pintar
- Bahasa: Indonesia casual tapi informatif
- TIDAK formal, TIDAK kaku, TIDAK seperti robot

Cara menjawab:
- Gunakan analogi sehari-hari yang relatable
- Sertakan emoji yang sesuai 😊
- Jawab singkat tapi padat (3-5 kalimat)
- Jika ada code/teknis, jelaskan dengan bahasa sederhana dulu
- Mulai jawaban dengan sapaan hangat atau reaksi natural

Materi course ini:
${aiData.summary}

${aiData.tutorContext}

Rules:
- Fokus HANYA pada isi materi course ini
- Jika di luar materi, arahkan kembali dengan ramah
- Berikan semangat dan motivasi belajar
- Buat belajar terasa menyenangkan`;

        const promptPath = path.join(PROMPT_DIR, `${courseId}.md`);
        fs.writeFileSync(promptPath, tutorPrompt);

        // Generate HTML dari template
        let templateHtml = fs.readFileSync(TEMPLATE_PATH, "utf-8");

        // Inject data ke template sebagai JSON
        const courseJson = JSON.stringify(aiData);
        templateHtml = templateHtml
            .replace(/\{\{courseTitle\}\}/g, escapeHtml(aiData.title))
            .replace(/\{\{courseEmoji\}\}/g, aiData.emoji || "📚")
            .replace(/\{\{courseColor\}\}/g, aiData.color || "#6366f1")
            .replace("<!-- COURSE_DATA_INJECT -->",
                `<script>const COURSE_ID = "${courseId}"; const COURSE_DATA = ${courseJson};</script>`);

        const generatedPath = path.join(GENERATED_DIR, `${courseId}.html`);
        fs.writeFileSync(generatedPath, templateHtml);

        // Init student database untuk course ini
        if (!fs.existsSync(path.join(STUDENTS_DIR, `database_siswa_${courseId}.json`))) {
            writeStudents(courseId, []);
        }

        // Update course_list.json
        const courses = readCourses();
        courses.push({
            courseId,
            courseName:      aiData.title,
            courseEmoji:     aiData.emoji || "📚",
            courseColor:     aiData.color || "#6366f1",
            courseFileName:  fileName,
            fileType:        fileType, // NEW: Track file type
            originalFileName: fileName, // NEW: Original file name
            courseOwner:     email,
            courseCreated:   nowStr(),
            courseUrl:       `/course/${courseId}`,
            courseThumbnail: "/assets/course-default.png",
            courseStatus:    "completed"
        });
        writeCourses(courses);

        // Kurangi credit
        users[userIdx].creditLeft    = Math.max(0, (users[userIdx].creditLeft || 0) - 5);
        users[userIdx].courseCreated = (users[userIdx].courseCreated || 0) + 1;
        writeDB(users);

        req.session.user.creditLeft    = users[userIdx].creditLeft;
        req.session.user.courseCreated = users[userIdx].courseCreated;

        return res.json({
            success: true,
            courseId,
            courseUrl: `/course/${courseId}`,
            courseName: aiData.title,
            creditLeft: users[userIdx].creditLeft
        });

    } catch (err) {
        console.error("Course generation error:", err.message);
        fs.unlink(filePath, () => {});
        return res.status(500).json({ success: false, message: "Gagal generate course. Coba lagi." });
    }
});

// ============================================================
// STUDENT AUTH — Per Course
// ============================================================

// POST /api/course/student/register
router.post("/course/student/register", async (req, res) => {
    const { courseId, username, email, password } = req.body;
    if (!courseId || !username || !email || !password)
        return res.status(400).json({ success: false, message: "Semua field wajib diisi." });

    if (password.length < 6)
        return res.status(400).json({ success: false, message: "Password minimal 6 karakter." });

    // Cek course exists
    const coursePath = path.join(COURSE_DATA_DIR, `${courseId}.json`);
    if (!fs.existsSync(coursePath))
        return res.status(404).json({ success: false, message: "Course tidak ditemukan." });

    const students = readStudents(courseId);
    if (students.find(s => s.email === email))
        return res.status(409).json({ success: false, message: "Email sudah terdaftar di course ini." });

    const studentId = crypto.randomBytes(8).toString("hex");
    const hashed = await bcrypt.hash(password, 10);

    const newStudent = {
        studentId,
        username,
        email,
        password: hashed,
        profilePicture: "",
        xp: 0,
        coin: 0,
        level: 1,
        streak: 0,
        lastLogin: nowStr(),
        quizScore: 0,
        completedBlocks: [],
        completedChapter: [],
        flashcardsViewed: 0,
        leaderboardPoint: 0,
        achievements: [],
        joinedAt: nowStr()
    };

    students.push(newStudent);
    writeStudents(courseId, students);

    // Set session
    req.session.student = { studentId, username, email, courseId };

    return res.json({ success: true, message: "Berhasil bergabung!", student: { studentId, username, email, xp: 0, coin: 0, level: 1 } });
});

// POST /api/course/student/login
router.post("/course/student/login", async (req, res) => {
    const { courseId, email, password } = req.body;
    if (!courseId || !email || !password)
        return res.status(400).json({ success: false, message: "Semua field wajib diisi." });

    // Cek course exists
    const coursePath = path.join(COURSE_DATA_DIR, `${courseId}.json`);
    if (!fs.existsSync(coursePath))
        return res.status(404).json({ success: false, message: "Course tidak ditemukan." });

    let students = readStudents(courseId);
    let student = students.find(s => s.email === email);
    let isMainAccountLogin = false;

    // Jika tidak ditemukan di database siswa course, cek di database_user.json
    if (!student) {
        const mainUsers = readDB();
        const mainUser = mainUsers.find(u => u.email === email);
        
        if (mainUser) {
            // Verifikasi password dari akun utama
            const match = await bcrypt.compare(password, mainUser.password);
            if (!match)
                return res.status(401).json({ success: false, message: "Password salah." });

            // Auto-register user ke course ini sebagai siswa
            const studentId = crypto.randomBytes(8).toString("hex");
            const newStudent = {
                studentId,
                username: mainUser.namaLengkap,
                email: mainUser.email,
                password: mainUser.password, // Sudah ter-hash
                profilePicture: "",
                xp: 0,
                coin: 0,
                level: 1,
                streak: 0,
                lastLogin: nowStr(),
                lastLoginDate: new Date().toDateString(),
                quizScore: 0,
                completedBlocks: [],
                completedChapter: [],
                flashcardsViewed: 0,
                leaderboardPoint: 0,
                achievements: [],
                joinedAt: nowStr(),
                isMainAccount: true // Tandai sebagai akun dari database utama
            };

            students.push(newStudent);
            writeStudents(courseId, students);
            student = newStudent;
            isMainAccountLogin = true;
        } else {
            return res.status(404).json({ success: false, message: "Akun tidak ditemukan. Silakan register terlebih dahulu atau gunakan akun JadiKelas Anda." });
        }
    } else {
        // Login dengan akun siswa yang sudah ada
        const match = await bcrypt.compare(password, student.password);
        if (!match)
            return res.status(401).json({ success: false, message: "Password salah." });
    }

    // Update streak
    const studentIdx = students.findIndex(s => s.email === email);
    const today = new Date().toDateString();
    const lastLogin = students[studentIdx].lastLoginDate;
    if (lastLogin !== today) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (lastLogin === yesterday) {
            students[studentIdx].streak = (students[studentIdx].streak || 0) + 1;
            // Streak bonus
            students[studentIdx].xp   = (students[studentIdx].xp || 0) + 20;
            students[studentIdx].coin = (students[studentIdx].coin || 0) + 10;
        } else if (lastLogin !== today) {
            students[studentIdx].streak = 1;
        }
        students[studentIdx].lastLoginDate = today;
        students[studentIdx].lastLogin = nowStr();
        students[studentIdx].level = calcLevel(students[studentIdx].xp);
        writeStudents(courseId, students);
    }

    req.session.student = { studentId: student.studentId, username: student.username, email: student.email, courseId };

    const welcomeMessage = isMainAccountLogin 
        ? "Selamat datang! Anda berhasil login dengan akun JadiKelas." 
        : "Login berhasil!";

    return res.json({ 
        success: true, 
        message: welcomeMessage,
        student: { 
            studentId: students[studentIdx].studentId, 
            username: students[studentIdx].username, 
            email: students[studentIdx].email, 
            xp: students[studentIdx].xp, 
            coin: students[studentIdx].coin, 
            level: students[studentIdx].level, 
            streak: students[studentIdx].streak,
            isMainAccount: students[studentIdx].isMainAccount || false
        } 
    });
});

// POST /api/course/student/logout
router.post("/course/student/logout", (req, res) => {
    req.session.student = null;
    return res.json({ success: true });
});

// GET /api/course/student/me/:courseId
router.get("/course/student/me/:courseId", (req, res) => {
    const { courseId } = req.params;
    const sess = req.session.student;
    if (!sess || sess.courseId !== courseId)
        return res.status(401).json({ success: false, message: "Belum login sebagai siswa." });

    const students = readStudents(courseId);
    const student = students.find(s => s.studentId === sess.studentId);
    if (!student) return res.status(404).json({ success: false, message: "Siswa tidak ditemukan." });

    const { password: _, ...safe } = student;
    return res.json({ success: true, student: safe });
});

// POST /api/course/student/update-profile
router.post("/course/student/update-profile", async (req, res) => {
    const sess = req.session.student;
    if (!sess) return res.status(401).json({ success: false, message: "Belum login." });

    const { courseId, username, currentPassword, newPassword } = req.body;
    if (sess.courseId !== courseId) return res.status(403).json({ success: false, message: "Akses ditolak." });

    const students = readStudents(courseId);
    const idx = students.findIndex(s => s.studentId === sess.studentId);
    if (idx === -1) return res.status(404).json({ success: false, message: "Siswa tidak ditemukan." });

    if (username) students[idx].username = username;

    if (newPassword) {
        if (!currentPassword) return res.status(400).json({ success: false, message: "Password saat ini wajib diisi." });
        const match = await bcrypt.compare(currentPassword, students[idx].password);
        if (!match) return res.status(401).json({ success: false, message: "Password saat ini salah." });
        if (newPassword.length < 6) return res.status(400).json({ success: false, message: "Password baru minimal 6 karakter." });
        students[idx].password = await bcrypt.hash(newPassword, 10);
    }

    writeStudents(courseId, students);
    if (username) req.session.student.username = username;

    return res.json({ success: true, message: "Profil berhasil diperbarui." });
});

// ============================================================
// FEATURE 1: AI EXPLAIN LIKE I'M 5
// ============================================================

// POST /api/course/explain-simple
router.post("/course/explain-simple", async (req, res) => {
    console.log('=== EXPLAIN SIMPLE REQUEST ===');
    console.log('Session:', req.session.student ? 'Logged in' : 'Not logged in');
    
    const sess = req.session.student;
    if (!sess) {
        console.log('Error: No session');
        return res.status(401).json({ success: false, message: "Belum login." });
    }

    const { courseId, selectedText, blockTitle } = req.body;
    console.log('Request body:', { courseId, selectedTextLength: selectedText?.length, blockTitle });
    
    if (!courseId || !selectedText) {
        console.log('Error: Missing data');
        return res.status(400).json({ success: false, message: "Data tidak lengkap." });
    }

    if (sess.courseId !== courseId) {
        console.log('Error: CourseId mismatch', { sessionCourseId: sess.courseId, requestCourseId: courseId });
        return res.status(403).json({ success: false, message: "Akses ditolak." });
    }

    try {
        // Call Pollinations AI with ELI5 prompt
        const systemPrompt = `Kamu adalah guru SD terbaik yang paling sabar dan ramah.

TUGAS: Ubah materi berikut menjadi bahasa yang SANGAT mudah dipahami, bahkan untuk anak SD kelas 5.

ATURAN WAJIB:
- Gunakan bahasa Indonesia yang santai dan friendly
- Gunakan analogi dari kehidupan sehari-hari
- Gunakan contoh yang mudah dipahami (mainan, makanan, kegiatan sehari-hari)
- JANGAN gunakan istilah teknis yang rumit
- JANGAN menghilangkan konsep utama, tapi jelaskan dengan sederhana
- Maksimal 300 kata
- Gunakan poin-poin jika perlu agar mudah dibaca
- Mulai dengan kalimat pembuka yang hangat
- Akhiri dengan kalimat motivasi

CONTOH FORMAT JAWABAN:
Oke, aku jelasin dengan cara yang gampang ya! 😊

[Penjelasan dengan analogi sederhana]

Jadi intinya:
• Poin 1
• Poin 2
• Poin 3

Gampang kan? Kamu pasti bisa! 💪`;

        const aiResponse = await axios.post(
            "https://gen.pollinations.ai/v1/chat/completions",
            {
                model: "openai",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Judul Materi: ${blockTitle || 'Materi Pembelajaran'}\n\nIsi Materi:\n${selectedText}` }
                ]
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${POLLINATIONS_API_KEY}`
                },
                timeout: 30000
            }
        );

        console.log('AI Response received:', aiResponse.data.choices?.[0]?.message ? 'Success' : 'Empty');
        
        const simpleExplanation = aiResponse.data.choices?.[0]?.message?.content || "Maaf, tidak bisa menjelaskan saat ini.";

        // Deduct credit from student (1 credit per use)
        const students = readStudents(courseId);
        const idx = students.findIndex(s => s.studentId === sess.studentId);
        
        console.log('Student found:', idx !== -1);
        
        if (idx === -1) {
            return res.status(404).json({ success: false, message: "Siswa tidak ditemukan." });
        }

        // Check if student has credit (we'll use coins as credit system)
        console.log('Student coins:', students[idx].coin || 0);
        
        if ((students[idx].coin || 0) < 1) {
            return res.status(402).json({ 
                success: false, 
                message: "Coin tidak cukup. Minimal 1 coin untuk menggunakan fitur ini.",
                insufficientCredit: true
            });
        }

        // Deduct 1 coin
        students[idx].coin = Math.max(0, (students[idx].coin || 0) - 1);
        
        // Give XP reward for active learning
        students[idx].xp = (students[idx].xp || 0) + 5;
        students[idx].level = calcLevel(students[idx].xp);

        writeStudents(courseId, students);

        console.log('Success! New coin:', students[idx].coin);

        return res.json({
            success: true,
            simpleExplanation,
            newCoin: students[idx].coin,
            xpGained: 5
        });

    } catch (err) {
        console.error("Explain Simple error:", err.message);
        console.error("Error stack:", err.stack);
        return res.status(500).json({ success: false, message: "Gagal menjelaskan materi: " + err.message });
    }
});

// ============================================================
// FEATURE 2: AI EXAM SIMULATION
// ============================================================

// POST /api/course/generate-exam
router.post("/course/generate-exam", async (req, res) => {
    const sess = req.session.student;
    if (!sess) return res.status(401).json({ success: false, message: "Belum login." });

    const { courseId } = req.body;
    if (!courseId || sess.courseId !== courseId) {
        return res.status(403).json({ success: false, message: "Akses ditolak." });
    }

    // Check if exam already exists (cache)
    const EXAMS_DIR = path.join(COURSE_DATA_DIR, "exams");
    if (!fs.existsSync(EXAMS_DIR)) fs.mkdirSync(EXAMS_DIR, { recursive: true });
    
    const examPath = path.join(EXAMS_DIR, `${courseId}.json`);
    if (fs.existsSync(examPath)) {
        // Return cached exam
        try {
            const cachedExam = JSON.parse(fs.readFileSync(examPath, "utf-8"));
            return res.json({ success: true, exam: cachedExam, cached: true });
        } catch (_) {
            // If cache corrupted, regenerate
        }
    }

    // Load course data
    const courseDataPath = path.join(COURSE_DATA_DIR, `${courseId}.json`);
    if (!fs.existsSync(courseDataPath)) {
        return res.status(404).json({ success: false, message: "Course tidak ditemukan." });
    }

    try {
        const courseData = JSON.parse(fs.readFileSync(courseDataPath, "utf-8"));

        // Prepare content for AI
        const contentSummary = `
COURSE: ${courseData.title}
SUMMARY: ${courseData.summary}

LEARNING BLOCKS:
${courseData.learningBlocks.map((b, i) => `${i + 1}. ${b.title} (${b.type})`).join('\n')}

FLASHCARDS TOPICS:
${courseData.flashcards.slice(0, 5).map(f => f.question).join('\n')}

TUTOR CONTEXT:
${courseData.tutorContext.slice(0, 1000)}
        `.trim();

        const examPrompt = `Kamu adalah expert exam designer untuk platform pembelajaran online.

TUGAS: Buat simulasi ujian komprehensif berdasarkan course berikut.

${contentSummary}

REQUIREMENTS:
- Buat 20 soal yang mencakup SEMUA materi
- Campuran tipe soal: 40% multiple choice, 20% true/false, 20% matching, 20% case study
- Setiap soal harus relevan dengan materi course
- Difficulty bertingkat: 50% mudah, 30% sedang, 20% sulit
- Time limit: 30 menit (1800 detik)

OUTPUT FORMAT (JSON ONLY):
{
  "title": "Simulasi Ujian: [Judul Course]",
  "timeLimit": 1800,
  "totalQuestions": 20,
  "passingScore": 70,
  "questions": [
    {
      "type": "multiple_choice",
      "question": "Pertanyaan yang jelas dan spesifik?",
      "options": ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],
      "answer": "Opsi A",
      "explanation": "Penjelasan singkat kenapa jawaban ini benar",
      "points": 10,
      "difficulty": "easy"
    },
    {
      "type": "true_false",
      "question": "Pernyataan yang bisa dijawab benar/salah",
      "answer": "true",
      "explanation": "Penjelasan jawaban",
      "points": 10,
      "difficulty": "easy"
    },
    {
      "type": "matching",
      "question": "Cocokkan istilah dengan definisi yang tepat",
      "pairs": [
        {"term": "Istilah 1", "definition": "Definisi 1"},
        {"term": "Istilah 2", "definition": "Definisi 2"},
        {"term": "Istilah 3", "definition": "Definisi 3"}
      ],
      "points": 15,
      "difficulty": "medium"
    },
    {
      "type": "case_study",
      "scenario": "Deskripsi kasus/situasi yang harus dianalisis",
      "question": "Pertanyaan berdasarkan kasus di atas?",
      "options": ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],
      "answer": "Opsi A",
      "explanation": "Penjelasan detail",
      "points": 15,
      "difficulty": "hard"
    }
  ]
}

CRITICAL: Return ONLY valid JSON, no other text.`;

        const aiResponse = await axios.post(
            "https://gen.pollinations.ai/v1/chat/completions",
            {
                model: "openai",
                messages: [
                    { role: "system", content: "You are an expert educational assessment designer. Return only valid JSON." },
                    { role: "user", content: examPrompt }
                ]
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${POLLINATIONS_API_KEY}`
                },
                timeout: 120000
            }
        );

        const rawContent = aiResponse.data.choices?.[0]?.message?.content || "";
        
        let examData;
        try {
            let cleaned = rawContent
                .replace(/^```json\s*/i, "")
                .replace(/^```\s*/i, "")
                .replace(/```\s*$/i, "")
                .trim()
                .replace(/[\x00-\x1F\x7F]/g, '');
            
            examData = JSON.parse(cleaned);
        } catch (parseErr) {
            console.error("Exam JSON parse error:", parseErr.message);
            return res.status(500).json({ success: false, message: "AI gagal generate exam. Coba lagi." });
        }

        // Save to cache
        fs.writeFileSync(examPath, JSON.stringify(examData, null, 2));

        return res.json({ success: true, exam: examData, cached: false });

    } catch (err) {
        console.error("Generate exam error:", err.message);
        return res.status(500).json({ success: false, message: "Gagal generate exam. Coba lagi." });
    }
});

// POST /api/course/submit-exam
router.post("/course/submit-exam", (req, res) => {
    const sess = req.session.student;
    if (!sess) return res.status(401).json({ success: false, message: "Belum login." });

    const { courseId, answers, timeSpent, tabSwitches } = req.body;
    if (!courseId || !answers || sess.courseId !== courseId) {
        return res.status(400).json({ success: false, message: "Data tidak lengkap." });
    }

    // Load exam
    const examPath = path.join(COURSE_DATA_DIR, "exams", `${courseId}.json`);
    if (!fs.existsSync(examPath)) {
        return res.status(404).json({ success: false, message: "Exam tidak ditemukan." });
    }

    try {
        const examData = JSON.parse(fs.readFileSync(examPath, "utf-8"));
        
        // Calculate score
        let correctCount = 0;
        let totalPoints = 0;
        let earnedPoints = 0;

        examData.questions.forEach((q, index) => {
            totalPoints += q.points || 10;
            const userAnswer = answers[index];

            let isCorrect = false;
            
            if (q.type === "multiple_choice" || q.type === "case_study") {
                isCorrect = userAnswer === q.answer;
            } else if (q.type === "true_false") {
                isCorrect = userAnswer === q.answer;
            } else if (q.type === "matching") {
                // For matching, check if all pairs are correct
                // userAnswer should be an object mapping terms to definitions
                if (userAnswer && q.pairs) {
                    isCorrect = q.pairs.every(pair => userAnswer[pair.term] === pair.definition);
                }
            }

            if (isCorrect) {
                correctCount++;
                earnedPoints += q.points || 10;
            }
        });

        const score = Math.round((earnedPoints / totalPoints) * 100);
        
        // Apply tab switch penalty
        let penaltyPercent = 0;
        if (tabSwitches > 3) {
            penaltyPercent = 10;
        }
        const finalScore = Math.max(0, score - penaltyPercent);

        // Determine grade
        let grade = "F";
        if (finalScore >= 90) grade = "A";
        else if (finalScore >= 80) grade = "B";
        else if (finalScore >= 70) grade = "C";
        else if (finalScore >= 60) grade = "D";

        // Calculate rewards
        let xpReward = 0;
        let coinReward = 0;
        const badges = [];

        if (finalScore === 100) {
            xpReward = 500;
            coinReward = 150;
            badges.push({ id: "perfect_score", name: "Perfect Score", icon: "🏆", rarity: "legendary" });
        } else if (finalScore >= 90) {
            xpReward = 400;
            coinReward = 100;
            badges.push({ id: "gold_badge", name: "Gold Master", icon: "🥇", rarity: "epic" });
        } else if (finalScore >= 80) {
            xpReward = 300;
            coinReward = 75;
            badges.push({ id: "silver_badge", name: "Silver Star", icon: "🥈", rarity: "rare" });
        } else if (finalScore >= 70) {
            xpReward = 200;
            coinReward = 50;
            badges.push({ id: "bronze_badge", name: "Bronze Fighter", icon: "🥉", rarity: "uncommon" });
        } else {
            xpReward = 50;
            coinReward = 10;
        }

        // Update student data
        const students = readStudents(courseId);
        const idx = students.findIndex(s => s.studentId === sess.studentId);
        if (idx === -1) {
            return res.status(404).json({ success: false, message: "Siswa tidak ditemukan." });
        }

        students[idx].xp = (students[idx].xp || 0) + xpReward;
        students[idx].coin = (students[idx].coin || 0) + coinReward;
        students[idx].level = calcLevel(students[idx].xp);
        
        // Update exam stats
        students[idx].examScore = finalScore;
        students[idx].totalExamsTaken = (students[idx].totalExamsTaken || 0) + 1;
        students[idx].highestExamScore = Math.max(finalScore, students[idx].highestExamScore || 0);
        students[idx].totalExamScore = (students[idx].totalExamScore || 0) + finalScore;
        students[idx].averageExamScore = Math.round(students[idx].totalExamScore / students[idx].totalExamsTaken);

        // Add badges
        if (!students[idx].examBadges) students[idx].examBadges = [];
        badges.forEach(b => {
            if (!students[idx].examBadges.find(eb => eb.id === b.id)) {
                students[idx].examBadges.push({ ...b, earnedAt: nowStr() });
            }
        });

        // Update leaderboard
        students[idx].leaderboardPoint = (students[idx].xp || 0) + (students[idx].examScore || 0) * 10;

        writeStudents(courseId, students);

        return res.json({
            success: true,
            score: finalScore,
            grade,
            correctCount,
            totalQuestions: examData.questions.length,
            xpReward,
            coinReward,
            badges,
            penalty: penaltyPercent > 0 ? `${penaltyPercent}% penalty for ${tabSwitches} tab switches` : null,
            newXP: students[idx].xp,
            newCoin: students[idx].coin,
            newLevel: students[idx].level,
            passed: finalScore >= (examData.passingScore || 70)
        });

    } catch (err) {
        console.error("Submit exam error:", err.message);
        return res.status(500).json({ success: false, message: "Gagal submit exam." });
    }
});

// GET /api/course/exam-stats/:courseId
router.get("/course/exam-stats/:courseId", (req, res) => {
    const sess = req.session.student;
    if (!sess) return res.status(401).json({ success: false, message: "Belum login." });

    const { courseId } = req.params;
    if (sess.courseId !== courseId) {
        return res.status(403).json({ success: false, message: "Akses ditolak." });
    }

    const students = readStudents(courseId);
    const student = students.find(s => s.studentId === sess.studentId);
    if (!student) {
        return res.status(404).json({ success: false, message: "Siswa tidak ditemukan." });
    }

    return res.json({
        success: true,
        stats: {
            totalExamsTaken: student.totalExamsTaken || 0,
            highestExamScore: student.highestExamScore || 0,
            averageExamScore: student.averageExamScore || 0,
            examBadges: student.examBadges || []
        }
    });
});

// ============================================================
// GAMIFICATION — XP, Coin, Achievements
// ============================================================

// POST /api/course/gamification/reward
router.post("/course/gamification/reward", (req, res) => {
    const sess = req.session.student;
    if (!sess) return res.status(401).json({ success: false, message: "Belum login." });

    const { courseId, action, blockId } = req.body;
    if (sess.courseId !== courseId) return res.status(403).json({ success: false, message: "Akses ditolak." });

    const students = readStudents(courseId);
    const idx = students.findIndex(s => s.studentId === sess.studentId);
    if (idx === -1) return res.status(404).json({ success: false, message: "Siswa tidak ditemukan." });

    const student = students[idx];
    let xpGained = 0, coinGained = 0;
    const newAchievements = [];

    // XP & Coin per action
    const rewards = {
        complete_block:    { xp: 30,  coin: 10 },
        quiz_correct:      { xp: 50,  coin: 20 },
        quiz_wrong:        { xp: 5,   coin: 0  },
        quiz_complete:     { xp: 100, coin: 40 },
        flashcard_viewed:  { xp: 10,  coin: 5  },
        all_flashcards:    { xp: 80,  coin: 30 },
        chapter_complete:  { xp: 150, coin: 50 },
        ai_interaction:    { xp: 15,  coin: 5  },
        perfect_quiz:      { xp: 200, coin: 100 }
    };

    const reward = rewards[action];
    if (reward) {
        xpGained   = reward.xp;
        coinGained = reward.coin;
    }

    // Track completed blocks
    if (action === "complete_block" && blockId) {
        if (!student.completedBlocks) student.completedBlocks = [];
        if (!student.completedBlocks.includes(blockId)) {
            student.completedBlocks.push(blockId);
        } else {
            xpGained = 0; coinGained = 0; // Already completed, no reward
        }
    }

    student.xp   = (student.xp   || 0) + xpGained;
    student.coin = (student.coin || 0) + coinGained;
    student.leaderboardPoint = (student.leaderboardPoint || 0) + xpGained;

    // Level up
    const newLevel = calcLevel(student.xp);
    const leveledUp = newLevel > (student.level || 1);
    student.level = newLevel;

    // Achievement checks
    const achievementDefs = [
        { id: "first_block",    title: "Langkah Pertama",   icon: "🌟", desc: "Menyelesaikan learning block pertama",    check: s => (s.completedBlocks||[]).length >= 1 },
        { id: "quiz_master",    title: "Quiz Master",        icon: "🧠", desc: "Menjawab 5 soal quiz dengan benar",       check: s => (s.quizCorrectCount||0) >= 5 },
        { id: "flashcard_pro",  title: "Flashcard Pro",      icon: "🃏", desc: "Melihat 5 flashcard",                     check: s => (s.flashcardsViewed||0) >= 5 },
        { id: "perfect_quiz",   title: "Nilai Sempurna",     icon: "💯", desc: "Mendapat skor sempurna di quiz",          check: s => (s.perfectQuizCount||0) >= 1 },
        { id: "ai_explorer",    title: "AI Explorer",        icon: "🤖", desc: "Berinteraksi 3 kali dengan AI Tutor",    check: s => (s.aiInteractions||0) >= 3 },
        { id: "level_5",        title: "Pendekar Ilmu",      icon: "⚔️", desc: "Mencapai Level 5",                       check: s => (s.level||1) >= 5 },
        { id: "coin_100",       title: "Kolektor Koin",      icon: "🪙", desc: "Mengumpulkan 100 koin",                  check: s => (s.coin||0) >= 100 },
        { id: "streak_3",       title: "Konsisten",          icon: "🔥", desc: "Belajar 3 hari berturut-turut",           check: s => (s.streak||0) >= 3 }
    ];

    // Update counters
    if (action === "quiz_correct")    student.quizCorrectCount = (student.quizCorrectCount || 0) + 1;
    if (action === "flashcard_viewed") student.flashcardsViewed = (student.flashcardsViewed || 0) + 1;
    if (action === "ai_interaction")   student.aiInteractions   = (student.aiInteractions   || 0) + 1;
    if (action === "perfect_quiz")     student.perfectQuizCount = (student.perfectQuizCount || 0) + 1;

    // Check new achievements
    if (!student.achievements) student.achievements = [];
    achievementDefs.forEach(a => {
        if (!student.achievements.includes(a.id) && a.check(student)) {
            student.achievements.push(a.id);
            newAchievements.push({ id: a.id, title: a.title, icon: a.icon, description: a.desc });
            // Bonus XP for achievement
            student.xp   += 50;
            student.coin += 25;
        }
    });

    students[idx] = student;
    writeStudents(courseId, students);

    return res.json({
        success: true,
        xpGained, coinGained,
        totalXp:   student.xp,
        totalCoin: student.coin,
        level:     student.level,
        leveledUp,
        newAchievements
    });
});

// GET /api/course/leaderboard/:courseId
router.get("/course/leaderboard/:courseId", (req, res) => {
    const { courseId } = req.params;
    const students = readStudents(courseId);

    const leaderboard = students
        .map(s => ({
            studentId:      s.studentId,
            username:       s.username,
            xp:             s.xp || 0,
            coin:           s.coin || 0,
            level:          s.level || 1,
            streak:         s.streak || 0,
            quizScore:      s.quizScore || 0,
            achievements:   (s.achievements || []).length,
            completedBlocks:(s.completedBlocks || []).length
        }))
        .sort((a, b) => b.xp - a.xp)
        .map((s, i) => ({ ...s, rank: i + 1 }));

    return res.json({ success: true, leaderboard });
});

// GET /api/course/analytics/:courseId — untuk pengajar
router.get("/course/analytics/:courseId", (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: "Belum login." });

    const { courseId } = req.params;
    const courses = readCourses();
    const course = courses.find(c => c.courseId === courseId);

    if (!course || course.courseOwner !== req.session.user.email)
        return res.status(403).json({ success: false, message: "Akses ditolak." });

    const students = readStudents(courseId);

    const totalStudents  = students.length;
    const avgXp          = totalStudents > 0 ? Math.round(students.reduce((a, s) => a + (s.xp || 0), 0) / totalStudents) : 0;
    const avgQuizScore   = totalStudents > 0 ? Math.round(students.reduce((a, s) => a + (s.quizScore || 0), 0) / totalStudents) : 0;
    const totalAiChats   = students.reduce((a, s) => a + (s.aiInteractions || 0), 0);
    const avgStreak      = totalStudents > 0 ? Math.round(students.reduce((a, s) => a + (s.streak || 0), 0) / totalStudents) : 0;

    const leaderboard = students
        .map(s => ({
            username:       s.username,
            email:          s.email,
            xp:             s.xp || 0,
            coin:           s.coin || 0,
            level:          s.level || 1,
            streak:         s.streak || 0,
            quizScore:      s.quizScore || 0,
            achievements:   (s.achievements || []).length,
            completedBlocks:(s.completedBlocks || []).length,
            joinedAt:       s.joinedAt
        }))
        .sort((a, b) => b.xp - a.xp);

    const mostActive = leaderboard[0] || null;

    return res.json({
        success: true,
        analytics: {
            totalStudents,
            avgXp,
            avgQuizScore,
            totalAiChats,
            avgStreak,
            mostActive,
            leaderboard
        }
    });
});

// ============================================================
// CHAT API
// ============================================================

// POST /api/course/chat
router.post("/course/chat", async (req, res) => {
    const { courseId, message } = req.body;
    if (!courseId || !message)
        return res.status(400).json({ success: false, message: "courseId dan message wajib diisi." });

    const promptPath = path.join(PROMPT_DIR, `${courseId}.md`);
    if (!fs.existsSync(promptPath))
        return res.status(404).json({ success: false, message: "Course tidak ditemukan." });

    const systemPrompt = fs.readFileSync(promptPath, "utf-8");

    // Track AI interaction for gamification (if student session exists)
    const sess = req.session.student;
    if (sess && sess.courseId === courseId) {
        const students = readStudents(courseId);
        const idx = students.findIndex(s => s.studentId === sess.studentId);
        if (idx !== -1) {
            students[idx].aiInteractions = (students[idx].aiInteractions || 0) + 1;
            // XP for AI interaction (max 10 per day)
            const today = new Date().toDateString();
            const todayAi = students[idx].todayAiCount || 0;
            if (students[idx].lastAiDate !== today) { students[idx].todayAiCount = 0; students[idx].lastAiDate = today; }
            if ((students[idx].todayAiCount || 0) < 10) {
                students[idx].xp   = (students[idx].xp   || 0) + 15;
                students[idx].coin = (students[idx].coin || 0) + 5;
                students[idx].todayAiCount = (students[idx].todayAiCount || 0) + 1;
                students[idx].level = calcLevel(students[idx].xp);
            }
            writeStudents(courseId, students);
        }
    }

    try {
        const aiResponse = await axios.post(
            "https://gen.pollinations.ai/v1/chat/completions",
            {
                model: "openai",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user",   content: message }
                ]
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${POLLINATIONS_API_KEY}`
                },
                timeout: 30000
            }
        );

        const reply = aiResponse.data.choices?.[0]?.message?.content || "Maaf, saya tidak bisa menjawab saat ini.";
        return res.json({ success: true, reply });

    } catch (err) {
        console.error("Course chat error:", err.message);
        return res.status(500).json({ success: false, message: "Gagal menghubungi AI Tutor." });
    }
});

// ============================================================
// PROGRESS API
// ============================================================

// POST /api/course/progress
router.post("/course/progress", (req, res) => {
    const sess = req.session.student;
    if (!sess) return res.status(401).json({ success: false, message: "Belum login sebagai siswa." });

    const { courseId, scrollProgress, flashcardsCompleted, quizCompleted, quizScore, lastBlock, blockId } = req.body;
    if (!courseId || sess.courseId !== courseId)
        return res.status(400).json({ success: false, message: "courseId tidak valid." });

    const existing = readProgress(courseId, sess.studentId) || {
        studentId: sess.studentId, courseId,
        scrollProgress: 0, flashcardsCompleted: 0,
        quizCompleted: false, quizScore: 0, lastBlock: 0, completedBlocks: []
    };

    const updated = {
        ...existing,
        ...(scrollProgress      !== undefined && { scrollProgress }),
        ...(flashcardsCompleted !== undefined && { flashcardsCompleted }),
        ...(quizCompleted       !== undefined && { quizCompleted }),
        ...(quizScore           !== undefined && { quizScore }),
        ...(lastBlock           !== undefined && { lastBlock }),
        lastAccess: nowStr()
    };

    if (blockId && !updated.completedBlocks.includes(blockId)) {
        updated.completedBlocks.push(blockId);
    }

    writeProgress(courseId, sess.studentId, updated);

    // Sync quizScore to student DB
    if (quizScore !== undefined) {
        const students = readStudents(courseId);
        const idx = students.findIndex(s => s.studentId === sess.studentId);
        if (idx !== -1 && quizScore > (students[idx].quizScore || 0)) {
            students[idx].quizScore = quizScore;
            writeStudents(courseId, students);
        }
    }

    return res.json({ success: true, progress: updated });
});

// GET /api/course/progress/:courseId
router.get("/course/progress/:courseId", (req, res) => {
    const sess = req.session.student;
    if (!sess) return res.status(401).json({ success: false, message: "Belum login sebagai siswa." });

    const { courseId } = req.params;
    if (sess.courseId !== courseId) return res.status(403).json({ success: false, message: "Akses ditolak." });

    const progress = readProgress(courseId, sess.studentId);
    return res.json({ success: true, progress: progress || null });
});

// GET /api/course/data/:courseId
router.get("/course/data/:courseId", (req, res) => {
    const { courseId } = req.params;
    const dataPath = path.join(COURSE_DATA_DIR, `${courseId}.json`);
    if (!fs.existsSync(dataPath))
        return res.status(404).json({ success: false, message: "Course data tidak ditemukan." });

    try {
        const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
        return res.json({ success: true, data });
    } catch {
        return res.status(500).json({ success: false, message: "Gagal membaca course data." });
    }
});

// ============================================================
// EXAM PAGE ROUTE
// ============================================================

// GET /course/:courseId/exam - Serve exam page
router.get("/course/:courseId/exam", (req, res) => {
    const { courseId } = req.params;
    
    // Check if course exists
    const courseDataPath = path.join(COURSE_DATA_DIR, `${courseId}.json`);
    if (!fs.existsSync(courseDataPath)) {
        return res.status(404).send("Course tidak ditemukan.");
    }
    
    // Check if student is logged in
    if (!req.session.student || req.session.student.courseId !== courseId) {
        return res.redirect(`/course/${courseId}/auth`);
    }
    
    // Load exam template
    const EXAM_TEMPLATE_PATH = path.join(ROOT, "course_template", "exam.html");
    if (!fs.existsSync(EXAM_TEMPLATE_PATH)) {
        return res.status(500).send("Template exam tidak ditemukan.");
    }
    
    let examHtml = fs.readFileSync(EXAM_TEMPLATE_PATH, "utf-8");
    
    // Inject course ID
    examHtml = examHtml.replace(
        "// <!-- COURSE_ID_INJECT -->",
        `const COURSE_ID = "${courseId}";`
    );
    
    res.send(examHtml);
});

module.exports = router;
