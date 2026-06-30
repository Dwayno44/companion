// A quiet place to talk — front-end logic.
// Plain JavaScript, no frameworks. Conversations are stored only in this
// browser (localStorage) and are never sent anywhere except to fetch a reply.

(() => {
  "use strict";

  const STORAGE_KEY = "companion.history.v1";
  const WELCOME_SEEN_KEY = "companion.welcomed.v1";

  // Elements
  const welcomeEl = document.getElementById("welcome");
  const chatEl = document.getElementById("chat");
  const messagesEl = document.getElementById("messages");
  const formEl = document.getElementById("composer");
  const inputEl = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");
  const beginBtn = document.getElementById("beginBtn");
  const newChatBtn = document.getElementById("newChatBtn");

  // Conversation state: [{ role: "user" | "assistant", content: "..." }]
  let history = loadHistory();

  // ── Boot ──────────────────────────────────────────────────────────────
  const hasWelcomed = localStorage.getItem(WELCOME_SEEN_KEY) === "yes";
  if (hasWelcomed || history.length > 0) {
    showChat();
  } else {
    showWelcome();
  }

  function showWelcome() {
    welcomeEl.hidden = false;
    chatEl.hidden = true;
  }

  function showChat() {
    welcomeEl.hidden = true;
    chatEl.hidden = false;
    renderAll();
    inputEl.focus();
  }

  beginBtn.addEventListener("click", () => {
    localStorage.setItem(WELCOME_SEEN_KEY, "yes");
    showChat();
  });

  newChatBtn.addEventListener("click", () => {
    if (history.length === 0) return;
    const ok = confirm("Start a fresh conversation? This will clear what's on the screen.");
    if (!ok) return;
    history = [];
    saveHistory();
    renderAll();
    inputEl.focus();
  });

  // ── Composer behaviour ────────────────────────────────────────────────
  // Auto-grow the textarea; Enter sends, Shift+Enter makes a new line.
  inputEl.addEventListener("input", autoGrow);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formEl.requestSubmit();
    }
  });

  function autoGrow() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
  }

  formEl.addEventListener("submit", onSubmit);

  async function onSubmit(e) {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text) return;

    // Show her message
    addMessage("user", text);
    inputEl.value = "";
    autoGrow();
    setBusy(true);

    // Placeholder bubble for the reply
    const replyEl = addTypingBubble();

    try {
      const reply = await getReply(history, (partial) => {
        replyEl.classList.remove("typing");
        replyEl.textContent = partial;
        scrollToBottom();
      });
      replyEl.classList.remove("typing");
      replyEl.textContent = reply;
      history.push({ role: "assistant", content: reply });
      saveHistory();
    } catch (err) {
      replyEl.classList.remove("typing");
      replyEl.textContent =
        "I'm so sorry — I couldn't reach you just then. Please give it another try in a moment.";
      console.error(err);
    } finally {
      setBusy(false);
      scrollToBottom();
      inputEl.focus();
    }
  }

  function setBusy(busy) {
    sendBtn.disabled = busy;
    inputEl.disabled = busy;
  }

  // ── Rendering ─────────────────────────────────────────────────────────
  function addMessage(role, content) {
    history.push({ role, content });
    saveHistory();
    renderBubble(role, content);
    scrollToBottom();
  }

  function renderBubble(role, content) {
    const div = document.createElement("div");
    div.className = "bubble " + (role === "user" ? "her" : "its");
    div.textContent = content;
    messagesEl.appendChild(div);
    return div;
  }

  function addTypingBubble() {
    const div = document.createElement("div");
    div.className = "bubble its typing";
    div.textContent = "…";
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  function renderAll() {
    messagesEl.innerHTML = "";
    if (history.length === 0) {
      renderBubble(
        "assistant",
        "I'm right here. There's no rush — tell me how you're doing, or just say hello."
      );
      return;
    }
    for (const m of history) renderBubble(m.role, m.content);
    scrollToBottom();
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── Storage ───────────────────────────────────────────────────────────
  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      /* storage full or blocked — conversation simply won't persist */
    }
  }

  // ── Getting a reply ───────────────────────────────────────────────────
  // Calls the Cloudflare Worker, which talks to Claude and streams the reply
  // back. If the Worker URL hasn't been set yet, falls back to demo mode.
  async function getReply(messages, onPartial) {
    const configured =
      typeof WORKER_URL === "string" &&
      WORKER_URL &&
      !WORKER_URL.includes("PASTE_YOUR_WORKER_URL");

    if (!configured) {
      return demoReply(messages, onPartial);
    }

    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!res.ok || !res.body) {
      throw new Error("Worker responded " + res.status);
    }

    // Read the streamed Server-Sent Events from Claude and pull out text deltas.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep the last partial line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (
            evt.type === "content_block_delta" &&
            evt.delta &&
            evt.delta.type === "text_delta"
          ) {
            full += evt.delta.text;
            onPartial(full);
          }
        } catch {
          /* ignore keep-alive or non-JSON lines */
        }
      }
    }
    return full.trim();
  }

  // ── Demo mode (no backend yet) ────────────────────────────────────────
  function demoReply(messages, onPartial) {
    const last = messages[messages.length - 1]?.content || "";
    const text =
      "Thank you for telling me that. " +
      "(This is a preview — once the connection is set up, I'll really be able " +
      "to talk with you about \"" +
      last.slice(0, 60) +
      (last.length > 60 ? "…" : "") +
      "\".) I'm glad you're here.";
    return typeOut(text, onPartial);
  }

  function typeOut(text, onPartial) {
    return new Promise((resolve) => {
      let i = 0;
      const step = () => {
        i += 2;
        onPartial(text.slice(0, i));
        if (i < text.length) setTimeout(step, 18);
        else resolve(text);
      };
      step();
    });
  }
})();
