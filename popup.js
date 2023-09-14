document.addEventListener("DOMContentLoaded", function () {
  const noteInput = document.getElementById("noteInput");
  const saveButton = document.getElementById("saveButton");
  const notesList = document.getElementById("notesList");

  if (chrome.storage) {
    chrome.storage.local.get("notes", function (result) {
      if (result.notes) {
        const notes = JSON.parse(result.notes);
        notes.forEach((note) => displayNote(note));
      }
    });

    saveButton.addEventListener("click", addnote);

    noteInput.addEventListener("keydown", function (event) {
      if (event.keyCode === 13) {
        addnote();
      }
    });

    function addnote() {
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
