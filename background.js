chrome.runtime.onInstalled.addListener(() => {
	chrome.sidePanel
		.setPanelBehavior({ openPanelOnActionClick: true })
		.catch((error) => console.error("设置侧边栏行为失败:", error));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message?.type !== "TEXT_SELECTED") {
		return;
	}

	const selectedText = (message.text || "").trim();
	if (!selectedText) {
		sendResponse({ ok: false, reason: "empty_text" });
		return;
	}

	const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const payload = {
		id: requestId,
		text: selectedText,
		ts: Date.now()
	};

	const tabId = sender.tab?.id;

	// 先缓存一份，保证侧边栏稍后打开也能拿到这次划词。
	chrome.storage.session
		.set({ pendingSelectedText: payload })
		.then(async () => {
			if (typeof tabId === "number") {
				try {
					await chrome.sidePanel.open({ tabId });
				} catch (error) {
					console.error("打开侧边栏失败:", error);
				}
			}

			// 尝试实时转发给已打开的侧边栏。
			try {
				await chrome.runtime.sendMessage({
					type: "TEXT_SELECTED_FOR_PANEL",
					payload
				});
			} catch (error) {
				// 侧边栏尚未就绪时，这里可能抛错；有 session 缓存兜底。
			}

			sendResponse({ ok: true });
		})
		.catch((error) => {
			console.error("缓存划词失败:", error);
			sendResponse({ ok: false, reason: "storage_failed" });
		});

	return true;
});