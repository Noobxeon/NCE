import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, List, BrainCircuit, ChevronRight, Plus, Trash2, CheckCircle, Play, Pause, RotateCcw, Headphones, BookA, SkipForward } from 'lucide-react';
import './index.css';

// Type definitions for Electron API mock
declare global {
  interface Window {
    api?: {
      getVocab: () => Promise<any[]>;
      addVocab: (wordObj: any) => Promise<any[]>;
      removeVocab: (word: string) => Promise<any[]>;
      updateVocabReview: (word: string, success: boolean) => Promise<any[]>;
      getBooks: () => Promise<any[]>;
      lookupWord: (word: string) => Promise<{meaning: string, phonetic: string} | null>;
      openBooksFolder: () => Promise<void>;
      migrateVocabPhonetics: () => Promise<any[]>;
    }
  }
}

const playTTS = (text: string) => {
  const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`);
  audio.play().catch(e => console.error('TTS Playback failed:', e));
};

type View = 'reader' | 'vocab' | 'review';

function App() {
  const [activeView, setActiveView] = useState<View>('reader');
  const [books, setBooks] = useState<any[]>([]);
  const [vocab, setVocab] = useState<any[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<any>(null);

  useEffect(() => {
    // Initial load
    if (window.api) {
      window.api.getBooks().then(data => {
        setBooks(data);
        if (data[0] && data[0].chapters[0]) {
          setSelectedChapter(data[0].chapters[0]);
        }
      });
      
      // Auto-migrate missing phonetics in the background
      window.api.migrateVocabPhonetics().then(() => {
          window.api!.getVocab().then(setVocab);
      });
    } else {
      console.warn('Electron API not found, setting up web fallbacks');
      let memoryVocab: any[] = [];
      const mockApi = {
        getBooks: async () => [{ id: '1', title: 'NCE Book 1', chapters: [{ id: '1', title: 'Chapter 1', content: 'Hello World! This is a simple test chapter. You can click any word here to add it to your vocabulary. Have fun learning new words!', audioUrl: null }] }],
        getVocab: async () => memoryVocab,
        addVocab: async (w: any) => { memoryVocab = [{...w, reviews: 0, nextReview: new Date().toISOString()}, ...memoryVocab.filter(x=>x.word!==w.word)]; return memoryVocab; },
        removeVocab: async (w: string) => { memoryVocab = memoryVocab.filter(x=>x.word!==w); return memoryVocab; },
        updateVocabReview: async (w: string, s: boolean) => {
          memoryVocab = memoryVocab.map(x => x.word === w ? {...x, reviews: s ? x.reviews + 1 : 0, nextReview: new Date(Date.now() + (s ? 86400000 : 0)).toISOString()} : x);
          return memoryVocab;
        },
        lookupWord: async () => null, // Mock has no internet lookup by default
        openBooksFolder: async () => console.log('Mock: Open Books Folder'),
        migrateVocabPhonetics: async () => memoryVocab
      };
      window.api = mockApi;
      mockApi.getBooks().then(data => {
        setBooks(data);
        setSelectedChapter(data[0].chapters[0]);
      });
    }
  }, []);

  const refreshVocab = () => {
    if (window.api) window.api.getVocab().then(setVocab);
  };

  return (
    <>
      <div className="drag-region" />
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        books={books} 
        selectedChapter={selectedChapter} 
        setSelectedChapter={setSelectedChapter} 
      />
      <main className="main-content">
        {activeView === 'reader' && (
          <ReaderView chapter={selectedChapter} refreshVocab={refreshVocab} />
        )}
        {activeView === 'vocab' && (
          <VocabView vocab={vocab} refreshVocab={refreshVocab} />
        )}
        {activeView === 'review' && (
          <ReviewView vocab={vocab} books={books} refreshVocab={refreshVocab} />
        )}
      </main>
    </>
  );
}

function Sidebar({ activeView, setActiveView, books, selectedChapter, setSelectedChapter }: any) {
  const [expandedBooks, setExpandedBooks] = useState<Record<string, boolean>>({ 'nce1': true, 'nce2': true });

  const toggleBook = (bookId: string) => {
    setExpandedBooks(prev => ({ ...prev, [bookId]: !prev[bookId] }));
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="app-logo">
          <BrainCircuit size={28} color="#3b82f6" />
          NCE Master
        </div>
      </div>
      <div className="nav-menu" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
        <div style={{ padding: '16px 12px', flex: 1, overflowY: 'auto' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8, paddingLeft: 12, fontWeight: 700 }}>Menu</div>
            <div className={`nav-item ${activeView === 'vocab' ? 'active' : ''}`} onClick={() => setActiveView('vocab')}>
              <List size={20} /> My Vocabulary
            </div>
            <div className={`nav-item ${activeView === 'review' ? 'active' : ''}`} onClick={() => setActiveView('review')}>
              <CheckCircle size={20} /> Review <span style={{ marginLeft: 'auto', background: 'var(--accent)', color: 'white', borderRadius: 12, padding: '2px 8px', fontSize: '0.75rem' }}>SRS & Listening</span>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8, paddingLeft: 12, fontWeight: 700 }}>Materials</div>
          {books.map((book: any) => (
            <div key={book.id}>
              <div 
                className="nav-item" 
                onClick={() => toggleBook(book.id)}
                style={{ paddingLeft: 12, fontWeight: 600 }}
              >
                <BookOpen size={20} />
                {book.title}
                <ChevronRight size={16} style={{ marginLeft: 'auto', transform: expandedBooks[book.id] ? 'rotate(90deg)' : 'none', transition: '0.2s' }} />
              </div>
              {expandedBooks[book.id] && (
                <div style={{ paddingLeft: 16, borderLeft: '1px solid var(--border)', marginLeft: 22 }}>
                  {book.chapters.map((chap: any) => (
                    <div 
                      key={chap.id}
                      className={`nav-item ${activeView === 'reader' && selectedChapter?.id === chap.id ? 'active' : ''}`}
                      style={{ padding: '8px 12px', marginBottom: 4, fontSize: '0.9rem' }}
                      onClick={() => {
                        setSelectedChapter(chap);
                        setActiveView('reader');
                      }}
                    >
                      Chap {chap.id.split('-')[1]}: {chap.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div 
          className="nav-item" 
          onClick={() => window.api?.openBooksFolder && window.api.openBooksFolder()} 
          style={{ borderTop: '1px solid var(--glass-border)', borderRadius: 0, padding: '16px 24px', margin: 0, marginTop: 'auto', background: 'var(--bg-tertiary)' }}
        >
          📂 Open Books Folder
        </div>
      </div>
    </div>
  );
}

function ReaderView({ chapter, refreshVocab }: any) {
  const [popup, setPopup] = useState<{ word: string, phonetic: string, x: number, y: number } | null>(null);
  const [translStr, setTranslStr] = useState('');
  const [isLoadingDict, setIsLoadingDict] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    // Reset state on new chapter
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [chapter?.id]);

  if (!chapter) return <div className="glass-panel">Select a chapter from the sidebar.</div>;

  const togglePlay = () => {
    if (audioRef.current) {
        if (audioRef.current.paused) {
            audioRef.current.play().catch(e => console.error("Audio Playback Error:", e));
        } else {
            audioRef.current.pause();
        }
    }
  };

  const restartAudio = () => {
    if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(e => console.error("Audio Restart Error:", e));
    }
  };

  const handleTimeUpdate = () => {
      if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (audioRef.current && duration > 0) {
          const bounds = e.currentTarget.getBoundingClientRect();
          const percent = (e.clientX - bounds.left) / bounds.width;
          audioRef.current.currentTime = percent * duration;
      }
  };

  const formatTime = (time: number) => {
      if (!time || isNaN(time)) return "0:00";
      const m = Math.floor(time / 60);
      const s = Math.floor(time % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleWordClick = async (word: string, e: React.MouseEvent) => {
    const cleanWord = word.replace(/[.,!?;:'"()]/g, '').trim().toLowerCase();
    if (cleanWord.length > 0) {
      setPopup({ word: cleanWord, phonetic: '', x: Math.min(e.clientX, window.innerWidth - 250), y: Math.max(20, e.clientY - 90) });
      setTranslStr('自动查词中...');
      
      // Auto-lookup dictionary
      if (window.api) {
        setIsLoadingDict(true);
        try {
          const dictData = await window.api.lookupWord(cleanWord);
          if (dictData) {
            setTranslStr(dictData.meaning);
            setPopup(prev => prev ? { ...prev, phonetic: dictData.phonetic } : null);
          } else {
            setTranslStr('');
          }
        } catch (err) {
          console.error(err);
          setTranslStr('');
        } finally {
          setIsLoadingDict(false);
        }
      }
    }
  };

  const handleAddVocab = async () => {
    if (popup && window.api) {
      await window.api.addVocab({ word: popup.word, meaning: translStr || '待补充含义', phonetic: popup.phonetic });
      refreshVocab();
      setPopup(null);
    }
  };

  const lines = chapter.content.split('\n');

  return (
    <div className="glass-panel reader-container" onClick={() => popup && setPopup(null)}>
      <div className="reader-header">
        <h1 className="reader-title">{chapter.title}</h1>
        <p className="reader-subtitle">Chapter {chapter.id}</p>
        
        {chapter.audioUrl ? (
            <div style={{ marginTop: 24, maxWidth: 500, margin: '24px auto 0 auto', background: 'var(--bg-tertiary)', padding: '16px 24px', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 20, boxShadow: 'var(--shadow-sm)' }}>
                <audio 
                    ref={audioRef} 
                    src={chapter.audioUrl} 
                    preload="auto"
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={() => {
                        if (audioRef.current) setDuration(audioRef.current.duration);
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    onError={(e) => console.error("Audio load error", e)}
                />
                
                <button 
                  onClick={(e) => { e.stopPropagation(); togglePlay(); }} 
                  className="btn btn-primary" 
                  style={{ width: 48, height: 48, borderRadius: '50%', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}
                >
                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" style={{ marginLeft: 4 }} />}
                </button>
                
                <button 
                  onClick={(e) => { e.stopPropagation(); restartAudio(); }} 
                  className="btn" 
                  style={{ width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}
                >
                    <RotateCcw size={20} />
                </button>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div 
                      onClick={handleProgressBarClick}
                      style={{ background: 'var(--bg-primary)', height: 8, borderRadius: 4, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                    >
                        <div style={{ 
                            position: 'absolute', left: 0, top: 0, bottom: 0,
                            width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, 
                            background: 'var(--accent)', 
                            pointerEvents: 'none'
                        }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
            </div>
        ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 24 }}>Audio track not available for this chapter</div>
        )}
      </div>
      
      <div className="text-content">
        {lines.map((line: string, i: number) => (
          <p key={i}>
            {line.split(' ').map((word, j) => (
              <React.Fragment key={j}>
                <span 
                  className="text-word"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWordClick(word, e);
                  }}
                >
                  {word}
                </span>
                {' '}
              </React.Fragment>
            ))}
          </p>
        ))}
      </div>

      {popup && (
        <div 
          className="word-popup" 
          style={{ left: popup.x, top: popup.y }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>{popup.word}</span>
              {popup.phonetic && <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>/{popup.phonetic}/</span>}
            </div>
            <button className="btn" style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', color: 'white' }} onClick={(e) => { e.stopPropagation(); playTTS(popup.word); }}>
               🔊
            </button>
          </div>
          <input 
            type="text" 
            placeholder={isLoadingDict ? "查词中..." : "输入释义..."}
            value={translStr}
            onChange={(e) => setTranslStr(e.target.value)}
            disabled={isLoadingDict}
            style={{ width: '100%', marginBottom: 12, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'white', opacity: isLoadingDict ? 0.7 : 1 }} 
            autoFocus 
            onKeyDown={(e) => e.key === 'Enter' && handleAddVocab()}
          />
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAddVocab}>
            <Plus size={16} /> Add to Vocab
          </button>
        </div>
      )}
    </div>
  );
}

function VocabView({ vocab, refreshVocab }: any) {
  const handleRemove = async (word: string) => {
    if (window.api) {
      await window.api.removeVocab(word);
      refreshVocab();
    }
  };

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 className="reader-title" style={{ marginBottom: 32 }}>My Vocabulary ({vocab.length})</h2>
      {vocab.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No words added yet. Go read a chapter and click on some words!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {vocab.map((v: any) => (
            <div key={v.word} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
              <div style={{ flex: '0 0 150px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {v.word}
                  <button onClick={(e) => { e.stopPropagation(); playTTS(v.word); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>🔊</button>
                </div>
                {v.phonetic && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>/{v.phonetic}/</div>}
              </div>
              <div style={{ flex: 1, color: '#e2e8f0' }}>{v.meaning}</div>
              <div style={{ flex: '0 0 100px', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'right', marginRight: 16 }}>Level: {v.reviews}</div>
              <button 
                className="btn btn-danger" 
                style={{ padding: '6px 12px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(v.word);
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewView({ vocab, books, refreshVocab }: any) {
  const [activeTab, setActiveTab] = useState<'vocab' | 'listening'>('vocab');

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
            <button 
                onClick={() => setActiveTab('vocab')}
                className={`btn ${activeTab === 'vocab' ? 'btn-primary' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: activeTab === 'vocab' ? 'var(--accent)' : 'transparent', color: activeTab === 'vocab' ? 'white' : 'var(--text-secondary)', border: activeTab === 'vocab' ? 'none' : '1px solid var(--border)' }}
            >
                <BookA size={18} /> Vocab Cards
            </button>
            <button 
                onClick={() => setActiveTab('listening')}
                className={`btn ${activeTab === 'listening' ? 'btn-primary' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: activeTab === 'listening' ? 'var(--accent)' : 'transparent', color: activeTab === 'listening' ? 'white' : 'var(--text-secondary)', border: activeTab === 'listening' ? 'none' : '1px solid var(--border)' }}
            >
                <Headphones size={18} /> Listening Loop
            </button>
        </div>
        
        <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab === 'vocab' ? (
                <VocabInteractiveReview vocab={vocab} refreshVocab={refreshVocab} />
            ) : (
                <ListeningLoopReview books={books} />
            )}
        </div>
    </div>
  );
}

function VocabInteractiveReview({ vocab, refreshVocab }: any) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [failedCurrentSession, setFailedCurrentSession] = useState<Set<string>>(new Set());
  
  // Filter due words
  const dueWordsList = vocab.filter((v: any) => new Date(v.nextReview) <= new Date());
  const [activeQueue, setActiveQueue] = useState<any[]>(dueWordsList);

  useEffect(() => {
    setActiveQueue(vocab.filter((v: any) => new Date(v.nextReview) <= new Date()));
  }, [vocab]);

  if (activeQueue.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <CheckCircle size={64} color="var(--success)" style={{ marginBottom: 24 }} />
        <h2 className="reader-title">Congratulations!</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>You have completed all reviews for now.</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 8 }}>Total words learning: {vocab.length}</p>
      </div>
    );
  }

  const currentWord = activeQueue[currentIndex];

  const handleReveal = () => {
    setShowAnswer(true);
    playTTS(currentWord.word);
  };

  const handleChoice = async (success: boolean) => {
    if (window.api) {
      const trueSuccess = success && !failedCurrentSession.has(currentWord.word);
      
      if (!success && !failedCurrentSession.has(currentWord.word)) {
        await window.api.updateVocabReview(currentWord.word, false);
      } else if (success) {
        await window.api.updateVocabReview(currentWord.word, trueSuccess);
      }
      
      if (success) {
        setActiveQueue(prev => prev.filter(w => w.word !== currentWord.word));
        if (currentIndex >= activeQueue.length - 1) {
          setCurrentIndex(0);
        }
      } else {
        setFailedCurrentSession(prev => new Set(prev).add(currentWord.word));
        setCurrentIndex((currentIndex + 1) % activeQueue.length);
      }
      refreshVocab();
    }
    
    setShowAnswer(false);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ padding: '0px 0 20px 0', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '1.1rem' }}>
        Reviewing: <span style={{ color: 'var(--text-primary)' }}>{activeQueue.length}</span> words left
      </div>
      
      <div style={{ flex: 1, display: 'flex', width: '100%', maxWidth: '600px', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '40px 30px', boxShadow: 'var(--shadow-md)', textAlign: 'center', transition: 'all 0.3s' }}>
          
          <h2 style={{ fontSize: '3.5rem', fontWeight: 700, color: 'white', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
             {currentWord.word}
             <button onClick={(e) => { e.stopPropagation(); playTTS(currentWord.word); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>🔊</button>
          </h2>
          {currentWord.phonetic && <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: 20 }}>/{currentWord.phonetic}/</div>}
          
          <div style={{ marginTop: '30px', opacity: showAnswer ? 1 : 0, transition: 'opacity 0.2s', minHeight: '80px' }}>
             {showAnswer && (
               <div style={{ fontSize: '1.4rem', color: '#e2e8f0', padding: '15px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 12, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  {currentWord.meaning}
               </div>
             )}
          </div>
          
        </div>
        
        <div style={{ marginTop: '30px', display: 'flex', width: '100%', gap: 16 }}>
          {!showAnswer ? (
             <button 
               onClick={handleReveal}
               className="btn btn-primary"
               style={{ width: '100%', padding: '16px', fontSize: '1.2rem', borderRadius: 'var(--radius-lg)' }}
             >
               👀 Show Answer
             </button>
          ) : (
             <>
               <button 
                 onClick={() => handleChoice(false)}
                 className="btn"
                 style={{ flex: 1, padding: '16px', fontSize: '1.1rem', borderRadius: 'var(--radius-lg)', background: '#ef4444', color: 'white', border: 'none' }}
               >
                 😭 Forgot
               </button>
               <button 
                 onClick={() => handleChoice(true)}
                 className="btn"
                 style={{ flex: 1, padding: '16px', fontSize: '1.1rem', borderRadius: 'var(--radius-lg)', background: '#10b981', color: 'white', border: 'none' }}
               >
                 😊 Knew it
               </button>
             </>
          )}
        </div>
      </div>
    </div>
  );
}

function ListeningLoopReview({ books }: { books: any[] }) {
    const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
    const [playlist, setPlaylist] = useState<any[]>([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    
    // Build chapters flat list
    const allChapters = books.flatMap(b => b.chapters.map((c: any) => ({ ...c, bookTitle: b.title })));
    
    const toggleChapterSelection = (chapId: string) => {
        const newSet = new Set(selectedChapters);
        if (newSet.has(chapId)) newSet.delete(chapId);
        else newSet.add(chapId);
        setSelectedChapters(newSet);
    };

    const toggleAllChapters = () => {
        if (selectedChapters.size === allChapters.length) {
            setSelectedChapters(new Set());
        } else {
            setSelectedChapters(new Set(allChapters.map(c => c.id)));
        }
    };

    const startLoop = () => {
        const selectedList = allChapters.filter(c => selectedChapters.has(c.id) && c.audioUrl);
        if (selectedList.length === 0) return alert("Please select chapters that have audio resources available.");
        setPlaylist(selectedList);
        setCurrentTrackIndex(0);
        setIsPlaying(true);
    };

    const stopLoop = () => {
        setPlaylist([]);
        setIsPlaying(false);
        if (audioRef.current) audioRef.current.pause();
    };

    const handleNextTrack = () => {
        if (playlist.length > 0) {
            setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
        }
    };

    useEffect(() => {
        if (playlist.length > 0 && isPlaying && audioRef.current) {
            audioRef.current.play().catch(e => console.error("Loop Playback err:", e));
        }
    }, [currentTrackIndex, playlist, isPlaying]);

    if (playlist.length > 0) {
        const currentTrack = playlist[currentTrackIndex];
        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <audio 
                    ref={audioRef}
                    src={currentTrack.audioUrl}
                    onEnded={handleNextTrack}
                    onError={handleNextTrack} // skip broken audio
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                />
                <div style={{ background: 'var(--bg-tertiary)', width: '100%', maxWidth: 500, padding: 32, borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', textAlign: 'center', position: 'relative' }}>
                    
                    <button onClick={stopLoop} className="btn btn-danger" style={{ position: 'absolute', top: 16, right: 16 }}>Exit Loop</button>
                    
                    <Headphones size={64} color="var(--accent)" style={{ margin: '0 auto 24px auto', opacity: isPlaying ? 1 : 0.5, transition: '0.3s' }} />
                    <h3 style={{ fontSize: '1.5rem', color: 'white', marginBottom: 8 }}>{currentTrack.title}</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>{currentTrack.bookTitle} - Chapter {currentTrack.id}</p>
                    <div style={{ color: 'var(--accent)', marginTop: 8, fontSize: '0.9rem', fontWeight: 600 }}>Track {currentTrackIndex + 1} of {playlist.length}</div>
                    
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, marginTop: 32 }}>
                        <button 
                            onClick={() => {
                                if (audioRef.current) {
                                    isPlaying ? audioRef.current.pause() : audioRef.current.play();
                                }
                            }}
                            className="btn btn-primary" 
                            style={{ width: 64, height: 64, borderRadius: '50%', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                        >
                            {isPlaying ? <Pause size={32} /> : <Play size={32} style={{ marginLeft: 6 }} />}
                        </button>
                        <button 
                            onClick={handleNextTrack}
                            className="btn" 
                            style={{ width: 48, height: 48, borderRadius: '50%', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-primary)' }}
                            title="Skip to next chapter"
                        >
                            <SkipForward size={24} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: '1.4rem', color: 'white' }}>Select chapters for listening loop</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>The player will continuously loop the selected audio tracks.</p>
                </div>
                <button 
                    onClick={startLoop}
                    className="btn btn-primary"
                    disabled={selectedChapters.size === 0}
                    style={{ padding: '12px 24px', fontSize: '1rem', opacity: selectedChapters.size === 0 ? 0.5 : 1 }}
                >
                    <Play size={18} /> Start Infinite Loop
                </button>
            </div>
            
            <button className="btn" onClick={toggleAllChapters} style={{ alignSelf: 'flex-start', marginBottom: 16 }}>
                {selectedChapters.size === allChapters.length ? "Deselect All" : "Select All"}
            </button>
            
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {allChapters.map(c => {
                    const isSelected = selectedChapters.has(c.id);
                    const hasAudio = !!c.audioUrl;
                    return (
                        <div 
                            key={c.id} 
                            onClick={() => hasAudio && toggleChapterSelection(c.id)}
                            style={{ 
                                display: 'flex', alignItems: 'center', gap: 16, 
                                background: 'var(--bg-tertiary)', padding: '12px 16px', 
                                borderRadius: 'var(--radius-sm)', border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                                cursor: hasAudio ? 'pointer' : 'not-allowed', opacity: hasAudio ? 1 : 0.5
                            }}
                        >
                            <div style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--text-secondary)', background: isSelected ? 'var(--accent)' : 'transparent', borderColor: isSelected ? 'var(--accent)' : 'var(--text-secondary)' }}>
                                {isSelected && <CheckCircle size={14} color="white" />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ color: 'white', fontWeight: 600 }}>{c.title}</div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{c.bookTitle} - Chapter {c.id}</div>
                            </div>
                            {hasAudio ? <Headphones size={20} color="var(--text-primary)" /> : <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No Audio</div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default App;
