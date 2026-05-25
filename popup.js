document.addEventListener("DOMContentLoaded", function () {
  const noteInput = document.getElementById("noteInput");
  const saveButton = document.getElementById("saveButton");
  const notesList = document.getElementById("notesList");
  const successContainer = document.getElementById("success-message");
  const successAction = document.getElementById("success-action");
  const capturePageButton = document.getElementById("capturePageButton");

  const darkModeToggle = document.getElementById("darkModeToggle");
  const zenModeButton = document.getElementById("zenModeButton");
  const searchInput = document.getElementById("searchInput");
  const exportButton = document.getElementById("exportButton");
  const copyAllButton = document.getElementById("copyAllButton");

  const editModal = document.getElementById("editModal");
  const editNoteInput = document.getElementById("editNoteInput");
  const closeEditModal = document.getElementById("closeEditModal");
  const cancelEditButton = document.getElementById("cancelEditButton");
  const saveEditButton = document.getElementById("saveEditButton");
  const editOverlay = document.getElementById("editOverlay");

  let countof = 0;
  let allNotes = []; // To keep track for search filtering
  let currentEditNoteId = null;
  let didOpenSelectedNote = false;
  let deletedNoteSnapshot = null;
  let undoTimer = null;
  let successTimer = null;

  // Check Zen Mode
  const urlParams = new URLSearchParams(window.location.search);
  const isZenMode = urlParams.get('zen') === 'true';
  const selectedNoteId = urlParams.has('note') ? Number(urlParams.get('note')) : null;
  if (isZenMode) {
    document.body.classList.add('zen-mode');
    document.querySelector('header h1').innerHTML = '<i class="fas fa-bolt" style="color: #6366f1;"></i> Quick Note (Zen)';
    zenModeButton.title = "Close Zen Mode";
    zenModeButton.setAttribute("aria-label", "Close Zen Mode");
    zenModeButton.innerHTML = '<i class="fas fa-times"></i>';
  }

  if (typeof chrome !== "undefined" && chrome.storage) {
    // Load Dark Mode Preference
    chrome.storage.local.get(["darkMode", "draftNote"], function(res) {
      if (res.darkMode) {
        document.body.classList.add("dark-mode");
      }
      if (res.draftNote) {
        noteInput.value = res.draftNote;
      }
    });

    // Dark Mode Toggle
    darkModeToggle.addEventListener("click", () => {
      const isDark = document.body.classList.toggle("dark-mode");
      chrome.storage.local.set({ darkMode: isDark });
    });

    // Zen Mode Toggle
    zenModeButton.addEventListener("click", () => {
      if (isZenMode) {
        closeZenMode();
        return;
      }

      const extensionUrl = chrome.runtime.getURL("popup.html?zen=true");
      chrome.tabs.create({ url: extensionUrl });
    });

    chrome.storage.sync.get("notes", function (result) {
      allNotes = parseStoredNotes(result.notes);
      renderNotes(allNotes);
      openSelectedNoteFromUrl();
      updateBadge();
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync" || !changes.notes) return;

      allNotes = parseStoredNotes(changes.notes.newValue);
      renderNotes(filterNotes(searchInput.value));
      updateBadge();
    });

    saveButton.addEventListener("click", addNote);
    
    if (capturePageButton) {
      capturePageButton.addEventListener("click", function() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs.length > 0) {
            const tab = tabs[0];
            const pageInfo = `[${tab.title}](${tab.url})`; // markdown format
            if (noteInput.value.trim() !== "") {
              noteInput.value += "\n\n" + pageInfo;
            } else {
              noteInput.value = pageInfo;
            }
            saveDraft();
          }
        });
      });
    }

    // Auto Save Draft
    noteInput.addEventListener("input", saveDraft);

    function saveDraft() {
      chrome.storage.local.set({ draftNote: noteInput.value });
    }

    noteInput.addEventListener("keydown", function (event) {
      if (event.keyCode === 13 && !event.shiftKey) {
        event.preventDefault();
        addNote();
      }
    });

    function addNote() {
      const noteText = noteInput.value.trim();
      if (noteText !== "") {
        const now = new Date().toISOString();
        const newNote = {
          text: noteText,
          id: Date.now(),
          createdAt: now,
          updatedAt: now,
          pinned: false
        };
        allNotes.push(newNote); // Keep original append style
        
        saveNotes(() => {
          renderNotes(filterNotes(searchInput.value));
          updateBadge();
          noteInput.value = "";
          saveDraft();
          showSuccess("Note Saved");
        });
      }
    }

    function updateBadge() {
        countof = allNotes.length;
        chrome.action.setBadgeText({ text: countof > 0 ? "•" : "" });
        chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    }

    function renderNotes(notesToRender) {
      notesList.innerHTML = "";
      sortNotesForDisplay(notesToRender).forEach(note => displayNote(note));
    }

    function displayNote(note) {
      const noteDiv = document.createElement("div");
      noteDiv.classList.add("note");
      if (note.pinned) noteDiv.classList.add("pinned");
      noteDiv.dataset.id = note.id;

      const noteTextDiv = document.createElement("div");
      noteTextDiv.classList.add("note-content");
      noteTextDiv.innerHTML = parseMarkdown(note.text, note.id);

      // Add event listeners to checkboxes
      setTimeout(() => {
        const checkboxes = noteDiv.querySelectorAll('.checklist-checkbox');
        checkboxes.forEach((cb) => {
          cb.addEventListener('change', (e) => {
            const index = parseInt(cb.dataset.index);
            updateChecklistState(note.id, index, e.target.checked);
          });
        });
      }, 0);

      noteDiv.appendChild(noteTextDiv);

      const metaDiv = document.createElement("div");
      metaDiv.classList.add("note-meta");
      metaDiv.textContent = getNoteTimestamp(note);
      noteDiv.appendChild(metaDiv);

      const buttonGroup = document.createElement("div");
      buttonGroup.classList.add("note-btn-group");

      const pinButton = document.createElement("button");
      pinButton.classList.add("note-icon-action");
      if (note.pinned) pinButton.classList.add("active");
      pinButton.title = note.pinned ? "Unpin note" : "Pin note";
      pinButton.setAttribute("aria-label", pinButton.title);
      pinButton.innerHTML = '<i class="fas fa-thumbtack"></i>';
      pinButton.addEventListener("click", function () {
        togglePinned(note.id);
      });

      const removeIcon = document.createElement("i");
      removeIcon.classList.add("fas", "fa-times", "remove-icon");
      removeIcon.title = "Delete note";
      removeIcon.setAttribute("aria-label", "Delete note");
      removeIcon.setAttribute("role", "button");
      removeIcon.tabIndex = 0;
      removeIcon.addEventListener("click", function () {
        removeNoteFromStorage(note.id);
      });
      removeIcon.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          removeNoteFromStorage(note.id);
        }
      });

      const copyButton = document.createElement("button");
      copyButton.classList.add("copy-button");
      copyButton.innerText = "Copy";
      copyButton.addEventListener("click", function () {
        navigator.clipboard.writeText(note.text).then(() => {
          showSuccess();
        });
      });

      const editButton = document.createElement("button");
      editButton.classList.add("copy-button");
      editButton.innerHTML = '<i class="fas fa-pen"></i> Edit';
      editButton.addEventListener("click", function () {
        openEditModal(note.id, note.text);
      });

      buttonGroup.appendChild(pinButton);
      buttonGroup.appendChild(removeIcon);
      buttonGroup.appendChild(editButton);
      buttonGroup.appendChild(copyButton);

      // Add View Full button only in regular mode (not zen)
      if (!isZenMode) {
        const viewFullButton = document.createElement("button");
        viewFullButton.classList.add("copy-button");
        viewFullButton.innerHTML = '<i class="fas fa-expand"></i> View Full';
        viewFullButton.addEventListener("click", function () {
          const extensionUrl = chrome.runtime.getURL(`popup.html?zen=true&note=${encodeURIComponent(note.id)}`);
          chrome.tabs.create({ url: extensionUrl });
        });
        buttonGroup.appendChild(viewFullButton);
      }

      noteDiv.appendChild(buttonGroup);
      notesList.appendChild(noteDiv);
    }

    function updateChecklistState(noteId, checkboxIndex, isChecked) {
      const noteIndex = allNotes.findIndex(n => n.id === noteId);
      if (noteIndex > -1) {
        let texts = allNotes[noteIndex].text.split('\n');
        let currentCheckboxIndex = 0;
        
        for (let i = 0; i < texts.length; i++) {
          const match = texts[i].match(/^- \[( |x|X)\] (.*)/);
          if (match) {
            if (currentCheckboxIndex === checkboxIndex) {
              texts[i] = isChecked ? `- [x] ${match[2]}` : `- [ ] ${match[2]}`;
              break;
            }
            currentCheckboxIndex++;
          }
        }
        
        allNotes[noteIndex].text = texts.join('\n');
        allNotes[noteIndex].updatedAt = new Date().toISOString();
        saveNotes(() => {
          renderNotes(filterNotes(searchInput.value));
        });
      }
    }

    function removeNoteFromStorage(noteId) {
      const noteIndex = allNotes.findIndex((note) => note.id === noteId);
      if (noteIndex === -1) return;

      deletedNoteSnapshot = {
        note: allNotes[noteIndex],
        index: noteIndex
      };
      allNotes.splice(noteIndex, 1);

      saveNotes(() => {
        renderNotes(filterNotes(searchInput.value));
        updateBadge();
        showUndoDelete();
      });
    }

    function undoDelete() {
      if (!deletedNoteSnapshot) return;

      allNotes.splice(deletedNoteSnapshot.index, 0, deletedNoteSnapshot.note);
      deletedNoteSnapshot = null;
      clearTimeout(undoTimer);

      saveNotes(() => {
        renderNotes(filterNotes(searchInput.value));
        updateBadge();
        showSuccess("Delete Undone");
      });
    }

    function togglePinned(noteId) {
      const note = allNotes.find((item) => item.id === noteId);
      if (!note) return;

      note.pinned = !note.pinned;
      note.updatedAt = new Date().toISOString();
      saveNotes(() => {
        renderNotes(filterNotes(searchInput.value));
        showSuccess(note.pinned ? "Note Pinned" : "Note Unpinned");
      });
    }

    function saveNotes(callback) {
      chrome.storage.sync.set({ notes: JSON.stringify(allNotes) }, callback);
    }

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

    function sortNotesForDisplay(notes) {
      return [...notes].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return getNoteTime(b) - getNoteTime(a);
      });
    }

    function filterNotes(term) {
      const normalizedTerm = term.trim().toLowerCase();
      if (!normalizedTerm) return allNotes;
      return allNotes.filter(n => n.text.toLowerCase().includes(normalizedTerm));
    }

    function getNoteTime(note) {
      return new Date(note.updatedAt || note.createdAt || note.id).getTime() || 0;
    }

    function getNoteTimestamp(note) {
      const date = new Date(note.updatedAt || note.createdAt || note.id);
      if (Number.isNaN(date.getTime())) return "";

      const label = note.updatedAt && note.updatedAt !== note.createdAt ? "Updated" : "Created";
      return `${note.pinned ? "Pinned • " : ""}${label} ${date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      })}`;
    }

    function openSelectedNoteFromUrl() {
      if (!isZenMode || didOpenSelectedNote || selectedNoteId === null || !Number.isFinite(selectedNoteId)) return;

      const selectedNote = allNotes.find(note => note.id === selectedNoteId);
      if (selectedNote) {
        didOpenSelectedNote = true;
        openEditModal(selectedNote.id, selectedNote.text);
      }
    }

    function closeZenMode() {
      chrome.tabs.getCurrent((tab) => {
        if (tab && tab.id) {
          chrome.tabs.remove(tab.id);
          return;
        }

        window.close();
      });
    }

    // Markdown Parser
    function parseMarkdown(text) {
      let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      const lines = html.split('\n');
      let inList = false;
      let parsedLines = [];
      let checkboxCount = 0;
      
      lines.forEach(line => {
        // Headers
        if (line.match(/^### (.*$)/)) line = `<h3>${line.substring(4)}</h3>`;
        else if (line.match(/^## (.*$)/)) line = `<h2>${line.substring(3)}</h2>`;
        else if (line.match(/^# (.*$)/)) line = `<h1>${line.substring(2)}</h1>`;
        
        // Checklists
        const checkMatch = line.match(/^- \[( |x|X)\] (.*)/);
        if (checkMatch) {
          if (!inList) {
            parsedLines.push('<ul class="markdown-checklist">');
            inList = true;
          }
          const isChecked = checkMatch[1].toLowerCase() === 'x';
          const checkedAttr = isChecked ? 'checked' : '';
          const completedClass = isChecked ? 'completed' : '';
          
          line = `<li class="checklist-item ${completedClass}">
            <input type="checkbox" class="checklist-checkbox" data-index="${checkboxCount}" ${checkedAttr}>
            <span>${parseInlineMarkdown(checkMatch[2])}</span>
          </li>`;
          checkboxCount++;
        } else {
          // Normal bullet point
          const bulletMatch = line.match(/^- (.*)/);
          if (bulletMatch && !line.includes('<h')) {
            if (!inList) {
              parsedLines.push('<ul>');
              inList = true;
            }
            line = `<li>${parseInlineMarkdown(bulletMatch[1])}</li>`;
          } else {
            if (inList) {
              parsedLines.push('</ul>');
              inList = false;
            }
            // Regular line
            line = parseInlineMarkdown(line);
          }
        }
        parsedLines.push(line);
      });
      
      if (inList) parsedLines.push('</ul>');
      
      return parsedLines.join('\n');
    }

    function parseInlineMarkdown(text) {
      const linkPlaceholders = [];
      // Bold
      text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Italic
      text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
      // Links
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, label, url) {
        const safeUrl = sanitizeUrl(url);
        if (!safeUrl) return label;
        const token = `%%LINK_${linkPlaceholders.length}%%`;
        linkPlaceholders.push(`<a href="${escapeAttribute(safeUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`);
        return token;
      });
      // Standalone URLs (rudimentary, ignoring ones inside links)
      text = text.replace(/(^|[^"'=])(https?:\/\/[^\s<"']+)/g, function(_, prefix, url) {
        const safeUrl = sanitizeUrl(url);
        if (!safeUrl) return `${prefix}${url}`;
        return `${prefix}<a href="${escapeAttribute(safeUrl)}" target="_blank" rel="noopener noreferrer">${url}</a>`;
      });
      linkPlaceholders.forEach((linkHtml, index) => {
        text = text.replace(`%%LINK_${index}%%`, linkHtml);
      });
      
      return text;
    }

    function sanitizeUrl(url) {
      const trimmedUrl = url.trim();
      try {
        const parsedUrl = new URL(trimmedUrl);
        return ["http:", "https:", "mailto:"].includes(parsedUrl.protocol) ? parsedUrl.href : "";
      } catch {
        return "";
      }
    }

    function escapeAttribute(value) {
      return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function showSuccess(message = "Notes Copied Successfully", actionLabel = "", actionHandler = null, duration = 2000) {
      clearTimeout(successTimer);
      document.getElementById("success-text").innerText = message;
      successAction.style.display = actionLabel ? "inline-flex" : "none";
      successAction.innerText = actionLabel;
      successAction.onclick = actionHandler;
      successContainer.style.display = 'block';
      successTimer = setTimeout(() => {
        successContainer.style.display = 'none';
        successAction.style.display = "none";
        successAction.onclick = null;
      }, duration);
    }

    function showUndoDelete() {
      showSuccess("Note Deleted", "Undo", undoDelete, 5000);
      clearTimeout(undoTimer);
      undoTimer = setTimeout(() => {
        deletedNoteSnapshot = null;
      }, 5000);
    }

    function openEditModal(noteId, noteText) {
      currentEditNoteId = noteId;
      editNoteInput.value = noteText;
      editModal.classList.add('active');
      editNoteInput.focus();
    }

    function closeEditModalHandler() {
      editModal.classList.remove('active');
      currentEditNoteId = null;
      editNoteInput.value = '';
    }

    function saveEditedNote() {
      if (!currentEditNoteId) return;
      const editedText = editNoteInput.value.trim();
      if (editedText === "") return;

      const noteIndex = allNotes.findIndex(n => n.id === currentEditNoteId);
      if (noteIndex > -1) {
        allNotes[noteIndex].text = editedText;
        allNotes[noteIndex].updatedAt = new Date().toISOString();
        saveNotes(() => {
          renderNotes(filterNotes(searchInput.value));
          closeEditModalHandler();
          showSuccess("Note Updated");
        });
      }
    }

    // Modal event listeners
    closeEditModal.addEventListener("click", closeEditModalHandler);
    cancelEditButton.addEventListener("click", closeEditModalHandler);
    editOverlay.addEventListener("click", closeEditModalHandler);
    saveEditButton.addEventListener("click", saveEditedNote);

    // Close modal on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && editModal.classList.contains('active')) {
        closeEditModalHandler();
      }
    });

    // Export Notes
    exportButton.addEventListener('click', () => {
      if (allNotes.length === 0) return;
      const exportText = allNotes.map(n => n.text).join('\n\n---\n\n');
      const blob = new Blob([exportText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QuickNotes_Export_${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Copy All
    copyAllButton.addEventListener('click', () => {
      if (allNotes.length === 0) return;
      const exportText = allNotes.map(n => n.text).join('\n\n---\n\n');
      navigator.clipboard.writeText(exportText).then(() => {
        showSuccess();
      });
    });

    // Search
    searchInput.addEventListener('input', (e) => {
      renderNotes(filterNotes(e.target.value));
    });

  } else {
    console.error("chrome.storage API is not available.");
  }
});
