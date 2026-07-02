// ============================================================
// fix-generated-courses.js — Fix All Generated Courses
// Re-generate HTML files using the fixed template
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const COURSE_DATA_DIR = path.join(ROOT, 'course-data');
const GENERATED_DIR = path.join(ROOT, 'generated-course');
const TEMPLATE_PATH = path.join(ROOT, 'course_template', 'index.html');

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function fixCourse(courseId) {
    const courseDataPath = path.join(COURSE_DATA_DIR, `${courseId}.json`);
    const generatedPath = path.join(GENERATED_DIR, `${courseId}.html`);
    
    if (!fs.existsSync(courseDataPath)) {
        console.log(`⚠️  Course data not found: ${courseId}`);
        return false;
    }
    
    // Read course data
    const aiData = JSON.parse(fs.readFileSync(courseDataPath, 'utf-8'));
    
    // Read template
    let templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
    
    // Inject data
    const courseJson = JSON.stringify(aiData);
    templateHtml = templateHtml
        .replace(/\{\{courseTitle\}\}/g, escapeHtml(aiData.title))
        .replace(/\{\{courseEmoji\}\}/g, aiData.emoji || "📚")
        .replace(/\{\{courseColor\}\}/g, aiData.color || "#6366f1")
        .replace("<!-- COURSE_DATA_INJECT -->",
            `<script>const COURSE_ID = "${courseId}"; const COURSE_DATA = ${courseJson};</script>`);
    
    // Write generated HTML
    fs.writeFileSync(generatedPath, templateHtml);
    
    console.log(`✅ Fixed: ${aiData.title}`);
    return true;
}

// Main
console.log('🔧 Fixing all generated courses...\n');

const courseFiles = fs.readdirSync(COURSE_DATA_DIR).filter(f => f.endsWith('.json'));
let fixed = 0;
let failed = 0;

courseFiles.forEach(file => {
    const courseId = file.replace('.json', '');
    if (fixCourse(courseId)) {
        fixed++;
    } else {
        failed++;
    }
});

console.log(`\n✅ Fixed: ${fixed} courses`);
if (failed > 0) {
    console.log(`⚠️  Failed: ${failed} courses`);
}
console.log('\n🎉 Done! Refresh halaman course untuk melihat perubahan.');
