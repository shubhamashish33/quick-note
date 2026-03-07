document.addEventListener("DOMContentLoaded", function () {
  const noteInput = document.getElementById("noteInput");
  const saveButton = document.getElementById("saveButton");
  const notesList = document.getElementById("notesList");
  const successContainer = document.getElementById("success-message");
  const capturePageButton = document.getElementById("capturePageButton");
  
  const darkModeToggle = document.getElementById("darkModeToggle");
  const zenModeButton = document.getElementById("zenModeButton");
  const searchInput = document.getElementById("searchInput");
  const exportButton = document.getElementById("exportButton");
  const copyAllButton = document.getElementById("copyAllButton");

  let countof = 0;
  let allNotes = []; // To keep track for search filtering

  // Check Zen Mode
  const urlParams = new URLSearchParams(window.location.search);
  const isZenMode = urlParams.get('zen') === 'true';
  if (isZenMode) {
    document.body.classList.add('zen-mode');
    document.querySelector('header h1').innerHTML = '<i class="fas fa-bolt" style="color: #6366f1;"></i> Quick Note (Zen)';
  }

  if (chrome.storage) {
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
      const extensionUrl = chrome.runtime.getURL("popup.html?zen=true");
      chrome.tabs.create({ url: extensionUrl });
    });

    chrome.storage.sync.get("notes", function (result) {
      if (result.notes) {
        // reverse to show newest first if we use push, but here we'll use unshift directly on save. 
        // older version used push but appended, wait original appended so oldest was at bottom OR reversed? Original appended which means oldest at top! Let's just render them. 
        // User is used to oldest at top or newest at top?
        // Original: notes.forEach((note) => displayNote(note)); notesList.appendChild(noteDiv). Oldest first. Let's keep existing order.
        allNotes = JSON.parse(result.notes);
        countof = allNotes.length;
        renderNotes(allNotes);
        updateBadge();
      }
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
        const newNote = { text: noteText, id: Date.now() };
        allNotes.push(newNote); // Keep original append style
        
        chrome.storage.sync.set(
          { notes: JSON.stringify(allNotes) },
          function () {
            renderNotes(allNotes);
            updateBadge();
            // Clear draft
            noteInput.value = "";
            saveDraft();
          }
        );
      }
    }

    function updateBadge() {
        countof = allNotes.length;
        chrome.action.setBadgeText({ text: countof > 0 ? "•" : "" });
        chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    }

    function renderNotes(notesToRender) {
      notesList.innerHTML = "";
      // Keep original order: newest at bottom, oldest at top. Or perhaps newest at top is better minimalist note behavior. 
      // Changed to reverse() for rendering so newest is at top without destroying storage order.
      [...notesToRender].reverse().forEach(note => displayNote(note));
    }

    function displayNote(note) {
      const noteDiv = document.createElement("div");
      noteDiv.classList.add("note");
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

      const buttonGroup = document.createElement("div");
      buttonGroup.classList.add("note-btn-group");

      const removeIcon = document.createElement("i");
      removeIcon.classList.add("fas", "fa-times", "remove-icon");
      removeIcon.addEventListener("click", function () {
        removeNoteFromStorage(note.id);
      });

      const copyButton = document.createElement("button");
      copyButton.classList.add("copy-button");
      copyButton.innerText = "Copy";
      copyButton.addEventListener("click", function () {
        navigator.clipboard.writeText(note.text).then(() => {
          showSuccess();
        });
      });

      buttonGroup.appendChild(removeIcon);
      buttonGroup.appendChild(copyButton);
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
        chrome.storage.sync.set({ notes: JSON.stringify(allNotes) }, () => {
          renderNotes(allNotes); // re-render to reflect new state
        });
      }
    }

    function removeNoteFromStorage(noteId) {
      allNotes = allNotes.filter((note) => note.id !== noteId);
      chrome.storage.sync.set({ notes: JSON.stringify(allNotes) }, () => {
          renderNotes(allNotes);
          updateBadge();
      });
    }

    // Markdown Parser
    function parseMarkdown(text, noteId) {
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
      // Bold
      text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Italic
      text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
      // Links
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
      // Standalone URLs (rudimentary, ignoring ones inside links)
      text = text.replace(/(^|[^"'])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank">$2</a>');
      
      return text;
    }

    function showSuccess() {
      successContainer.style.display = 'block';
      setTimeout(() => {
        successContainer.style.display = 'none';
      }, 2000);
    }

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
      const term = e.target.value.toLowerCase();
      const filtered = allNotes.filter(n => n.text.toLowerCase().includes(term));
      renderNotes(filtered);
    });

  } else {
    console.error("chrome.storage API is not available.");
  }
});
