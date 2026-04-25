const STORAGE_KEY = "simpread_app_state";

const DEFAULT_API_CONFIG = {
    apiUrl: "https://api.deepseek.com/chat/completions",
    apiModel: "deepseek-chat",
    apiKey: "",
    temperature: 0.3
};

function getBuiltinModes() {
    return [
        {
            id: "explain",
            label: "Explain",
            prompt: "你是一个学术助手，请对内容进行详细解释。用 Markdown 排版。",
            builtin: true
        },
        {
            id: "solve",
            label: "Solve",
            prompt: "你是一个解答助手，请给出答案和推导过程。用 Markdown 排版。",
            builtin: true
        },
        {
            id: "translate",
            label: "Translate",
            prompt: "你是一个翻译专家，请将输入内容翻译成中文。只返回中文翻译结果。",
            builtin: true
        }
    ];
}

function uid(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createConversation(title = "New Chat") {
    const now = Date.now();
    return {
        id: uid("conv"),
        title,
        createdAt: now,
        updatedAt: now,
        messages: []
    };
}

function buildDefaultState() {
    const conv = createConversation();
    return {
        settings: {
            api: { ...DEFAULT_API_CONFIG },
            selectedModeId: "explain",
            modes: getBuiltinModes()
        },
        conversations: [conv],
        activeConversationId: conv.id
    };
}

let appState = buildDefaultState();
let currentAbortController = null;
let isRequestInFlight = false;

const handledSelectionIds = new Set();
let lastHandledText = "";
let lastHandledAt = 0;

const chatContainer = document.getElementById("chat-container");
const conversationSelect = document.getElementById("conversation-select");
const newConversationBtn = document.getElementById("new-conversation-btn");
const deleteConversationBtn = document.getElementById("delete-conversation-btn");
const modeSelector = document.getElementById("mode-selector");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const stopBtn = document.getElementById("stop-btn");

const settingsToggleBtn = document.getElementById("settings-toggle-btn");
const settingsPanel = document.getElementById("settings-panel");
const settingsStatus = document.getElementById("settings-status");

const apiUrlInput = document.getElementById("api-url");
const apiModelInput = document.getElementById("api-model");
const apiKeyInput = document.getElementById("api-key");
const temperatureInput = document.getElementById("temperature-input");
const saveApiBtn = document.getElementById("save-api-btn");

const modeList = document.getElementById("mode-list");
const newModeNameInput = document.getElementById("new-mode-name");
const newModePromptInput = document.getElementById("new-mode-prompt");
const addModeBtn = document.getElementById("add-mode-btn");

const exportDataBtn = document.getElementById("export-data-btn");
const clearDataBtn = document.getElementById("clear-data-btn");

function setSettingsStatus(text, isError = false) {
    settingsStatus.textContent = text;
    settingsStatus.style.color = isError ? "#ff95a3" : "#94a1b8";
}

function scheduleSaveState() {
    chrome.storage.local.set({ [STORAGE_KEY]: appState }).catch((error) => {
        console.error("保存本地状态失败:", error);
        setSettingsStatus("Save failed", true);
    });
}

function ensureStateIntegrity(state) {
    const next = state && typeof state === "object" ? state : buildDefaultState();

    if (!next.settings) next.settings = {};
    if (!next.settings.api) next.settings.api = { ...DEFAULT_API_CONFIG };
    next.settings.api = {
        apiUrl: (next.settings.api.apiUrl || DEFAULT_API_CONFIG.apiUrl).trim(),
        apiModel: (next.settings.api.apiModel || DEFAULT_API_CONFIG.apiModel).trim(),
        apiKey: (next.settings.api.apiKey || "").trim(),
        temperature: Number.isFinite(Number(next.settings.api.temperature))
            ? Number(next.settings.api.temperature)
            : DEFAULT_API_CONFIG.temperature
    };

    const builtins = getBuiltinModes();
    const existedModes = Array.isArray(next.settings.modes) ? next.settings.modes : [];
    const customModes = existedModes
        .filter((m) => m && !m.builtin)
        .map((m) => ({
            id: m.id || uid("mode"),
            label: m.label || "Custom",
            prompt: m.prompt || "",
            builtin: false
        }));

    next.settings.modes = [...builtins, ...customModes];
    if (!next.settings.selectedModeId) next.settings.selectedModeId = "explain";
    if (!next.settings.modes.some((m) => m.id === next.settings.selectedModeId)) {
        next.settings.selectedModeId = "explain";
    }

    if (!Array.isArray(next.conversations)) next.conversations = [];
    next.conversations = next.conversations
        .filter((c) => c && c.id)
        .map((c) => ({
            id: c.id,
            title: c.title || "Untitled",
            createdAt: c.createdAt || Date.now(),
            updatedAt: c.updatedAt || Date.now(),
            messages: Array.isArray(c.messages) ? c.messages : []
        }));

    if (next.conversations.length === 0) {
        next.conversations.push(createConversation());
    }

    if (!next.activeConversationId || !next.conversations.some((c) => c.id === next.activeConversationId)) {
        next.activeConversationId = next.conversations[0].id;
    }

    return next;
}

async function loadState() {
    try {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        appState = ensureStateIntegrity(data[STORAGE_KEY]);
    } catch (error) {
        console.error("加载本地状态失败:", error);
        appState = buildDefaultState();
        setSettingsStatus("Load failed, defaults restored", true);
    }
}

function getActiveConversation() {
    return appState.conversations.find((c) => c.id === appState.activeConversationId);
}

function renderConversationSelector() {
    conversationSelect.innerHTML = "";
    appState.conversations.forEach((conv) => {
        const option = document.createElement("option");
        option.value = conv.id;
        option.textContent = conv.title;
        conversationSelect.appendChild(option);
    });
    conversationSelect.value = appState.activeConversationId;
}

function renderModeSelector() {
    modeSelector.innerHTML = "";
    appState.settings.modes.forEach((mode) => {
        const option = document.createElement("option");
        option.value = mode.id;
        option.textContent = mode.label;
        modeSelector.appendChild(option);
    });
    modeSelector.value = appState.settings.selectedModeId;
}

function renderApiSettingsInputs() {
    apiUrlInput.value = appState.settings.api.apiUrl;
    apiModelInput.value = appState.settings.api.apiModel;
    apiKeyInput.value = appState.settings.api.apiKey;
    temperatureInput.value = String(appState.settings.api.temperature);
}

function renderModeList() {
    modeList.innerHTML = "";

    appState.settings.modes
        .filter((mode) => !mode.builtin)
        .forEach((mode) => {
            const item = document.createElement("div");
            item.className = "mode-item";

            const header = document.createElement("div");
            header.className = "mode-item-header";

            const nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.value = mode.label;
            nameInput.placeholder = "Mode name";

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "danger-btn";
            deleteBtn.textContent = "Delete";

            const promptInput = document.createElement("textarea");
            promptInput.value = mode.prompt;
            promptInput.placeholder = "System prompt";

            nameInput.addEventListener("input", () => {
                mode.label = nameInput.value.trim() || "Custom";
                renderModeSelector();
                scheduleSaveState();
                setSettingsStatus("Mode updated");
            });

            promptInput.addEventListener("input", () => {
                mode.prompt = promptInput.value;
                scheduleSaveState();
                setSettingsStatus("Mode updated");
            });

            deleteBtn.addEventListener("click", () => {
                appState.settings.modes = appState.settings.modes.filter((m) => m.id !== mode.id);
                if (appState.settings.selectedModeId === mode.id) {
                    appState.settings.selectedModeId = "explain";
                }
                renderModeSelector();
                renderModeList();
                scheduleSaveState();
                setSettingsStatus("Mode deleted");
            });

            header.appendChild(nameInput);
            header.appendChild(deleteBtn);
            item.appendChild(header);
            item.appendChild(promptInput);
            modeList.appendChild(item);
        });
}

function renderMessages() {
    const conv = getActiveConversation();
    chatContainer.innerHTML = "";

    conv.messages.forEach((msg) => {
        const row = document.createElement("div");
        row.className = `message-row ${msg.role}`;

        const bubble = document.createElement("div");
        bubble.className = "bubble";
        if (msg.role === "ai") {
            bubble.innerHTML = marked.parse(msg.content || "");
        } else {
            bubble.textContent = msg.content || "";
        }

        row.appendChild(bubble);
        chatContainer.appendChild(row);
    });

    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function updateRequestUiState() {
    sendBtn.disabled = isRequestInFlight;
    stopBtn.disabled = !isRequestInFlight;
    chatInput.disabled = isRequestInFlight;
}

function updateConversationTitleByFirstMessage(conv) {
    if (!conv || conv.messages.length === 0) return;
    if (conv.title && conv.title !== "New Chat") return;
    const firstUser = conv.messages.find((m) => m.role === "user");
    if (!firstUser) return;
    conv.title = firstUser.content.replace(/\s+/g, " ").slice(0, 24) || "New Chat";
}

function getCurrentMode() {
    return appState.settings.modes.find((m) => m.id === appState.settings.selectedModeId) || appState.settings.modes[0];
}

async function requestCompletion(userText) {
    const { api } = appState.settings;
    const mode = getCurrentMode();

    if (!api.apiKey) {
        throw new Error("Please set API Key in Settings.");
    }

    currentAbortController = new AbortController();

    const response = await fetch(api.apiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${api.apiKey}`
        },
        body: JSON.stringify({
            model: api.apiModel,
            messages: [
                { role: "system", content: mode.prompt },
                ...getActiveConversation().messages.map((m) => ({
                    role: m.role === "ai" ? "assistant" : "user",
                    content: m.content
                }))
            ],
            temperature: api.temperature
        }),
        signal: currentAbortController.signal
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || "";
}

async function submitUserMessage(text) {
    const content = (text || "").trim();
    if (!content) return;

    if (isRequestInFlight) {
        setSettingsStatus("A request is running. Stop it first.", true);
        return;
    }

    const conv = getActiveConversation();
    conv.messages.push({ role: "user", content, ts: Date.now() });
    conv.updatedAt = Date.now();

    updateConversationTitleByFirstMessage(conv);
    renderConversationSelector();
    renderMessages();
    scheduleSaveState();

    isRequestInFlight = true;
    updateRequestUiState();

    try {
        const aiText = await requestCompletion(content);
        conv.messages.push({ role: "ai", content: aiText, ts: Date.now() });
        conv.updatedAt = Date.now();
        renderMessages();
        scheduleSaveState();
    } catch (error) {
        if (error?.name === "AbortError") {
            conv.messages.push({ role: "ai", content: "Request aborted.", ts: Date.now() });
        } else {
            conv.messages.push({ role: "ai", content: `Error: ${error.message}`, ts: Date.now() });
        }
        conv.updatedAt = Date.now();
        renderMessages();
        scheduleSaveState();
    } finally {
        isRequestInFlight = false;
        currentAbortController = null;
        updateRequestUiState();
        chatInput.value = "";
        chatInput.focus();
    }
}

function stopCurrentRequest() {
    if (currentAbortController) {
        currentAbortController.abort();
    }
}

function normalizeSelectionPayload(raw) {
    if (!raw) return null;
    if (typeof raw === "string") {
        const text = raw.trim();
        return text ? { id: "", text, ts: 0 } : null;
    }

    const text = (raw.text || "").trim();
    if (!text) return null;

    return {
        id: raw.id || "",
        text,
        ts: raw.ts || 0
    };
}

function isDuplicateSelection(payload) {
    if (!payload) return true;

    if (payload.id && handledSelectionIds.has(payload.id)) {
        return true;
    }

    if (payload.text === lastHandledText && Date.now() - lastHandledAt < 2500) {
        return true;
    }

    return false;
}

function markSelectionHandled(payload) {
    if (payload.id) {
        handledSelectionIds.add(payload.id);
        if (handledSelectionIds.size > 200) handledSelectionIds.clear();
    }
    lastHandledText = payload.text;
    lastHandledAt = Date.now();
}

function processSelectedTextPayload(rawPayload) {
    const payload = normalizeSelectionPayload(rawPayload);
    if (!payload) return;
    if (isDuplicateSelection(payload)) return;

    markSelectionHandled(payload);
    submitUserMessage(`【划词内容】\n${payload.text}`);
}

async function consumePendingSelectedText() {
    try {
        const result = await chrome.storage.session.get("pendingSelectedText");
        const pendingPayload = normalizeSelectionPayload(result.pendingSelectedText);
        await chrome.storage.session.remove("pendingSelectedText");
        if (!pendingPayload) return;

        processSelectedTextPayload(pendingPayload);
    } catch (error) {
        console.error("读取待处理划词失败:", error);
    }
}

function bindEvents() {
    settingsToggleBtn.addEventListener("click", () => {
        settingsPanel.classList.toggle("hidden");
        settingsToggleBtn.textContent = settingsPanel.classList.contains("hidden") ? "Settings" : "Close";
    });

    conversationSelect.addEventListener("change", () => {
        appState.activeConversationId = conversationSelect.value;
        renderMessages();
        scheduleSaveState();
    });

    newConversationBtn.addEventListener("click", () => {
        const conv = createConversation();
        appState.conversations.unshift(conv);
        appState.activeConversationId = conv.id;
        renderConversationSelector();
        renderMessages();
        scheduleSaveState();
    });

    deleteConversationBtn.addEventListener("click", () => {
        if (appState.conversations.length <= 1) {
            setSettingsStatus("At least one conversation is required.", true);
            return;
        }

        const ok = confirm("Delete current conversation?");
        if (!ok) return;

        appState.conversations = appState.conversations.filter((c) => c.id !== appState.activeConversationId);
        appState.activeConversationId = appState.conversations[0].id;
        renderConversationSelector();
        renderMessages();
        scheduleSaveState();
    });

    modeSelector.addEventListener("change", () => {
        appState.settings.selectedModeId = modeSelector.value;
        scheduleSaveState();
    });

    sendBtn.addEventListener("click", () => submitUserMessage(chatInput.value));

    stopBtn.addEventListener("click", stopCurrentRequest);

    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitUserMessage(chatInput.value);
        }
    });

    saveApiBtn.addEventListener("click", () => {
        const temp = Number(temperatureInput.value);
        if (!Number.isFinite(temp) || temp < 0 || temp > 2) {
            setSettingsStatus("Temperature should be 0-2", true);
            return;
        }

        appState.settings.api = {
            apiUrl: apiUrlInput.value.trim(),
            apiModel: apiModelInput.value.trim(),
            apiKey: apiKeyInput.value.trim(),
            temperature: temp
        };

        if (!appState.settings.api.apiUrl || !appState.settings.api.apiModel) {
            setSettingsStatus("API URL and Model are required", true);
            return;
        }

        scheduleSaveState();
        setSettingsStatus("API settings saved");
    });

    addModeBtn.addEventListener("click", () => {
        const label = newModeNameInput.value.trim();
        const prompt = newModePromptInput.value.trim();

        if (!label || !prompt) {
            setSettingsStatus("Mode name and prompt are required", true);
            return;
        }

        const mode = {
            id: uid("mode"),
            label,
            prompt,
            builtin: false
        };

        appState.settings.modes.push(mode);
        appState.settings.selectedModeId = mode.id;

        newModeNameInput.value = "";
        newModePromptInput.value = "";

        renderModeSelector();
        renderModeList();
        scheduleSaveState();
        setSettingsStatus("Mode created");
    });

    exportDataBtn.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(appState, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `simpread-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setSettingsStatus("Data exported");
    });

    clearDataBtn.addEventListener("click", () => {
        const ok = confirm("Clear all local data?");
        if (!ok) return;

        appState = buildDefaultState();
        renderAll();
        scheduleSaveState();
        setSettingsStatus("All local data cleared");
    });

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "TEXT_SELECTED" || message.type === "TEXT_SELECTED_FOR_PANEL") {
            chrome.storage.session.remove("pendingSelectedText").catch(() => {});
            processSelectedTextPayload(message.payload || message.text);
        }
    });
}

function renderAll() {
    renderConversationSelector();
    renderModeSelector();
    renderApiSettingsInputs();
    renderModeList();
    renderMessages();
    updateRequestUiState();
}

async function bootstrap() {
    await loadState();
    renderAll();
    bindEvents();
    consumePendingSelectedText();
}

bootstrap();
