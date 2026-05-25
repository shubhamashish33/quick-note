const CONTEXT_MENU_ID = "quick-note-save-selection";

createContextMenu();

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Save to Quick Note",
      contexts: ["selection"]
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText) return;

  chrome.storage.sync.get("notes", (result) => {
    const notes = parseStoredNotes(result.notes);
    const now = new Date().toISOString();
    const sourceUrl = info.pageUrl || tab?.url || "";
    const sourceLine = sourceUrl ? `\n\nSource: ${sourceUrl}` : "";

    notes.push({
      id: Date.now(),
      text: `${info.selectionText.trim()}${sourceLine}`,
      createdAt: now,
      updatedAt: now,
      pinned: false
    });

    chrome.storage.sync.set({ notes: JSON.stringify(notes) }, () => {
      chrome.action.setBadgeText({ text: "•" });
      chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    });
  });
});

function parseStoredNotes(rawNotes) {
  if (!rawNotes) return [];

  try {
    const parsed = JSON.parse(rawNotes);
    return Array.isArray(parsed) ? parsed.map(normalizeNote) : [];
  } catch (error) {
    console.error("Unable to parse saved notes.", error);
    return [];
  }
}

function normalizeNote(note) {
  const now = new Date().toISOString();
  const id = Number.isFinite(Number(note?.id)) ? Number(note.id) : Date.now();

  return {
    id,
    text: typeof note?.text === "string" ? note.text : "",
    createdAt: note?.createdAt || now,
    updatedAt: note?.updatedAt || note?.createdAt || now,
    pinned: Boolean(note?.pinned)
  };
}
