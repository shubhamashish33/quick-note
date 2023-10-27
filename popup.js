document.addEventListener("DOMContentLoaded", function () {
  const noteInput = document.getElementById("noteInput");
  const saveButton = document.getElementById("saveButton");
  const notesList = document.getElementById("notesList");

  let countof = 0;

  if (chrome.storage) {
    chrome.storage.local.get("notes", function (result) {
      if (result.notes) {
        const notes = JSON.parse(result.notes);

        countof = notes.length;
        notes.forEach((note) => displayNote(note));

        chrome.action.setBadgeText({ text: String(countof) });
      }
    });

    saveButton.addEventListener("click", addNote);

    noteInput.addEventListener("keydown", function (event) {
      if (event.keyCode === 13) {
        addNote();
      }
    });

    function addNote() {
      const noteText = noteInput.value.trim();
      if (noteText !== "") {
        chrome.storage.local.get("notes", function (result) {
          const existingNotes = result.notes ? JSON.parse(result.notes) : [];
          const newNote = { text: noteText, id: Date.now() };
          existingNotes.push(newNote);

          chrome.storage.local.set(
            { notes: JSON.stringify(existingNotes) },
            function () {
              displayNote(newNote);

              countof = existingNotes.length;
              chrome.action.setBadgeText({ text: String(countof) });
            }
          );
        });
        noteInput.value = "";
      }
    }

    function displayNote(note) {
      const noteDiv = document.createElement("div");
      noteDiv.classList.add("note");
      noteDiv.textContent = note.text;

      const removeIcon = document.createElement("i");
      removeIcon.classList.add("fas", "fa-times", "remove-icon");
      removeIcon.addEventListener("click", function () {
        notesList.removeChild(noteDiv);
        removeNoteFromStorage(note.id);

        countof--;
        chrome.action.setBadgeText({ text: String(countof) });
      });

      noteDiv.appendChild(removeIcon);
      notesList.appendChild(noteDiv);
    }

    function removeNoteFromStorage(noteId) {
      chrome.storage.local.get("notes", function (result) {
        const existingNotes = result.notes ? JSON.parse(result.notes) : [];
        const updatedNotes = existingNotes.filter((note) => note.id !== noteId);
        chrome.storage.local.set({ notes: JSON.stringify(updatedNotes) });
      });
    }
  } else {
    console.error("chrome.storage API is not available.");
  }
});
