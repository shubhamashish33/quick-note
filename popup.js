document.addEventListener("DOMContentLoaded", function () {
  const noteInput = document.getElementById("noteInput");
  const saveButton = document.getElementById("saveButton");
  const boldButton = document.getElementById("boldButton");
  const italicButton = document.getElementById("italicButton");
  const underlineButton = document.getElementById("underlineButton");
  const notesList = document.getElementById("notesList");
  const successContainer = document.getElementById("success-message");
  const capturePageButton = document.getElementById("capturePageButton");
  let countof = 0;
  if (chrome.storage) {
    chrome.storage.sync.get("notes", function (result) {
      if (result.notes) {
        const notes = JSON.parse(result.notes);
        countof = notes.length;
        notes.forEach((note) => displayNote(note));
        chrome.action.setBadgeText({ text: countof > 0 ? "•" : "" });
        chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
      }
    });
    saveButton.addEventListener("click", addNote);
    
    if (capturePageButton) {
      capturePageButton.addEventListener("click", function() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs.length > 0) {
            const tab = tabs[0];
            const pageInfo = `${tab.url}`;
            if (noteInput.value.trim() !== "") {
              noteInput.value += "\n\n" + pageInfo;
            } else {
              noteInput.value = pageInfo;
            }
          }
        });
      });
    }

    boldButton.addEventListener("click", function () {
      formatText("bold");
    });
    italicButton.addEventListener("click", function () {
      formatText("italic");
    });
    underlineButton.addEventListener("click", function () {
      formatText("underline");
    });
    noteInput.addEventListener("keydown", function (event) {
      // Allow Shift+Enter for new lines in textarea, Enter alone to save
      if (event.keyCode === 13 && !event.shiftKey) {
        event.preventDefault();
        addNote();
      }
    });
    function addNote() {
      const noteText = noteInput.value.trim();
      if (noteText !== "") {
        chrome.storage.sync.get("notes", function (result) {
          const existingNotes = result.notes ? JSON.parse(result.notes) : [];
          const newNote = { text: noteText, id: Date.now() };
          existingNotes.push(newNote);
          chrome.storage.sync.set(
            { notes: JSON.stringify(existingNotes) },
            function () {
              displayNote(newNote);
              countof = existingNotes.length;
              chrome.action.setBadgeText({ text: countof > 0 ? "•" : "" });
              chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
            }
          );
        });
        noteInput.value = "";
      }
      if(boldButton.classList.contains("active")){
        boldButton.classList.toggle("active");
      }
      if(underlineButton.classList.contains("active")){
        underlineButton.classList.toggle("active")
      }
      if(italicButton.classList.contains("active")){
        italicButton.classList.toggle("active")
      }
    }
    function displayNote(note) {
      const noteDiv = document.createElement("div");
      noteDiv.classList.add("note");

      const noteTextSpan = document.createElement("span");
      noteTextSpan.innerHTML = applyFormatting(note.text);
      noteDiv.appendChild(noteTextSpan);

      const buttonGroup = document.createElement("div");
      buttonGroup.classList.add("note-btn-group");

      const removeIcon = document.createElement("i");
      removeIcon.classList.add("fas", "fa-times", "remove-icon");
      removeIcon.addEventListener("click", function () {
        notesList.removeChild(noteDiv);
        removeNoteFromStorage(note.id);
        countof--;
        chrome.action.setBadgeText({ text: countof > 0 ? "•" : "" });
        chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
      });

      const copyButton = document.createElement("button");
      copyButton.classList.add("copy-button");
      copyButton.innerText = "Copy";
      copyButton.addEventListener("click", function () {
        navigator.clipboard.writeText(note.text).then(() => {
          successContainer.style.display = 'block';
        }).catch(err => {
          console.error("Failed to copy text: ", err);
        });
      });

      buttonGroup.appendChild(removeIcon);
      buttonGroup.appendChild(copyButton);
      noteDiv.appendChild(buttonGroup);
      notesList.appendChild(noteDiv);
    }
    function removeNoteFromStorage(noteId) {
      chrome.storage.sync.get("notes", function (result) {
        const existingNotes = result.notes ? JSON.parse(result.notes) : [];
        const updatedNotes = existingNotes.filter((note) => note.id !== noteId);
        chrome.storage.sync.set({ notes: JSON.stringify(updatedNotes) });
      });
    }
    function applyFormatting(text) {
      let formattedText = text;
      if (boldButton.classList.contains("active")) {
        formattedText = `<b>${formattedText}</b>`;
      }
      if (italicButton.classList.contains("active")) {
        formattedText = `<i>${formattedText}</i>`;
      }
      if (underlineButton.classList.contains("active")) {
        formattedText = `<u>${formattedText}</u>`;
      }
      return formattedText;
    }
    function formatText(format) {
      switch (format) {
        case "bold":
          if (boldButton.classList.contains("active")) {
            noteInput.value = "";
          }
          boldButton.classList.toggle("active");
          break;
        case "italic":
          if (italicButton.classList.contains("active")) {
            noteInput.value = "";
          }
          italicButton.classList.toggle("active");
          break;
        case "underline":
          if (underlineButton.classList.contains("active")) {
            noteInput.value = "";
          }
          underlineButton.classList.toggle("active");
          break;
        default:
          break;
      }
      noteInput.value = applyFormatting(noteInput.value);
    }
  } else {
    console.error("chrome.storage API is not available.");
  }
});
