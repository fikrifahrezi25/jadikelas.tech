// JadiKelas Chatbot Widget
(function () {
  // Generate or retrieve sessionId
  let sessionId = localStorage.getItem("jk_session_id");
  if (!sessionId) {
    sessionId = "session_" + Math.random().toString(36).substr(2, 12) + Date.now();
    localStorage.setItem("jk_session_id", sessionId);
  }

  // Inject styles
  const style = document.createElement("style");
  style.textContent = `
    #jk-chatbot-wrapper * { box-sizing: border-box; font-family: 'Plus Jakarta Sans', sans-serif; }

    /* Floating button */
    #jk-chat-btn {
      position: fixed; bottom: 28px; right: 28px; z-index: 9999;
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, #4F46E5, #9333EA);
      box-shadow: 0 8px 32px rgba(79,70,229,0.45);
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #jk-chat-btn:hover { transform: scale(1.1); box-shadow: 0 12px 40px rgba(79,70,229,0.55); }
    #jk-chat-btn svg { width: 28px; height: 28px; fill: white; }

    /* Popup tooltip */
    #jk-chat-tooltip {
      position: fixed; bottom: 100px; right: 28px; z-index: 9998;
      background: white; color: #0F172A;
      padding: 10px 16px; border-radius: 16px 16px 4px 16px;
      font-size: 13px; font-weight: 600;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
      border: 1px solid #e2e8f0;
      animation: jk-fadein 0.4s ease;
      white-space: nowrap;
    }
    #jk-chat-tooltip::after {
      content: ''; position: absolute; bottom: -8px; right: 18px;
      border-left: 8px solid transparent; border-right: 8px solid transparent;
      border-top: 8px solid white;
    }

    /* Chat panel */
    #jk-chat-panel {
      position: fixed; bottom: 100px; right: 28px; z-index: 9999;
      width: 360px; max-width: calc(100vw - 32px);
      height: 520px; max-height: calc(100vh - 120px);
      background: white; border-radius: 24px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.18);
      border: 1px solid #e2e8f0;
      display: flex; flex-direction: column; overflow: hidden;
      animation: jk-slideup 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    #jk-chat-panel.jk-hidden {
      animation: jk-slidedown 0.25s ease forwards;
      pointer-events: none;
    }

    /* Header */
    #jk-chat-header {
      background: linear-gradient(135deg, #4F46E5, #9333EA);
      padding: 16px 20px; display: flex; align-items: center; gap: 12px;
      flex-shrink: 0;
    }
    #jk-chat-header .jk-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; flex-shrink: 0;
    }
    #jk-chat-header .jk-info { flex: 1; }
    #jk-chat-header .jk-name { color: white; font-weight: 700; font-size: 15px; }
    #jk-chat-header .jk-status {
      color: rgba(255,255,255,0.8); font-size: 12px;
      display: flex; align-items: center; gap: 5px;
    }
    #jk-chat-header .jk-dot {
      width: 7px; height: 7px; border-radius: 50%; background: #4ade80;
      animation: jk-pulse 2s infinite;
    }
    #jk-close-btn {
      background: rgba(255,255,255,0.2); border: none; cursor: pointer;
      width: 32px; height: 32px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 18px; transition: background 0.2s;
    }
    #jk-close-btn:hover { background: rgba(255,255,255,0.35); }

    /* Messages area */
    #jk-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
      scroll-behavior: smooth;
    }
    #jk-messages::-webkit-scrollbar { width: 4px; }
    #jk-messages::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }

    /* Bubble */
    .jk-bubble-wrap { display: flex; align-items: flex-end; gap: 8px; }
    .jk-bubble-wrap.jk-user { flex-direction: row-reverse; }
    .jk-bubble-avatar {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px;
    }
    .jk-bubble-avatar.jk-ai-av { background: linear-gradient(135deg, #4F46E5, #9333EA); color: white; }
    .jk-bubble-avatar.jk-user-av { background: #e2e8f0; color: #64748b; }
    .jk-bubble {
      max-width: 78%; padding: 10px 14px; border-radius: 18px;
      font-size: 13.5px; line-height: 1.55; word-break: break-word;
    }
    .jk-bubble.jk-ai {
      background: #f1f5f9; color: #1e293b;
      border-bottom-left-radius: 4px;
    }
    .jk-bubble.jk-user {
      background: linear-gradient(135deg, #4F46E5, #9333EA);
      color: white; border-bottom-right-radius: 4px;
    }

    /* Typing indicator */
    .jk-typing { display: flex; align-items: center; gap: 5px; padding: 10px 14px; }
    .jk-typing span {
      width: 7px; height: 7px; border-radius: 50%; background: #94a3b8;
      animation: jk-bounce 1.2s infinite;
    }
    .jk-typing span:nth-child(2) { animation-delay: 0.2s; }
    .jk-typing span:nth-child(3) { animation-delay: 0.4s; }

    /* Quick replies */
    #jk-quick-replies {
      padding: 0 16px 12px; display: flex; gap: 8px; flex-wrap: wrap; flex-shrink: 0;
    }
    .jk-quick-btn {
      padding: 7px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;
      border: 1.5px solid #4F46E5; color: #4F46E5; background: white;
      cursor: pointer; transition: all 0.2s; white-space: nowrap;
    }
    .jk-quick-btn:hover { background: #4F46E5; color: white; }

    /* Input area */
    #jk-input-area {
      padding: 12px 16px; border-top: 1px solid #f1f5f9;
      display: flex; gap: 10px; align-items: center; flex-shrink: 0;
    }
    #jk-input {
      flex: 1; border: 1.5px solid #e2e8f0; border-radius: 20px;
      padding: 10px 16px; font-size: 13.5px; outline: none;
      transition: border-color 0.2s; resize: none; max-height: 80px;
      font-family: inherit; line-height: 1.4;
    }
    #jk-input:focus { border-color: #4F46E5; }
    #jk-send-btn {
      width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, #4F46E5, #9333EA);
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, opacity 0.2s;
    }
    #jk-send-btn:hover { transform: scale(1.08); }
    #jk-send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    #jk-send-btn svg { width: 18px; height: 18px; fill: white; }

    /* Animations */
    @keyframes jk-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes jk-slideup { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes jk-slidedown { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(30px) scale(0.95); } }
    @keyframes jk-bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
    @keyframes jk-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    @media (max-width: 480px) {
      #jk-chat-panel { bottom: 90px; right: 12px; left: 12px; width: auto; }
      #jk-chat-btn { bottom: 20px; right: 20px; }
      #jk-chat-tooltip { right: 20px; bottom: 90px; }
    }
  `;
  document.head.appendChild(style);

  // Inject HTML
  const wrapper = document.createElement("div");
  wrapper.id = "jk-chatbot-wrapper";
  wrapper.innerHTML = `
    <div id="jk-chat-tooltip">Ada yang bisa saya bantu? 😊</div>

    <div id="jk-chat-panel" style="display:none;">
      <div id="jk-chat-header">
        <div class="jk-avatar">🤖</div>
        <div class="jk-info">
          <div class="jk-name">JadiKelas AI</div>
          <div class="jk-status"><span class="jk-dot"></span> Online</div>
        </div>
        <button id="jk-close-btn" aria-label="Tutup chatbot">✕</button>
      </div>

      <div id="jk-messages"></div>

      <div id="jk-quick-replies">
        <button class="jk-quick-btn" data-msg="Harga paket">💰 Harga paket</button>
        <button class="jk-quick-btn" data-msg="Cara pakai JadiKelas">📖 Cara pakai</button>
        <button class="jk-quick-btn" data-msg="Apa saja fitur JadiKelas?">✨ Fitur</button>
      </div>

      <div id="jk-input-area">
        <textarea id="jk-input" rows="1" placeholder="Ketik pesan..." aria-label="Pesan chatbot"></textarea>
        <button id="jk-send-btn" aria-label="Kirim pesan">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>

    <button id="jk-chat-btn" aria-label="Buka chatbot">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
      </svg>
    </button>
  `;
  document.body.appendChild(wrapper);

  // Elements
  const chatBtn = document.getElementById("jk-chat-btn");
  const chatPanel = document.getElementById("jk-chat-panel");
  const closeBtn = document.getElementById("jk-close-btn");
  const tooltip = document.getElementById("jk-chat-tooltip");
  const messagesEl = document.getElementById("jk-messages");
  const inputEl = document.getElementById("jk-input");
  const sendBtn = document.getElementById("jk-send-btn");
  const quickBtns = document.querySelectorAll(".jk-quick-btn");

  let isOpen = false;
  let tooltipHidden = false;

  // Hide tooltip after 5s
  setTimeout(() => {
    if (!tooltipHidden) {
      tooltip.style.opacity = "0";
      tooltip.style.transition = "opacity 0.4s";
      setTimeout(() => { tooltip.style.display = "none"; }, 400);
      tooltipHidden = true;
    }
  }, 5000);

  function openChat() {
    isOpen = true;
    tooltip.style.display = "none";
    tooltipHidden = true;
    chatPanel.style.display = "flex";
    chatPanel.classList.remove("jk-hidden");
    // Show welcome message if first time
    if (messagesEl.children.length === 0) {
      appendMessage("ai", "Halo! Ada yang bisa saya bantu tentang JadiKelas? 😊");
    }
    inputEl.focus();
  }

  function closeChat() {
    isOpen = false;
    chatPanel.classList.add("jk-hidden");
    setTimeout(() => { chatPanel.style.display = "none"; }, 250);
  }

  chatBtn.addEventListener("click", () => isOpen ? closeChat() : openChat());
  closeBtn.addEventListener("click", closeChat);

  // Quick reply buttons
  quickBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const msg = btn.getAttribute("data-msg");
      sendMessage(msg);
    });
  });

  // Send on Enter (Shift+Enter = newline)
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputEl.value.trim());
    }
  });

  // Auto-resize textarea
  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + "px";
  });

  sendBtn.addEventListener("click", () => sendMessage(inputEl.value.trim()));

  function appendMessage(role, text) {
    const wrap = document.createElement("div");
    wrap.className = "jk-bubble-wrap" + (role === "user" ? " jk-user" : "");

    const avatar = document.createElement("div");
    avatar.className = "jk-bubble-avatar " + (role === "user" ? "jk-user-av" : "jk-ai-av");
    avatar.textContent = role === "user" ? "👤" : "🤖";

    const bubble = document.createElement("div");
    bubble.className = "jk-bubble " + (role === "user" ? "jk-user" : "jk-ai");
    //bubble.textContent = text;
    bubble.innerHTML = formatAIResponse(text);

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    scrollToBottom();
    return bubble;
  }

  function showTyping() {
    const wrap = document.createElement("div");
    wrap.className = "jk-bubble-wrap";
    wrap.id = "jk-typing-indicator";

    const avatar = document.createElement("div");
    avatar.className = "jk-bubble-avatar jk-ai-av";
    avatar.textContent = "🤖";

    const bubble = document.createElement("div");
    bubble.className = "jk-bubble jk-ai jk-typing";
    bubble.innerHTML = "<span></span><span></span><span></span>";

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    scrollToBottom();
  }

  function formatAIResponse(text) {
  if (!text) return "";

  // Escape HTML dulu (biar aman)
  text = text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold (**text**)
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Convert numbering (1. ... jadi list)
  text = text.replace(/^\d+\.\s(.+)$/gm, "<li>$1</li>");

  // Bungkus <li> jadi <ul>
  if (text.includes("<li>")) {
    text = "<ul>" + text + "</ul>";
  }

  // Line break
  text = text.replace(/\n/g, "<br>");

  return text;
}

  function removeTyping() {
    const el = document.getElementById("jk-typing-indicator");
    if (el) el.remove();
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessage(text) {
    if (!text) return;
    inputEl.value = "";
    inputEl.style.height = "auto";
    sendBtn.disabled = true;

    appendMessage("user", text);
    showTyping();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text })
      });
      const data = await res.json();
      removeTyping();
      appendMessage("ai", data.reply || data.error || "Maaf, terjadi kesalahan 😊");
    } catch (err) {
      removeTyping();
      appendMessage("ai", "Koneksi bermasalah. Coba lagi ya 😊");
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }
})();
