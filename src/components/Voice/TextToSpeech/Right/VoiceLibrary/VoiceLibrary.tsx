import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from 'react';
import { Play, Pause, MoreVertical, Search, Send, X } from 'lucide-react';
import styles from './VoiceLibrary.module.css';
import avatar from '../../../../../assets/voice-avatar.png';
import toast from 'react-hot-toast';
import { useAuth } from '../../../../../context/AuthContext' 
import { useNavigate } from 'react-router-dom'
import { api, getAxiosErrorMessage } from '../../../../../lib/api'

interface VoiceLibraryProps {
  goToVoiceCloning: () => void;
  hideCloneButton?: boolean;
  setSelectedVoiceFromLibrary?: (voice: Voice) => void;
}

export interface VoiceLibraryRef {
  refreshLibrary: (scrollToName?: string) => Promise<void>;
}

interface Voice {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  avatar_url?: string;
  preview_audio_url?: string;
  reference_audio_url?: string | null;  // ADD
  reference_transcript?: string | null; // ADD
  voice_type?: 'cloned' | 'seed';       // ADD
}

// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const VoiceLibrary = forwardRef<VoiceLibraryRef, VoiceLibraryProps>(
  ({ goToVoiceCloning, hideCloneButton = false, setSelectedVoiceFromLibrary }, ref) => {
    const [search, setSearch] = useState('');
    const [clonedVoices, setClonedVoices] = useState<Voice[]>([]);
    const [itemHeight, setItemHeight] = useState(70);
    const [containerHeight, setContainerHeight] = useState(300);
    const [scrollTargetName, setScrollTargetName] = useState('');

    const voiceItemRef = useRef<HTMLDivElement | null>(null);
    const scrollToVoiceRef = useRef<HTMLDivElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');

    const [highlightedVoice, setHighlightedVoice] = useState<string | null>(null);

    const { logout } = useAuth()
    const navigate = useNavigate()

    const handleRenameVoice = async (voiceId: string, name: string) => {
      try {
        await api.patch(`/voice/${voiceId}/`, { name })
        setClonedVoices((prev) => prev.map((v) => (v.id === voiceId ? { ...v, name } : v)))
        setRenamingId(null)
        toast.success('Voice renamed')
      } catch (err) {
        console.error('Failed to rename voice', err)
        toast.error(getAxiosErrorMessage(err))
      }
    }

    const handleDeleteVoice = async (voiceId: string) => {
      try {
        await api.delete(`/voice/${voiceId}/`)
        toast.success('Voice deleted')
        fetchVoices()
      } catch (err) {
        console.error('Failed to delete voice', err)
        toast.error(getAxiosErrorMessage(err))
      }
    }

    const confirmDelete = (voice: Voice) => {
      toast(
        (t) => (
          <div className={styles.confirmToast}>
            <span>Delete <strong>{voice.name}</strong>?</span>
            <div className={styles.confirmButtons}>
              <button
                className={`${styles.confirmButton} ${styles.confirmDelete}`}
                onClick={() => {
                  handleDeleteVoice(voice.id);
                  toast.dismiss(t.id);
                }}
              >
                Yes, Delete
              </button>
              <button
                className={`${styles.confirmButton} ${styles.confirmCancel}`}
                onClick={() => toast.dismiss(t.id)}
              >
                Cancel
              </button>
            </div>
          </div>
        ),
        { style: { background: '#222', border: '1px solid #444' } }
      );
    };

    const fetchVoices = async () => {
      try {
        const res = await api.get('/voice/library/')
        setClonedVoices(res.data.voices || [])
      } catch (err: any) {
        // if interceptor logged you out + navigated, this may still run
        console.error('Failed to fetch voices', err)
        const status = err?.response?.status
        if (status === 401 || status === 419) {
          try { await logout() } finally { navigate('/login', { replace: true }) }
          return
        }
        toast.error(getAxiosErrorMessage(err))
      }
    }

    useImperativeHandle(ref, () => ({
      refreshLibrary: async (voiceName?: string) => {
        setScrollTargetName(voiceName || '');
        setHighlightedVoice(voiceName || '');
        await fetchVoices();
        setTimeout(() => {
          scrollToVoiceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 250);
        setTimeout(() => setHighlightedVoice(null), 2000);
      },
    }));

    useEffect(() => {
      fetchVoices();
    }, []);

    useEffect(() => {
      const measure = () => {
        const height = voiceItemRef.current?.offsetHeight || 70;
        setItemHeight(height);
        const reservedHeight = 250;
        const available = Math.max(100, window.innerHeight - reservedHeight);
        setContainerHeight(available);
      };
      measure();
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }, []);

    const filteredCloned = clonedVoices
      .filter((v) => v.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));

    const itemsVisibleInFull = Math.floor(containerHeight / itemHeight);
    const itemsVisibleCollapsed = Math.min(3, itemsVisibleInFull);

    const handlePlayPreview = (voice: Voice) => {
      if (voice.preview_audio_url) {
        if (playingId === voice.id) {
          audioRef.current?.pause();
          setPlayingId(null);
        } else {
          audioRef.current?.pause();
          audioRef.current = new Audio(voice.preview_audio_url);
          audioRef.current.play();
          setPlayingId(voice.id);
          audioRef.current.onended = () => setPlayingId(null);
        }
      }
    };

    const renderVoiceItem = (voice: Voice, isFirst = false) => {
      const ref = voice.name === scrollTargetName ? scrollToVoiceRef : isFirst ? voiceItemRef : undefined;
      const isHighlighted = voice.name === highlightedVoice;

      return (
        <div
          key={voice.id}
          ref={ref}
          className={`${styles.voiceItem} ${isHighlighted ? styles.highlighted : ''}`}
        >
          <div className={styles.avatarBox}>
            <img src={voice.avatar_url || avatar} alt="avatar" />
          </div>
          <div className={styles.voiceInfo}>
            <div className={styles.voiceName}>
              {renamingId === voice.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRenameVoice(voice.id, newName);
                  }}
                  className={styles.renameForm}
                >
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    autoFocus
                    className={styles.renameInput}
                  />
                  <div className={styles.renameButtons}>
                    <div className={styles.tooltipWrapper} data-tooltip="send">
                      <button type="submit" className={styles.renameIconBtn}>
                        <Send size={16} />
                      </button>
                    </div>
                    <div className={styles.tooltipWrapper} data-tooltip="close">
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className={styles.renameIconBtn}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                voice.name
              )}
            </div>
            <div className={styles.voiceMeta}>
              {`Created ${voice.created_at?.split('T')[0]}`}
            </div>
          </div>
          <div className={styles.voiceActions}>
            {voice.preview_audio_url ? (
              <button
                className={styles.iconBtn}
                onClick={() => handlePlayPreview(voice)}
                title="Play preview"
              >
                {playingId === voice.id ? <Pause size={16} /> : <Play size={16} />}
              </button>
            ) : (
              <div className={styles.tooltipWrapper} data-tooltip="No preview available">
                <button disabled><Play size={16} /></button>
              </div>
            )}
            <div className={styles.dropdownWrapper}>
              <button
                className={styles.iconBtn}
                onClick={() => setActionMenuId(actionMenuId === voice.id ? null : voice.id)}
                title="More options"
              >
                <MoreVertical size={16} />
              </button>
              {actionMenuId === voice.id && (
                <div className={styles.dropdownMenu}>
                  {setSelectedVoiceFromLibrary && (
                    <button
                      onClick={() => {
                        setSelectedVoiceFromLibrary(voice);
                        setActionMenuId(null);
                      }}
                    >
                      Use Voice
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setRenamingId(voice.id);
                      setNewName(voice.name);
                      setActionMenuId(null);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => {
                      confirmDelete(voice);
                      setActionMenuId(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className={styles.wrapper}>
        <div className={styles.topRow}>
          <div className={styles.searchBox}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Search Voices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {!hideCloneButton && (
            <button className={styles.cloneButton} onClick={goToVoiceCloning}>
              Clone Voice
            </button>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>Cloned Voices</span>
          </div>
          <div
            className={styles.voiceList}
            style={{
              maxHeight: containerHeight || itemHeight * itemsVisibleCollapsed,
            }}
          >
            {filteredCloned.map((voice, i) => renderVoiceItem(voice, i === 0))}
          </div>
        </div>
      </div>
    );
  }
);

export default VoiceLibrary;
