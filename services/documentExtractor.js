// ============================================================
// documentExtractor.js — JadiKelas v2.1 Multi Format Document Extraction
// Mendukung: PDF, DOCX, PPTX
// ============================================================

const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const JSZip = require("jszip");

/**
 * Extract text dari PDF menggunakan pdfjs-dist
 * @param {string} filePath - Path ke file PDF
 * @returns {Promise<string>} - Extracted text
 */
async function extractPdf(filePath) {
    try {
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const data = new Uint8Array(fs.readFileSync(filePath));
        const doc = await pdfjsLib.getDocument({ data }).promise;
        let text = "";
        
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(" ") + "\n";
        }
        
        return text;
    } catch (error) {
        console.error("PDF extraction error:", error.message);
        throw new Error("Gagal membaca file PDF. Pastikan file tidak terenkripsi atau corrupt.");
    }
}

/**
 * Extract text dari DOCX menggunakan mammoth
 * @param {string} filePath - Path ke file DOCX
 * @returns {Promise<string>} - Extracted text
 */
async function extractDocx(filePath) {
    try {
        const result = await mammoth.extractRawText({ path: filePath });
        
        if (!result.value || result.value.trim().length === 0) {
            throw new Error("Dokumen DOCX kosong atau tidak dapat dibaca.");
        }
        
        // Log messages if any (warnings, etc.)
        if (result.messages && result.messages.length > 0) {
            console.log("DOCX extraction messages:", result.messages);
        }
        
        return result.value;
    } catch (error) {
        console.error("DOCX extraction error:", error.message);
        throw new Error("Gagal membaca file DOCX. Pastikan file tidak terenkripsi atau corrupt.");
    }
}

/**
 * Extract text dari PPTX dengan membaca XML dari dalam ZIP
 * @param {string} filePath - Path ke file PPTX
 * @returns {Promise<string>} - Extracted text
 */
async function extractPptx(filePath) {
    try {
        const data = fs.readFileSync(filePath);
        const zip = await JSZip.loadAsync(data);
        
        let extractedText = "";
        let slideNumber = 0;
        
        // PPTX structure: ppt/slides/slide1.xml, slide2.xml, etc.
        const slideFiles = Object.keys(zip.files)
            .filter(fileName => fileName.match(/ppt\/slides\/slide\d+\.xml$/))
            .sort((a, b) => {
                const numA = parseInt(a.match(/slide(\d+)\.xml$/)[1]);
                const numB = parseInt(b.match(/slide(\d+)\.xml$/)[1]);
                return numA - numB;
            });
        
        if (slideFiles.length === 0) {
            throw new Error("Tidak ditemukan slide dalam file PPTX.");
        }
        
        // Extract text from each slide
        for (const slideFile of slideFiles) {
            slideNumber++;
            const slideXml = await zip.file(slideFile).async("string");
            
            // Extract text from <a:t> tags (text content in PPTX)
            const textMatches = slideXml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);
            
            if (textMatches && textMatches.length > 0) {
                extractedText += `\n\n=== Slide ${slideNumber} ===\n`;
                
                textMatches.forEach(match => {
                    const text = match.replace(/<a:t[^>]*>/, "").replace(/<\/a:t>/, "");
                    if (text.trim()) {
                        extractedText += text.trim() + " ";
                    }
                });
            }
        }
        
        if (!extractedText || extractedText.trim().length === 0) {
            throw new Error("Tidak ditemukan teks pada slide PPTX.");
        }
        
        return extractedText.trim();
    } catch (error) {
        console.error("PPTX extraction error:", error.message);
        
        if (error.message.includes("Tidak ditemukan")) {
            throw error;
        }
        
        throw new Error("Gagal membaca file PPTX. Pastikan file tidak terenkripsi atau corrupt.");
    }
}

/**
 * Unified document extraction function
 * Automatically detects file type and extracts text
 * 
 * @param {string} filePath - Path ke file dokumen
 * @param {string} fileType - Type file: 'pdf', 'docx', atau 'pptx'
 * @returns {Promise<{text: string}>} - Object berisi extracted text
 */
async function extractDocument(filePath, fileType) {
    if (!fs.existsSync(filePath)) {
        throw new Error("File tidak ditemukan.");
    }
    
    let text = "";
    
    switch (fileType.toLowerCase()) {
        case "pdf":
            text = await extractPdf(filePath);
            break;
            
        case "docx":
            text = await extractDocx(filePath);
            break;
            
        case "pptx":
            text = await extractPptx(filePath);
            break;
            
        default:
            throw new Error(`File type '${fileType}' tidak didukung. Gunakan: pdf, docx, atau pptx.`);
    }
    
    // Validate extracted text
    if (!text || text.trim().length < 50) {
        throw new Error("Tidak ditemukan teks yang cukup pada dokumen. Minimal 50 karakter diperlukan.");
    }
    
    return { text: text.trim() };
}

/**
 * Get file type from mimetype
 * @param {string} mimetype - MIME type dari multer
 * @returns {string} - File type: 'pdf', 'docx', atau 'pptx'
 */
function getFileTypeFromMimetype(mimetype) {
    const mimeMap = {
        "application/pdf": "pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx"
    };
    
    return mimeMap[mimetype] || null;
}

/**
 * Get icon emoji based on file type
 * @param {string} fileType - 'pdf', 'docx', atau 'pptx'
 * @returns {string} - Emoji icon
 */
function getFileIcon(fileType) {
    const iconMap = {
        "pdf": "📕",
        "docx": "📘",
        "pptx": "📙"
    };
    
    return iconMap[fileType] || "📄";
}

module.exports = {
    extractDocument,
    extractPdf,
    extractDocx,
    extractPptx,
    getFileTypeFromMimetype,
    getFileIcon
};
