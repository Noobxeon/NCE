const { app, BrowserWindow, ipcMain, protocol, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Data paths
const dataDir = app.getPath('userData');
const vocabPath = path.join(dataDir, 'vocabulary.json');
const booksPath = path.join(dataDir, 'books_data'); // Switch to safe appData directory

const localBooksPath = path.join(app.getAppPath(), 'books_data');
if (!fs.existsSync(booksPath)) {
  fs.mkdirSync(booksPath, { recursive: true });
  if (fs.existsSync(localBooksPath)) {
    try {
      const files = fs.readdirSync(localBooksPath);
      for (const f of files) {
        fs.copyFileSync(path.join(localBooksPath, f), path.join(booksPath, f));
      }
    } catch (e) { console.error('Error copying initial books', e); }
  }
}


function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#f8fafc',
      height: 40
    }
  });

  const isDev = process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    mainWindow.loadURL(isDev);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  protocol.registerFileProtocol('local', (request, callback) => {
    const url = request.url.replace(/^local:\/\//, '');
    try {
      // url might have query string or hash, strip them out if present
      const decoded = decodeURIComponent(url.split('?')[0]);
      // If it's not an absolute path, resolve it relative to booksPath
      const filePath = path.isAbsolute(decoded) ? decoded : path.join(booksPath, decoded);
      return callback({ path: filePath });
    } catch (e) {
      return callback(404);
    }
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Dictionary Lookup
ipcMain.handle('lookup-word', async (event, word) => {
  try {
    const [suggestRaw, jsonapiRaw] = await Promise.all([
      fetch(`https://dict.youdao.com/suggest?num=1&doctype=json&q=${encodeURIComponent(word)}`),
      fetch(`https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word)}`)
    ]);
    const suggestData = await suggestRaw.json();
    const jsonapiData = await jsonapiRaw.json();
    
    let meaning = '';
    let phonetic = '';

    if (suggestData && suggestData.data && suggestData.data.entries && suggestData.data.entries.length > 0) {
      meaning = suggestData.data.entries[0].explain;
    }
    if (jsonapiData && jsonapiData.ec && jsonapiData.ec.word && jsonapiData.ec.word.length > 0) {
      phonetic = jsonapiData.ec.word[0].ukphone || jsonapiData.ec.word[0].usphone || '';
    }

    if (meaning) {
      return { meaning, phonetic };
    }
    return null;
  } catch(e) {
    console.error('Dictionary lookup failed:', e);
    return null;
  }
});

ipcMain.handle('migrate-vocab-phonetics', async () => {
  if (fs.existsSync(vocabPath)) {
    let vocab = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
    let changed = false;
    for (let i = 0; i < vocab.length; i++) {
        if (!vocab[i].phonetic) {
            try {
                const res = await fetch(`https://dict.youdao.com/jsonapi?q=${encodeURIComponent(vocab[i].word)}`);
                const data = await res.json();
                if (data && data.ec && data.ec.word && data.ec.word.length > 0) {
                    vocab[i].phonetic = data.ec.word[0].ukphone || data.ec.word[0].usphone || '';
                    changed = true;
                }
            } catch(e) {}
        }
    }
    if (changed) {
        fs.writeFileSync(vocabPath, JSON.stringify(vocab, null, 2));
    }
    return vocab;
  }
  return [];
});

// Mock database interactions using JSON
ipcMain.handle('get-vocab', () => {
  if (fs.existsSync(vocabPath)) {
    return JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
  }
  return [];
});

ipcMain.handle('add-vocab', (event, wordObj) => {
  let vocab = [];
  if (fs.existsSync(vocabPath)) {
    vocab = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
  }
  // Remove existing word if present
  vocab = vocab.filter(w => w.word !== wordObj.word);
  vocab.unshift({
    ...wordObj,
    addedAt: new Date().toISOString(),
    reviews: 0,
    nextReview: new Date().toISOString()
  });
  fs.writeFileSync(vocabPath, JSON.stringify(vocab, null, 2));
  return vocab;
});

ipcMain.handle('remove-vocab', (event, word) => {
    let vocab = [];
    if (fs.existsSync(vocabPath)) {
      vocab = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
    }
    vocab = vocab.filter(w => w.word !== word);
    fs.writeFileSync(vocabPath, JSON.stringify(vocab, null, 2));
    return vocab;
});

ipcMain.handle('update-vocab-review', (event, word, success) => {
    let vocab = [];
    if (fs.existsSync(vocabPath)) {
      vocab = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
    }
    vocab = vocab.map(w => {
        if(w.word === word) {
            // Very simple SRS (Spaced Repetition System) logic
            const nextRevDays = success ? Math.pow(2, w.reviews + 1) : 1;
            const nextDate = new Date();
            nextDate.setDate(nextDate.getDate() + nextRevDays);
            return {
                ...w,
                reviews: success ? w.reviews + 1 : 0,
                nextReview: nextDate.toISOString()
            }
        }
        return w;
    });
    fs.writeFileSync(vocabPath, JSON.stringify(vocab, null, 2));
    return vocab;
});

ipcMain.handle('get-books', () => {
  try {
    if (!fs.existsSync(booksPath)) {
      fs.mkdirSync(booksPath, { recursive: true });
      // Create a dummy template format file explaining how to insert resources
      const template = {
        id: "nce_custom_example",
        title: "NCE Custom Example (How to add resources)",
        chapters: [
          {
            id: "1-1",
            title: "Example Title",
            content: "Please drop JSON files in this folder matching this structure. The app will read them automatically upon restart or refresh.",
            audioUrl: "optional-audio.mp3"
          }
        ]
      };
      fs.writeFileSync(path.join(booksPath, 'template_instructions.json'), JSON.stringify(template, null, 2));
    }
    const files = fs.readdirSync(booksPath).filter(f => f.endsWith('.json'));
    const allBooks = [];
    for (const f of files) {
      const bPath = path.join(booksPath, f);
      try {
        const bookData = JSON.parse(fs.readFileSync(bPath, 'utf8'));
        if (bookData && bookData.id && bookData.chapters) {
          allBooks.push(bookData);
        }
      } catch (err) {
        console.error('Error reading book file:', f, err);
      }
    }
    // Sort by id simply to order them
    return allBooks.sort((a,b) => a.id.localeCompare(b.id));
  } catch(e) {
    console.error('Error fetching books:', e);
    return [];
  }
});

ipcMain.handle('open-books-folder', () => {
  shell.openPath(booksPath);
});
