import React, { useState, useEffect } from 'react';
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
  Modal 
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
  date: string;
  tags: string[];
  pastelAccent: {
    light: string;
    dark: string;
  };
  isAnalyzing?: boolean;
  syncStatus: 'none' | 'syncing' | 'synced' | 'local_only';
}

// Note simulate memorizzate nello storage cifrato fittizio dell'utente.
const INITIAL_NOTES: NoteItem[] = [
  {
    id: '1',
    title: 'Riflessioni BYO-Cloud',
    excerpt: 'Analisi sui vantaggi del modello BYO-Cloud. L\'assenza di server proprietari elimina i costi di manutenzione e garantisce la sovranità dei dati all\'utente...',
    date: 'Oggi, 08:30',
    tags: ['Architettura', 'Sintesi-AI'],
    pastelAccent: {
      light: '#e8f5e9', // Salvia tenue
      dark: '#1b2e24',  // Salvia scuro
    },
    syncStatus: 'synced',
  },
  {
    id: '2',
    title: 'Vocale: Idee Startup',
    excerpt: 'Trascrizione crittografata locale. Discussione sulle funzionalità principali: crittografia client-side AES-GCM e derivazione con PBKDF2...',
    date: 'Ieri, 18:15',
    tags: ['Vocale', 'Analisi-AI'],
    pastelAccent: {
      light: '#e3f2fd', // Carta da zucchero tenue
      dark: '#162b3d',  // Carta da zucchero scuro
    },
    syncStatus: 'synced',
  },
  {
    id: '3',
    title: 'Studio Modelli Locali',
    excerpt: 'Valutazione delle prestazioni di Ollama e modelli offline (Phi-4, Llama 3) su dispositivi mobili. Latenza ottimale per la generazione di tag...',
    date: '28 Mag',
    tags: ['Modelli', 'Ricerca'],
    pastelAccent: {
      light: '#f3e5f5', // Lilla tenue
      dark: '#2d1b33',  // Lilla scuro
    },
    syncStatus: 'synced',
  },
  {
    id: '4',
    title: 'Integrazione WebDAV',
    excerpt: 'Sincronizzazione incrementale dei file JSON cifrati. Algoritmo di risoluzione dei conflitti basato su timestamp locali e verifica della firma...',
    date: '24 Mag',
    tags: ['Storage', 'Sync'],
    pastelAccent: {
      light: '#fff3e0', // Pesca tenue
      dark: '#3d2516',  // Pesca scuro
    },
    syncStatus: 'synced',
  }
];

const FILTER_TABS = ['Tutti', 'Cifrati', 'AI Insights', 'Preferiti'];

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
              // Se la nota è in fase di elaborazione IA in background o in sincro iniziale, manteniamo lo stato corrente
              if (note.isAnalyzing) {
                return note;
              }
              // Cifratura + Decifratura live per testare il motore
              const encryptedTitle = await CryptoEngine.encryptNote(note.title, key);
              const encryptedExcerpt = await CryptoEngine.encryptNote(note.excerpt, key);
              const decryptedTitle = await CryptoEngine.decryptNote(encryptedTitle.ciphertext, encryptedTitle.iv, key);
              const decryptedExcerpt = await CryptoEngine.decryptNote(encryptedExcerpt.ciphertext, encryptedExcerpt.iv, key);
              
              return {
                ...note,
                title: decryptedTitle,
                excerpt: decryptedExcerpt,
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
      excerpt: newNoteContent,
      date: dateStr,
      tags: [],
      pastelAccent: { light: '#f4f4f5', dark: '#27272a' },
      isAnalyzing: true,
      syncStatus: 'none',
    };

    setIsModalVisible(false);
    setNewNoteTitle('');
    setNewNoteContent('');

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
          const encExcerpt = await CryptoEngine.encryptNote(finalExcerpt, derivedKey);
          encryptedPayload = JSON.stringify({
            titleCipher: encTitle.ciphertext,
            titleIv: encTitle.iv,
            excerptCipher: encExcerpt.ciphertext,
            excerptIv: encExcerpt.iv,
            date: dateStr,
            tags: finalTags,
            lastUpdated: Date.now(), // Usato per la risoluzione conflitti Last Write Wins
          });
        } else {
          encryptedPayload = JSON.stringify({
            title: newNote.title,
            excerpt: finalExcerpt,
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

  const renderCard = ({ item }: { item: NoteItem }) => {
    const cardAccent = isDark ? item.pastelAccent.dark : item.pastelAccent.light;
    
    return (
      <Pressable 
        style={[
          styles.card, 
          { 
            backgroundColor: currentTheme.surface, 
            borderColor: currentTheme.border,
            borderLeftColor: cardAccent,
            opacity: isUnlocked ? 1 : 0.75,
          }
        ]}
        disabled={!isUnlocked}
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
      </Pressable>
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
            placeholder={isUnlocked ? "Cerca nei tuoi quaderni..." : "Sblocca per cercare..."}
            placeholderTextColor={currentTheme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={isUnlocked}
            style={[styles.searchInput, { color: currentTheme.textPrimary }]}
          />
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
                    backgroundColor: currentTheme.surface,
                    borderColor: currentTheme.border,
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

      {/* Grid of Notes */}
      <FlatList
        data={processedNotes}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ color: currentTheme.textSecondary }}>Nessuna nota trovata nel quaderno.</Text>
          </View>
        }
      />

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
                { color: currentTheme.textPrimary, borderColor: currentTheme.border, backgroundColor: currentTheme.background }
              ]}
            />

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
});




