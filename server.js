const { ifError } = require("assert");
const express = require("express");
const app = express();
const PORT = 5526;
const TARGET_BASE = `/public/index.html`;

app.get("/", (req, res) => {
    const targetUrl = `${TARGET_BASE}`;
    return res.redirect(302, targetUrl);
});

app.get("/public/index.html", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:5526`);
});
