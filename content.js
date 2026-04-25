// 内容脚本防重入：避免热更新或重复注入导致多个监听器并存。
if (!window.__DEEPSEEK_SELECTION_BUTTON_BOUND__) {
    window.__DEEPSEEK_SELECTION_BUTTON_BOUND__ = true;

    console.log("%c🚀 插件已成功注入网页！", "background: #222; color: #bada55; font-size: 20px;");

    let selectedTextForAction = "";
    let showButtonTimer = null;

    const actionBtn = document.createElement("button");
    actionBtn.type = "button";
    actionBtn.textContent = "AI";
    actionBtn.setAttribute("aria-label", "发送划词到 AI");
    actionBtn.style.position = "absolute";
    actionBtn.style.zIndex = "2147483647";
    actionBtn.style.display = "none";
    actionBtn.style.border = "none";
    actionBtn.style.borderRadius = "999px";
    actionBtn.style.padding = "6px 10px";
    actionBtn.style.fontSize = "12px";
    actionBtn.style.fontWeight = "600";
    actionBtn.style.cursor = "pointer";
    actionBtn.style.color = "#fff";
    actionBtn.style.background = "#0078d4";
    actionBtn.style.boxShadow = "0 4px 10px rgba(0,0,0,0.22)";
    actionBtn.style.userSelect = "none";
    document.documentElement.appendChild(actionBtn);

    function isEditableElement(el) {
        if (!el) return false;
        const tagName = el.tagName?.toLowerCase();
        return (
            el.isContentEditable ||
            tagName === "input" ||
            tagName === "textarea" ||
            tagName === "select"
        );
    }

    function getSelectedText() {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return "";
        return sel.toString().trim();
    }

    function hideActionButton() {
        actionBtn.style.display = "none";
    }

    function showActionButtonNearSelection() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            hideActionButton();
            return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) {
            hideActionButton();
            return;
        }

        const top = rect.bottom + window.scrollY + 8;
        const left = rect.right + window.scrollX + 8;

        actionBtn.style.top = `${Math.max(0, top)}px`;
        actionBtn.style.left = `${Math.max(0, left)}px`;
        actionBtn.style.display = "block";
    }

    function scheduleShowButton(delayMs = 80) {
        if (showButtonTimer) {
            clearTimeout(showButtonTimer);
        }
        showButtonTimer = setTimeout(showActionButtonNearSelection, delayMs);
    }

    function updateSelectionActionState(eventTarget) {
        if (isEditableElement(eventTarget) || isEditableElement(document.activeElement)) {
            hideActionButton();
            return;
        }

        const text = getSelectedText();
        if (!text) {
            hideActionButton();
            return;
        }

        selectedTextForAction = text;
        scheduleShowButton(80);
    }

    actionBtn.addEventListener("mousedown", (e) => {
        // 防止点击按钮时选区先被页面清空。
        e.preventDefault();
    });

    actionBtn.addEventListener("click", () => {
        const text = selectedTextForAction.trim();
        if (!text) {
            hideActionButton();
            return;
        }

        chrome.runtime
            .sendMessage({
                type: "TEXT_SELECTED",
                text
            })
            .then((resp) => {
                if (!resp?.ok) {
                    console.warn("消息已发送但处理失败:", resp);
                }
            })
            .catch((err) => {
                console.error("❌ 发送失败", err);
            })
            .finally(() => {
                hideActionButton();
            });
    });

    document.addEventListener("mouseup", (e) => {
        updateSelectionActionState(e.target);
    }, true);

    document.addEventListener("touchend", (e) => {
        updateSelectionActionState(e.target);
    }, true);

    document.addEventListener("mousedown", (e) => {
        if (e.target !== actionBtn) {
            hideActionButton();
        }
    }, true);

    document.addEventListener("scroll", hideActionButton, true);
}
