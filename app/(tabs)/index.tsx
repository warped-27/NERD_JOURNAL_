import React, { useState, useEffect, useMemo } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  Pressable, 
  TextInput, 
  useColorScheme, 
  Dimensions, 
  Platform, 
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Palette } from '../../constants/Colors';
import { SecureStorage, CloudConfig } from '../../constants/SecureStorage';
import { CryptoEngine } from '../../constants/CryptoEngine';
import { AIEngine } from '../../constants/AIEngine';
import { CloudSyncEngine } from '../../constants/CloudSyncEngine';

interface NoteItem {
  id: string;
  title: string;
  excerpt: string;
  content: string; // Testo completo originale
  date: string;
  tags: string[];
  pastelAccent: {
    light: string;
    dark: string;
  };
  isAnalyzing?: boolean;
  syncStatus: 'none' | 'syncing' | 'synced' | 'local_only';
  isFavorite?: boolean;
}

// Note simulate memorizzate nello storage cifrato fittizio dell'utente.
const INITIAL_NOTES: NoteItem[] = [
  {
    id: '1',
    title: 'Riflessioni BYO-Cloud',
    excerpt: 'Analisi sui vantaggi del modello BYO-Cloud...',
    content: 'Analisi sui vantaggi del modello BYO-Cloud. L\'assenza di server proprietari elimina i costi di manutenzione e garantisce la sovranità dei dati all\'utente. I file vengono cifrati sul dispositivo e caricati direttamente sullo storage privato dell\'utente.',
    date: 'Oggi, 08:30',
    tags: ['Architettura', 'Sintesi-AI'],
    pastelAccent: {
      light: '#e8f5e9', // Salvia tenue
      dark: '#1b2e24',  // Salvia scuro
    },
    syncStatus: 'synced',
    isFavorite: true,
  },
  {
    id: '2',
    title: 'Vocale: Idee Startup',
    excerpt: 'Trascrizione crittografata locale della discussione...',
    content: 'Trascrizione crittografata locale. Discussione sulle funzionalità principali di JournalAI: crittografia client-side AES-GCM e derivazione con PBKDF2 per garantire la massima riservatezza delle registrazioni.',
    date: 'Ieri, 18:15',
    tags: ['Vocale', 'Analisi-AI'],
    pastelAccent: {
      light: '#e3f2fd', // Carta da zucchero tenue
      dark: '#162b3d',  // Carta da zucchero scuro
    },
    syncStatus: 'synced',
    isFavorite: false,
  },
  {
    id: '3',
    title: 'Studio Modelli Locali',
    excerpt: 'Valutazione delle prestazioni di Ollama offline...',
    content: 'Valutazione delle prestazioni di Ollama e modelli offline (Phi-4, Llama 3) su dispositivi mobili. Analisi della latenza ottimale per la generazione di tag e riassunti automatici senza alcuna connessione internet.',
    date: '28 Mag',
    tags: ['Modelli', 'Ricerca'],
    pastelAccent: {
      light: '#f3e5f5', // Lilla tenue
      dark: '#2d1b33',  // Lilla scuro
    },
    syncStatus: 'synced',
    isFavorite: true,
  },
  {
    id: '4',
    title: 'Integrazione WebDAV',
    excerpt: 'Sincronizzazione incrementale dei file JSON cifrati...',
    content: 'Sincronizzazione incrementale dei file JSON cifrati. Algoritmo di risoluzione dei conflitti basato su timestamp locali e verifica della firma digitale per evitare perdite di dati in modalità Last Write Wins.',
    date: '24 Mag',
    tags: ['Storage', 'Sync'],
    pastelAccent: {
      light: '#fff3e0', // Pesca tenue
      dark: '#3d2516',  // Pesca scuro
    },
    syncStatus: 'synced',
    isFavorite: false,
  }
];

// Filtro 'Cifrati' rimosso in quanto ridondante (tutto è cifrato)
const FILTER_TABS = ['Tutti', 'Secondo Cervello', 'Preferiti'];

export default function DashboardScreen() {
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';
  const currentTheme = isDark ? Palette.dark : Palette.light;
  
  const [selectedFilter, setSelectedFilter] = useState('Tutti');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Stato lista note e configurazione cloud
  const [rawNotes, setRawNotes] = useState<NoteItem[]>(INITIAL_NOTES);
  const [processedNotes, setProcessedNotes] = useState<NoteItem[]>([]);
  const [cloudConfig, setCloudConfig] = useState<CloudConfig | null>(null);

  // Stati crittografici
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [masterPassword, setMasterPassword] = useState<string | null>(null);
  const [derivedKey, setDerivedKey] = useState<Uint8Array | null>(null);

  // Stati per la creazione nuova nota
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [micFeedback, setMicFeedback] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<any>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [ragResponse, setRagResponse] = useState<string | null>(null);
  const [isRAGLoading, setIsRAGLoading] = useState(false);
  const [ragQuery, setRagQuery] = useState('');

  // Stati per la visualizzazione/modifica nota esistente
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [editNoteTitle, setEditNoteTitle] = useState('');
  const [editNoteContent, setEditNoteContent] = useState('');

  // Carica la Master Password all'avvio e ad ogni focus
  useEffect(() => {
    async function checkKeyAndDecrypt() {
      const pwd = await SecureStorage.getMasterPassword();
      setMasterPassword(pwd);

      if (pwd && pwd.trim() !== '') {
        try {
          const key = await CryptoEngine.deriveKey(pwd);
          setDerivedKey(key);
          setIsUnlocked(true);

          const processed = await Promise.all(
            rawNotes.map(async (note) => {
              if (note.isAnalyzing) {
                return note;
              }
              // Cifratura + Decifratura live per testare il motore
              const encryptedTitle = await CryptoEngine.encryptNote(note.title, key);
              const encryptedContent = await CryptoEngine.encryptNote(note.content, key);
              const decryptedTitle = await CryptoEngine.decryptNote(encryptedTitle.ciphertext, encryptedTitle.iv, key);
              const decryptedContent = await CryptoEngine.decryptNote(encryptedContent.ciphertext, encryptedContent.iv, key);
              
              return {
                ...note,
                title: decryptedTitle,
                content: decryptedContent,
              };
            })
          );
          setProcessedNotes(processed);
        } catch (error) {
          console.error('[CryptoEngine] Errore nella pipeline crittografica:', error);
          setIsUnlocked(false);
          setProcessedNotes(maskNotesList(rawNotes));
        }
      } else {
        setIsUnlocked(false);
        setDerivedKey(null);
        setProcessedNotes(maskNotesList(rawNotes));
      }
    }

    checkKeyAndDecrypt();
  }, [rawNotes, masterPassword]);

  // Polling per mantenere lo stato dello Storage (Password + Cloud) allineato
  useEffect(() => {
    async function updateStorageState() {
      const pwd = await SecureStorage.getMasterPassword();
      if (pwd !== masterPassword) {
        setMasterPassword(pwd);
      }
      const cloud = await SecureStorage.getCloudConfig();
      setCloudConfig(cloud);
    }
    updateStorageState();

    const interval = setInterval(updateStorageState, 1000);
    return () => clearInterval(interval);
  }, [masterPassword]);

  // Maschera i caratteri alfanumerici salvaguardando la spaziatura ed il layout geometrico
  const maskText = (text: string) => {
    return text.replace(/[a-zA-Z0-9]/g, '•');
  };

  const maskNotesList = (notes: NoteItem[]): NoteItem[] => {
    return notes.map(note => ({
      ...note,
      title: maskText(note.title),
      excerpt: maskText(note.excerpt),
      content: maskText(note.content),
    }));
  };

  // Restituisce il nome leggibile del provider
  const getCloudName = (provider?: string) => {
    if (provider === 'google_drive') return 'G-Drive';
    if (provider === 'icloud') return 'iCloud';
    if (provider === 'webdav') return 'WebDAV';
    return 'Cloud';
  };

  // Creazione della nota cifrata con trigger IA in background e Sync (Optimistic UI)
  const handleCreateNote = async () => {
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;

    const noteId = Date.now().toString();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = `Oggi, ${timeStr}`;

    const newNote: NoteItem = {
      id: noteId,
      title: newNoteTitle,
      excerpt: newNoteContent.substring(0, 50) + '...', // Anteprima temporanea
      content: newNoteContent,
      date: dateStr,
      tags: [],
      pastelAccent: { light: '#f4f4f5', dark: '#27272a' },
      isAnalyzing: true,
      syncStatus: 'none',
      isFavorite: false,
    };

    setIsModalVisible(false);
    setNewNoteTitle('');
    setNewNoteContent('');
    setIsRecording(false);

    // Salva immediatamente la nota locale nello stato (Optimistic UI)
    setRawNotes((prev) => [newNote, ...prev]);

    // Esegui in background elaborazione IA + Sincronizzazione Cloud
    (async () => {
      let finalExcerpt = newNoteContent;
      let finalTags = ['Nota Locale'];
      let finalColor = { light: '#e8f5e9', dark: '#1b2e24' };

      // Passaggio 1: Generazione degli Insights IA
      try {
        const aiConfig = await SecureStorage.getAIConfig();
        const insights = await AIEngine.generateNoteInsights(newNoteContent, aiConfig);
        finalExcerpt = insights.summary;
        finalTags = insights.tags;
        finalColor = insights.color;
      } catch (err) {
        console.warn('[AIEngine] Errore in background:', err);
      }

      // Aggiorna lo stato visivo della nota rimuovendo il loading IA e impostando lo stato a 'syncing'
      setRawNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? {
                ...n,
                excerpt: finalExcerpt,
                tags: finalTags,
                pastelAccent: finalColor,
                isAnalyzing: false,
                syncStatus: 'syncing',
              }
            : n
        )
      );

      // Passaggio 2: Cifratura Zero-Knowledge ed invio al Cloud
      try {
        const cloudConf = await SecureStorage.getCloudConfig();
        
        let encryptedPayload = '';
        if (derivedKey) {
          // Cifra localmente prima dell'upload
          const encTitle = await CryptoEngine.encryptNote(newNote.title, derivedKey);
          const encContent = await CryptoEngine.encryptNote(newNote.content, derivedKey);
          encryptedPayload = JSON.stringify({
            titleCipher: encTitle.ciphertext,
            titleIv: encTitle.iv,
            contentCipher: encContent.ciphertext,
            contentIv: encContent.iv,
            date: dateStr,
            tags: finalTags,
            lastUpdated: Date.now(),
          });
        } else {
          encryptedPayload = JSON.stringify({
            title: newNote.title,
            content: newNote.content,
            date: dateStr,
            tags: finalTags,
            lastUpdated: Date.now(),
          });
        }

        const uploadSuccess = await CloudSyncEngine.uploadEncryptedPayload(noteId, encryptedPayload, cloudConf);

        // Aggiorna lo stato di sincronizzazione finale della nota
        setRawNotes((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? {
                  ...n,
                  syncStatus: uploadSuccess ? 'synced' : 'local_only',
                }
              : n
          )
        );
      } catch (syncErr) {
        console.warn('[Sync] Errore caricamento:', syncErr);
        setRawNotes((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? {
                  ...n,
                  syncStatus: 'local_only',
                }
              : n
          )
        );
      }
    })();
  };

  // Salvataggio della nota modificata con re-trigger dell'IA in background
  const handleSaveEdit = async () => {
    if (!selectedNote || !editNoteTitle.trim() || !editNoteContent.trim()) return;

    const noteId = selectedNote.id;
    setIsViewModalVisible(false);

    // Aggiorna lo stato localmente all'istante
    setRawNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? {
              ...n,
              title: editNoteTitle,
              content: editNoteContent,
              isAnalyzing: true,
              syncStatus: 'none',
            }
          : n
      )
    );

    // Esegui elaborazione asincrona in background
    (async () => {
      let finalExcerpt = editNoteContent;
      let finalTags = ['Nota Locale'];
      let finalColor = { light: '#e8f5e9', dark: '#1b2e24' };

      try {
        const aiConfig = await SecureStorage.getAIConfig();
        const insights = await AIEngine.generateNoteInsights(editNoteContent, aiConfig);
        finalExcerpt = insights.summary;
        finalTags = insights.tags;
        finalColor = insights.color;
      } catch (err) {
        console.warn('[AIEngine] Errore in background durante la modifica:', err);
      }

      setRawNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? {
                ...n,
                excerpt: finalExcerpt,
                tags: finalTags,
                pastelAccent: finalColor,
                isAnalyzing: false,
                syncStatus: 'syncing',
              }
            : n
        )
      );

      // Caricamento cloud del payload modificato
      try {
        const cloudConf = await SecureStorage.getCloudConfig();
        let encryptedPayload = '';

        if (derivedKey) {
          const encTitle = await CryptoEngine.encryptNote(editNoteTitle, derivedKey);
          const encContent = await CryptoEngine.encryptNote(editNoteContent, derivedKey);
          encryptedPayload = JSON.stringify({
            titleCipher: encTitle.ciphertext,
            titleIv: encTitle.iv,
            contentCipher: encContent.ciphertext,
            contentIv: encContent.iv,
            date: selectedNote.date,
            tags: finalTags,
            lastUpdated: Date.now(),
          });
        } else {
          encryptedPayload = JSON.stringify({
            title: editNoteTitle,
            content: editNoteContent,
            date: selectedNote.date,
            tags: finalTags,
            lastUpdated: Date.now(),
          });
        }

        const uploadSuccess = await CloudSyncEngine.uploadEncryptedPayload(noteId, encryptedPayload, cloudConf);

        setRawNotes((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? {
                  ...n,
                  syncStatus: uploadSuccess ? 'synced' : 'local_only',
                }
              : n
          )
        );
      } catch (syncErr) {
        console.warn('[Sync] Errore caricamento modifica:', syncErr);
        setRawNotes((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? {
                  ...n,
                  syncStatus: 'local_only',
                }
              : n
          )
        );
      }
    })();

    setSelectedNote(null);
  };

  const handleDeleteNote = (noteId: string) => {
    setRawNotes((prev) => prev.filter((n) => n.id !== noteId));
    setIsViewModalVisible(false);
    setSelectedNote(null);
  };

  const toggleFavorite = (noteId: string) => {
    setRawNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, isFavorite: !n.isFavorite } : n))
    );
    // Aggiorna anche lo stato visualizzato locale del modal
    if (selectedNote && selectedNote.id === noteId) {
      setSelectedNote(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null);
    }
  };

  // Avvia la registrazione audio nativa nel browser
  const startRecording = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("La registrazione audio non è supportata su questo browser o piattaforma.");
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (typeof MediaRecorder !== 'undefined') {
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        recorder.onstop = async () => {
          // Ferma tutte le tracce audio per rilasciare il microfono
          stream.getTracks().forEach(track => track.stop());

          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          setIsTranscribing(true);

          try {
            const aiConfig = await SecureStorage.getAIConfig();
            const text = await AIEngine.processAudio(audioBlob, aiConfig);
            setNewNoteContent((prev) => prev ? `${prev} ${text}` : text);
          } catch (err: any) {
            alert(`Errore di trascrizione: ${err.message || err}`);
          } finally {
            setIsTranscribing(false);
          }
        };

        recorder.start();
        setMediaRecorder(recorder);
        setIsRecording(true);
      } else {
        alert("MediaRecorder non supportato in questo browser.");
      }
    } catch (err) {
      console.error("Errore avvio registrazione:", err);
      alert("Impossibile accedere al microfono. Verifica i permessi.");
    }
  };

  // Ferma la registrazione audio
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  // Gestione click del microfono con feedback pastello
  const handleMicClick = async () => {
    setMicFeedback(true);
    setTimeout(() => setMicFeedback(false), 400);

    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  // Estrae tutti i tag e conta quante note li possiedono
  const tagList = useMemo(() => {
    const counts: Record<string, number> = {};
    processedNotes.forEach(note => {
      if (isUnlocked && note.tags) {
        note.tags.forEach(tag => {
          if (tag && tag.trim() !== '') {
            counts[tag] = (counts[tag] || 0) + 1;
          }
        });
      }
    });
    return Object.keys(counts).map(name => ({
      name,
      count: counts[name]
    })).sort((a, b) => b.count - a.count);
  }, [processedNotes, isUnlocked]);

  // Generatore di colori deterministici per i macro-tag
  const getTagColor = (tagName: string) => {
    const colors = [
      { light: '#e8f5e9', dark: '#1b2e24' }, // Salvia
      { light: '#e3f2fd', dark: '#162b3d' }, // Azzurro
      { light: '#f3e5f5', dark: '#2d1b33' }, // Lilla
      { light: '#fff3e0', dark: '#3d2516' }, // Pesca
      { light: '#ffebee', dark: '#2d1a1a' }, // Rosa
    ];
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
      hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  };

  const handleRAGSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsRAGLoading(true);
    setRagResponse(null);

    try {
      const aiConfig = await SecureStorage.getAIConfig();
      const notesForRAG = processedNotes.map(n => ({
        title: n.title,
        content: n.content || n.excerpt
      }));

      const reply = await AIEngine.chatWithNotes(queryText, notesForRAG, aiConfig);
      setRagResponse(reply);
    } catch (err: any) {
      console.error(err);
      setRagResponse(`Errore nell'interrogazione del Secondo Cervello: ${err.message || err}`);
    } finally {
      setIsRAGLoading(false);
    }
  };

  const handleTagClick = (tagName: string) => {
    setRagQuery(tagName);
    handleRAGSearch(tagName);
  };

  // Reset risposta RAG quando cambia il filtro
  useEffect(() => {
    setRagResponse(null);
  }, [selectedFilter]);

  // Funzione per cancellare il testo inserito
  const handleClearSearch = () => {
    if (selectedFilter === 'Secondo Cervello') {
      setRagQuery('');
      setRagResponse(null);
      setIsRAGLoading(false);
    } else {
      setSearchQuery('');
    }
  };

  // Logica di Filtraggio delle Note in base al tab selezionato e alla barra di ricerca
  const filteredNotes = processedNotes.filter((note) => {
    // 1. Filtro per Tab attiva
    if (selectedFilter === 'Secondo Cervello') {
      // Mostra solo le note analizzate con successo dall'IA (che possiedono tag e non sono in corso di analisi)
      if (note.isAnalyzing || note.tags.length === 0 || note.tags.includes('Locale')) {
        return false;
      }
    } else if (selectedFilter === 'Preferiti') {
      // Mostra solo le note contrassegnate come preferite
      if (!note.isFavorite) return false;
    }

    // 2. Filtro di ricerca testuale (titolo o riassunto)
    const activeQuery = selectedFilter === 'Secondo Cervello' ? ragQuery : searchQuery;
    if (activeQuery.trim() !== '') {
      const query = activeQuery.toLowerCase();
      const matchTitle = note.title.toLowerCase().includes(query);
      const matchContent = (note.content || '').toLowerCase().includes(query);
      return matchTitle || matchContent;
    }

    return true;
  });

  const renderCard = ({ item }: { item: NoteItem }) => {
    const cardAccent = isDark ? item.pastelAccent.dark : item.pastelAccent.light;
    
    return (
      <TouchableOpacity 
        onPress={() => {
          if (isUnlocked) {
            setSelectedNote(item);
            setEditNoteTitle(item.title);
            setEditNoteContent(item.content || item.excerpt);
            setIsViewModalVisible(true);
          }
        }}
        activeOpacity={0.7}
        disabled={!isUnlocked}
        style={[
          styles.card, 
          { 
            backgroundColor: currentTheme.surface, 
            borderColor: currentTheme.border,
            borderLeftColor: cardAccent,
            opacity: isUnlocked ? 1 : 0.75,
          }
        ]}
      >
        {/* Card Header: Stato e Data */}
        <View style={styles.cardHeader}>
          <View style={styles.cryptoBadge}>
            <Text style={[styles.cryptoIcon, { color: isUnlocked ? '#10b981' : '#f59e0b' }]}>
              {isUnlocked ? '🔓' : '🔒'}
            </Text>
            <Text style={[styles.cryptoText, { color: currentTheme.textSecondary }]}>
              {isUnlocked ? (item.isAnalyzing ? 'CRITTOGRAFATO' : 'DECIFRATO') : 'AES-256'}
            </Text>
          </View>
          <Text style={[styles.cardDate, { color: currentTheme.textSecondary }]}>{item.date}</Text>
        </View>

        {/* Card Title */}
        <Text 
          style={[styles.cardTitle, { color: currentTheme.textPrimary }]} 
          numberOfLines={2}
        >
          {item.title}
        </Text>

        {/* Card Excerpt */}
        <Text 
          style={[styles.cardExcerpt, { color: currentTheme.textSecondary }]} 
          numberOfLines={4}
        >
          {item.excerpt}
        </Text>

        {/* Card Footer: AI Tags & Sync Status */}
        <View style={styles.cardFooter}>
          {item.isAnalyzing ? (
            <View style={[styles.tagBadge, { backgroundColor: isDark ? '#27272a' : '#f4f4f5', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
              <Text style={[styles.tagText, { color: currentTheme.textSecondary }]}>
                🔄 IA sta analizzando...
              </Text>
            </View>
          ) : (
            <View style={styles.footerInner}>
              {/* Riga dei Tag */}
              <View style={styles.tagsRow}>
                {item.tags.map((tag, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.tagBadge, 
                      { backgroundColor: cardAccent }
                    ]}
                  >
                    <Text 
                      style={[
                        styles.tagText, 
                        { color: isDark ? '#a1a1aa' : '#52525b' }
                      ]}
                    >
                      ✦ {isUnlocked ? tag : maskText(tag)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Riga del Cloud Sync */}
              {isUnlocked && (
                <View style={styles.syncContainer}>
                  {item.syncStatus === 'syncing' && (
                    <Text style={[styles.syncText, { color: currentTheme.textSecondary }]}>
                      ☁️ Sincronizzazione...
                    </Text>
                  )}
                  {item.syncStatus === 'synced' && (
                    <Text style={[styles.syncText, { color: '#10b981' }]}>
                      ✔ Salvato su {getCloudName(cloudConfig?.provider)}
                    </Text>
                  )}
                  {item.syncStatus === 'local_only' && (
                    <Text style={[styles.syncText, { color: isDark ? '#a1a1aa' : '#71717a' }]}>
                      ⚠️ Solo locale
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.background }]} edges={['top']}>
      {/* Top Header */}
      <View style={[styles.header, { borderColor: currentTheme.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: currentTheme.textPrimary }]}>JournalAI</Text>
          <Text style={[styles.headerSubtitle, { color: currentTheme.textSecondary }]}>spazio_di_lavoro / locale</Text>
        </View>
        
        {/* Cryptographic Node Status */}
        <View style={[styles.statusNode, { borderColor: currentTheme.border, backgroundColor: currentTheme.surface }]}>
          <View style={[styles.statusDot, { backgroundColor: isUnlocked ? '#10b981' : '#ef4444' }]} />
          <Text style={[styles.statusText, { color: currentTheme.textPrimary }]}>
            {isUnlocked ? 'Chiave Derivata' : 'Zero-Knowledge'}
          </Text>
        </View>
      </View>

      {/* Warning Banner se il diario è bloccato */}
      {!isUnlocked && (
        <View style={styles.warningContainer}>
          <View style={[
            styles.warningBadge, 
            { 
              backgroundColor: isDark ? '#3d2516' : '#fff3e0', 
              borderColor: isDark ? '#5c3e21' : '#ffe0b2' 
            }
          ]}>
            <Text style={[styles.warningText, { color: isDark ? '#ffcc80' : '#e65100' }]}>
              🔒 Sblocca il diario inserendo la Master Password nelle Impostazioni
            </Text>
          </View>
        </View>
      )}

      {/* Workspace Controls: Search & Tabs */}
      <View style={styles.controlsContainer}>
        {/* Academic Style Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: currentTheme.surface, borderColor: currentTheme.border }]}>
          <Text style={[styles.searchIcon, { color: currentTheme.textSecondary }]}>🔍</Text>
          <TextInput
            placeholder={isUnlocked ? (selectedFilter === 'Secondo Cervello' ? "Chiedi al Secondo Cervello..." : "Cerca nei tuoi quaderni...") : "Sblocca per cercare..."}
            placeholderTextColor={currentTheme.textSecondary}
            value={selectedFilter === 'Secondo Cervello' ? ragQuery : searchQuery}
            onChangeText={(text) => {
              if (selectedFilter === 'Secondo Cervello') {
                setRagQuery(text);
                if (text.trim() === '') {
                  setRagResponse(null);
                }
              } else {
                setSearchQuery(text);
              }
            }}
            editable={isUnlocked}
            returnKeyType={selectedFilter === 'Secondo Cervello' ? 'search' : 'default'}
            onSubmitEditing={() => {
              if (selectedFilter === 'Secondo Cervello') {
                handleRAGSearch(ragQuery);
              }
            }}
            style={[styles.searchInput, { color: currentTheme.textPrimary }]}
          />
          {((selectedFilter === 'Secondo Cervello' ? ragQuery : searchQuery).trim().length > 0) && (
            <TouchableOpacity 
              onPress={handleClearSearch} 
              style={styles.clearSearchBtn}
              activeOpacity={0.7}
            >
              <Text style={{ color: currentTheme.textSecondary, fontSize: 18, fontWeight: '600' }}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Filters */}
        <View style={styles.tabFilters}>
          {FILTER_TABS.map((tab) => {
            const isActive = selectedFilter === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => isUnlocked && setSelectedFilter(tab)}
                disabled={!isUnlocked}
                style={[
                  styles.tabButton,
                  isActive && { 
                    backgroundColor: isDark ? '#1a2730' : '#e0f2fe',
                    borderColor: currentTheme.textPrimary,
                  },
                  !isUnlocked && { opacity: 0.5 }
                ]}
              >
                <Text 
                  style={[
                    styles.tabButtonText, 
                    { 
                      color: isActive ? currentTheme.textPrimary : currentTheme.textSecondary,
                      fontWeight: isActive ? '600' : '400'
                    }
                  ]}
                >
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Helper per la risposta RAG */}
      {(() => {
        const renderRAGResponseHeader = () => {
          if (!isRAGLoading && !ragResponse) return null;

          return (
            <View style={styles.ragResponseWrapper}>
              <View style={styles.ragHeaderTitleRow}>
                <Text style={styles.ragHeaderTitle}>🧠 Risposta del Secondo Cervello</Text>
                {isRAGLoading && <ActivityIndicator size="small" color="#93c5fd" />}
              </View>
              
              {isRAGLoading ? (
                <Text style={styles.ragLoadingText}>Interrogando il Secondo Cervello...</Text>
              ) : (
                <Text style={styles.ragResponseText}>{ragResponse}</Text>
              )}
              
              {!isRAGLoading && (
                <Text style={[styles.ragContextTitle, { color: currentTheme.textSecondary }]}>
                  Appunti usati come contesto:
                </Text>
              )}
            </View>
          );
        };

        if (selectedFilter === 'Secondo Cervello' && !ragQuery.trim() && !isRAGLoading && !ragResponse) {
          return (
            /* Stato Inattivo: Griglia di Macro-Tag */
            <ScrollView contentContainerStyle={styles.insightsDashboardContainer} showsVerticalScrollIndicator={false}>
              <View style={styles.insightsDashboard}>
                <Text style={[styles.insightsTitle, { color: currentTheme.textPrimary }]}>
                  🧠 Secondo Cervello
                </Text>
                <Text style={[styles.insightsDesc, { color: currentTheme.textSecondary }]}>
                  Usa il RAG locale per interrogare i tuoi appunti cifrati. Poni una domanda nella barra di ricerca, oppure seleziona uno dei macro-temi ricavati dall'IA.
                </Text>
                
                {tagList.length === 0 ? (
                  <View style={[styles.emptyInsights, { borderColor: currentTheme.border, backgroundColor: currentTheme.surface }]}>
                    <Text style={{ color: currentTheme.textSecondary, textAlign: 'center', fontSize: 13 }}>
                      Nessun insight disponibile. L'IA analizzerà automaticamente le note appena create per estrarne i tag principali.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.tagGrid}>
                    {tagList.map((tag) => {
                      const colors = getTagColor(tag.name);
                      const tagBg = isDark ? colors.dark : colors.light;
                      const tagBorder = currentTheme.border;
                      
                      return (
                        <TouchableOpacity
                          key={tag.name}
                          onPress={() => handleTagClick(tag.name)}
                          activeOpacity={0.7}
                          style={[
                            styles.tagCard,
                            {
                              backgroundColor: tagBg,
                              borderColor: tagBorder,
                            }
                          ]}
                        >
                          <Text style={[styles.tagCardIcon, { color: currentTheme.textPrimary }]}>✦</Text>
                          <Text style={[styles.tagCardName, { color: currentTheme.textPrimary }]} numberOfLines={2}>
                            {tag.name}
                          </Text>
                          <Text style={[styles.tagCardCount, { color: isDark ? '#a1a1aa' : '#71717a' }]}>
                            {tag.count} {tag.count === 1 ? 'nota' : 'note'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>
          );
        }

        return (
          /* Lista Normale (Tutti / Preferiti) OPPURE RAG Chat Attiva (AI Insights con query) */
          <FlatList
            data={filteredNotes}
            renderItem={renderCard}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.gridContainer}
            columnWrapperStyle={styles.row}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={selectedFilter === 'Secondo Cervello' ? renderRAGResponseHeader : undefined}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={{ color: currentTheme.textSecondary }}>Nessuna nota trovata con i filtri selezionati.</Text>
              </View>
            }
          />
        );
      })()}

      {/* FAB: Sbloccato apre il modal di creazione nota */}
      <Pressable 
        onPress={() => isUnlocked && setIsModalVisible(true)}
        style={[
          styles.fab, 
          { 
            backgroundColor: currentTheme.textPrimary,
            shadowColor: isDark ? '#000' : '#71717a',
            opacity: isUnlocked ? 1 : 0.5
          }
        ]}
        disabled={!isUnlocked}
      >
        <Text style={[styles.fabText, { color: isDark ? '#000' : '#fff' }]}>+</Text>
      </Pressable>

      {/* Modal di Creazione Nuova Nota (Stile NotebookLM) */}
      <Modal
        visible={isModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: currentTheme.surface, borderColor: currentTheme.border }]}>
            <Text style={[styles.modalTitle, { color: currentTheme.textPrimary }]}>Nuova Nota Cifrata</Text>
            
            <TextInput
              placeholder="Titolo della nota..."
              placeholderTextColor={currentTheme.textSecondary}
              value={newNoteTitle}
              onChangeText={setNewNoteTitle}
              style={[
                styles.modalInput, 
                { color: currentTheme.textPrimary, borderColor: currentTheme.border, backgroundColor: currentTheme.background }
              ]}
            />

            <Text style={[styles.inputLabel, { color: currentTheme.textSecondary, marginBottom: 6 }]}>Contenuto</Text>

            {isTranscribing ? (
              <View style={[styles.transcribingContainer, { borderColor: currentTheme.border, backgroundColor: currentTheme.background }]}>
                <Text style={{ fontSize: 22, marginBottom: 8 }}>🔄</Text>
                <Text style={[styles.transcribingText, { color: currentTheme.textPrimary }]}>
                  🔄 IA sta ascoltando...
                </Text>
                <Text style={[styles.transcribingSubtext, { color: currentTheme.textSecondary }]}>
                  Trascrizione audio in corso tramite API client-side
                </Text>
              </View>
            ) : (
              <View style={styles.micInputContainer}>
                <TextInput
                  placeholder="Scrivi qui i tuoi pensieri..."
                  placeholderTextColor={currentTheme.textSecondary}
                  value={newNoteContent}
                  onChangeText={setNewNoteContent}
                  multiline={true}
                  numberOfLines={6}
                  style={[
                    styles.modalInput, 
                    styles.modalInputArea,
                    { flex: 1, marginBottom: 0, color: currentTheme.textPrimary, borderColor: currentTheme.border, backgroundColor: currentTheme.background }
                  ]}
                />
                <TouchableOpacity 
                  activeOpacity={0.6}
                  onPress={handleMicClick}
                  style={[
                    styles.micSidebarBtn, 
                    { 
                      backgroundColor: isRecording 
                        ? (isDark ? '#4c1d1d' : '#fee2e2') 
                        : (micFeedback ? (isDark ? '#222c26' : '#e8f5e9') : (isDark ? '#1a2730' : '#e0f2fe')),
                      borderColor: isRecording ? '#ef4444' : currentTheme.border,
                    }
                  ]}
                >
                  <Text style={{ fontSize: 20 }}>
                    {isRecording ? '🔴' : '🎙️'}
                  </Text>
                  {isRecording && (
                    <Text style={[styles.micSidebarLabel, { color: '#ef4444' }]}>Rec</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable 
                onPress={() => setIsModalVisible(false)}
                style={[styles.modalBtn, styles.modalBtnCancel, { borderColor: currentTheme.border }]}
              >
                <Text style={[styles.modalBtnCancelText, { color: currentTheme.textSecondary }]}>Annulla</Text>
              </Pressable>

              <Pressable 
                onPress={handleCreateNote}
                style={[styles.modalBtn, styles.modalBtnSave, { backgroundColor: currentTheme.textPrimary }]}
              >
                <Text style={[styles.modalBtnSaveText, { color: isDark ? '#000' : '#fff' }]}>Cifra e Salva</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal di Dettaglio, Modifica ed Eliminazione Nota - A Tutto Schermo */}
      <Modal
        visible={isViewModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsViewModalVisible(false)}
      >
        <SafeAreaView style={[styles.fullScreenContainer, { backgroundColor: currentTheme.background }]} edges={['top', 'bottom']}>
          {/* Header Barra Superiore */}
          <View style={[styles.fsHeader, { borderColor: currentTheme.border }]}>
            <TouchableOpacity 
              onPress={() => setIsViewModalVisible(false)}
              style={styles.fsHeaderBack}
            >
              <Text style={[styles.fsHeaderBackText, { color: currentTheme.textPrimary }]}>← Journal</Text>
            </TouchableOpacity>
            
            <View style={styles.fsHeaderActions}>
              {selectedNote && (
                <TouchableOpacity 
                  onPress={() => toggleFavorite(selectedNote.id)}
                  style={[styles.fsFavToggle, { borderColor: currentTheme.border, backgroundColor: currentTheme.surface }]}
                >
                  <Text style={{ fontSize: 18, color: selectedNote.isFavorite ? '#fbbf24' : currentTheme.textSecondary }}>
                    {selectedNote.isFavorite ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                onPress={handleSaveEdit}
                style={[styles.fsSaveBtn, { backgroundColor: currentTheme.textPrimary }]}
              >
                <Text style={[styles.fsSaveBtnText, { color: isDark ? '#000' : '#fff' }]}>Salva</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Form del Contenuto */}
          <View style={styles.fsContent}>
            {/* Input Titolo */}
            <TextInput
              placeholder="Titolo della nota..."
              placeholderTextColor={currentTheme.textSecondary}
              value={editNoteTitle}
              onChangeText={setEditNoteTitle}
              style={[
                styles.fsTitleInput, 
                { color: currentTheme.textPrimary }
              ]}
            />
            
            {/* Riga Data & Badge */}
            <View style={styles.fsMetaRow}>
              <Text style={[styles.fsDateText, { color: currentTheme.textSecondary }]}>
                {selectedNote?.date}
              </Text>
              {selectedNote?.tags && selectedNote.tags.length > 0 && (
                <View style={styles.fsTagsRow}>
                  {selectedNote.tags.map((tag, idx) => (
                    <View key={idx} style={[styles.tagBadge, { backgroundColor: isDark ? selectedNote.pastelAccent.dark : selectedNote.pastelAccent.light }]}>
                      <Text style={[styles.tagText, { color: isDark ? '#a1a1aa' : '#52525b' }]}>✦ {tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Input Contenuto */}
            <TextInput
              placeholder="Scrivi qui i tuoi pensieri..."
              placeholderTextColor={currentTheme.textSecondary}
              value={editNoteContent}
              onChangeText={setEditNoteContent}
              multiline={true}
              textAlignVertical="top"
              style={[
                styles.fsContentInput, 
                { color: currentTheme.textPrimary }
              ]}
            />
          </View>

          {/* Footer con Pulsante di Eliminazione */}
          {selectedNote && (
            <View style={[styles.fsFooter, { borderColor: currentTheme.border }]}>
              <TouchableOpacity 
                onPress={() => handleDeleteNote(selectedNote.id)}
                style={[
                  styles.fsDeleteBtn, 
                  { 
                    backgroundColor: isDark ? '#2e1919' : '#fef2f2',
                    borderColor: isDark ? '#5c2222' : '#fca5a5',
                  }
                ]}
              >
                <Text style={styles.fsDeleteBtnText}>Elimina Nota 🗑️</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  statusNode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  warningContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  warningBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  warningText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  controlsContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  tabFilters: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabButtonText: {
    fontSize: 13,
  },
  gridContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 80,
  },
  row: {
    justifyContent: 'space-between',
  },
  card: {
    width: (Dimensions.get('window').width - 52) / 2,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cryptoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cryptoIcon: {
    fontSize: 11,
  },
  cryptoText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardDate: {
    fontSize: 9,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 6,
  },
  cardExcerpt: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  footerInner: {
    flex: 1,
    gap: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '500',
  },
  syncContainer: {
    marginTop: 2,
  },
  syncText: {
    fontSize: 8,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 28,
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  favToggle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  micBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  modalInputArea: {
    height: 120,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalBtn: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    borderWidth: 1,
  },
  modalBtnCancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalBtnSave: {
    minWidth: 100,
  },
  modalBtnSaveText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalBtnDelete: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnDeleteText: {
    fontSize: 13,
    fontWeight: '600',
  },
  micInputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  micSidebarBtn: {
    width: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
  },
  micSidebarLabel: {
    fontSize: 8,
    fontWeight: '700',
    marginTop: 4,
  },
  transcribingContainer: {
    height: 120,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  transcribingText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  transcribingSubtext: {
    fontSize: 11,
    textAlign: 'center',
  },
  fullScreenContainer: {
    flex: 1,
  },
  fsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  fsHeaderBack: {
    paddingVertical: 6,
  },
  fsHeaderBackText: {
    fontSize: 15,
    fontWeight: '600',
  },
  fsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fsFavToggle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsSaveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsSaveBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fsContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  fsTitleInput: {
    fontSize: 22,
    fontWeight: '700',
    padding: 0,
    marginBottom: 10,
  },
  fsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 8,
  },
  fsDateText: {
    fontSize: 12,
  },
  fsTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  fsContentInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    padding: 0,
  },
  fsFooter: {
    padding: 20,
    borderTopWidth: 1,
  },
  fsDeleteBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsDeleteBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  ragResponseWrapper: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    width: '100%',
  },
  ragHeaderTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ragHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#93c5fd',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  ragLoadingText: {
    fontSize: 14,
    color: '#cbd5e1',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  ragResponseText: {
    fontSize: 14,
    color: '#f8fafc',
    lineHeight: 22,
  },
  ragContextTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 14,
    color: '#94a3b8',
  },
  insightsDashboardContainer: {
    paddingBottom: 80,
  },
  insightsDashboard: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  insightsTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  insightsDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyInsights: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tagCard: {
    width: (Dimensions.get('window').width - 52) / 2,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 4,
  },
  tagCardIcon: {
    fontSize: 14,
    marginBottom: 8,
  },
  tagCardName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  tagCardCount: {
    fontSize: 11,
    fontWeight: '500',
  },
  clearSearchBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});




