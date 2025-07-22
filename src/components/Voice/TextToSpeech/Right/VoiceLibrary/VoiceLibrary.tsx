import { useEffect, useRef, useState } from 'react';
import { Play, MoreVertical, Search } from 'lucide-react';
import axios from 'axios';
import styles from './VoiceLibrary.module.css';
import avatar from '../../../../../assets/voice-avatar.png';

interface VoiceLibraryProps {
  goToVoiceCloning: () => void;
  hideCloneButton?: boolean;
  hideDefaultVoices?: boolean;
}

interface Voice {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  avatar_url?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const VoiceLibrary = ({
  goToVoiceCloning,
  hideCloneButton = false,
  hideDefaultVoices = false
}: VoiceLibraryProps) => {
  const [search, setSearch] = useState('');
  const [clonedVoices, setClonedVoices] = useState<Voice[]>([]);
  const [defaultVoices, setDefaultVoices] = useState<Voice[]>([]);
  const [activeView, setActiveView] = useState<'cloned' | 'default' | 'both'>('both');
  const [itemHeight, setItemHeight] = useState(70);
  const [containerHeight, setContainerHeight] = useState(300);

  const voiceItemRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/voice/library/`, {
          withCredentials: true,
        });

        setClonedVoices(res.data.cloned_voices);
        setDefaultVoices(res.data.default_voices);
      } catch (err) {
        console.error("Failed to fetch voices", err);
      }
    };

    fetchVoices();
  }, []);

  useEffect(() => {
    const measure = () => {
      const height = voiceItemRef.current?.offsetHeight || 70;
      setItemHeight(height);

      // Adjust reserved height based on whether default voices are hidden
      let reservedHeight = 250;
      if (hideDefaultVoices) {
        reservedHeight -= 100; // reclaim space from unused default section
      }

      const available = Math.max(100, window.innerHeight - reservedHeight);
      setContainerHeight(available);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [hideDefaultVoices]);

  const filteredCloned = clonedVoices
    .filter(v => v.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredDefault = defaultVoices
    .filter(v => v.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const itemsVisibleInFull = Math.floor(containerHeight / itemHeight);
  const itemsVisibleCollapsed = Math.min(3, itemsVisibleInFull);

  const renderVoiceItem = (voice: Voice, isDefault = false, isFirst = false) => (
    <div
      key={voice.id}
      ref={isFirst ? voiceItemRef : undefined}
      className={styles.voiceItem}
    >
      <div className={styles.avatarBox}>
        {isDefault ? (
          <div className={styles.defaultAvatar}></div>
        ) : (
          <img src={voice.avatar_url || avatar} alt="avatar" />
        )}
      </div>
      <div className={styles.voiceInfo}>
        <div className={styles.voiceName}>{voice.name}</div>
        <div className={styles.voiceMeta}>
          {isDefault ? voice.description : `Created ${voice.created_at?.split('T')[0]}`}
        </div>
      </div>
      <div className={styles.voiceActions}>
        <Play size={16} />
        <MoreVertical size={16} />
      </div>
    </div>
  );

  return (
    <div className={styles.wrapper}>
      {/* 🔍 Search and optional Clone Button */}
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

      {/* 🎧 Cloned Voices */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>Cloned Voices</span>
          <button
            className={styles.viewAll}
            onClick={() => setActiveView(activeView === 'cloned' ? 'both' : 'cloned')}
          >
            {activeView === 'cloned' ? 'Collapse' : 'View all'}
          </button>
        </div>
        <div
          className={`${styles.voiceList} ${hideDefaultVoices ? styles.allVisible : ''}`}
          style={
            hideDefaultVoices
              ? undefined
              : {
                  maxHeight:
                    activeView === 'cloned'
                      ? containerHeight
                      : activeView === 'default'
                      ? 0
                      : itemHeight * itemsVisibleCollapsed,
                }
          }
        >
          {filteredCloned.map((voice, i) => renderVoiceItem(voice, false, i === 0))}
        </div>
      </div>

      {/* 🔥 Default Voices */}
      {!hideDefaultVoices && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>Default Voices</span>
            <button
              className={styles.viewAll}
              onClick={() => setActiveView(activeView === 'default' ? 'both' : 'default')}
            >
              {activeView === 'default' ? 'Collapse' : 'View all'}
            </button>
          </div>
          <div
            className={styles.voiceList}
            style={{
              maxHeight:
                activeView === 'default'
                  ? containerHeight
                  : activeView === 'cloned'
                  ? 0
                  : itemHeight * itemsVisibleCollapsed,
            }}
          >
            {filteredDefault.map((voice, i) => renderVoiceItem(voice, true, i === 0))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceLibrary;
