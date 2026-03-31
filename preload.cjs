const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getVocab: () => ipcRenderer.invoke('get-vocab'),
  addVocab: (wordObj) => ipcRenderer.invoke('add-vocab', wordObj),
  removeVocab: (word) => ipcRenderer.invoke('remove-vocab', word),
  updateVocabReview: (word, success) => ipcRenderer.invoke('update-vocab-review', word, success),
  getBooks: () => ipcRenderer.invoke('get-books'),
  lookupWord: (word) => ipcRenderer.invoke('lookup-word', word),
  openBooksFolder: () => ipcRenderer.invoke('open-books-folder'),
  migrateVocabPhonetics: () => ipcRenderer.invoke('migrate-vocab-phonetics'),
  readLrc: (url) => ipcRenderer.invoke('read-lrc', url)
});
