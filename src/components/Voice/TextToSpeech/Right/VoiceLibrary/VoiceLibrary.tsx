import { useState } from 'react';
import { Play, MoreVertical, Search } from 'lucide-react';
import styles from './VoiceLibrary.module.css';
import avatar from '../../../../../assets/voice-avatar.png';

interface VoiceLibraryProps {
  goToVoiceCloning: () => void;
}

const clonedVoices = [
  { id: '1', name: 'Isaac Newton', created: '06-06-2025', avatar },
  { id: '2', name: 'Isaac Newton', created: '06-06-2025', avatar },
  { id: '3', name: 'Isaac Newton', created: '06-06-2025', avatar },
];

const defaultVoices = [
  { id: 'default_male', name: 'Default Male', description: 'Standard Male Voice' },
  { id: 'default_female', name: 'Default Female', description: 'Standard Female Voice' },
];

const VoiceLibrary = ({ goToVoiceCloning }: VoiceLibraryProps) => {
  const [search, setSearch] = useState('');

  return (
    <div className={styles.wrapper}>
      {/* 🔍 Search and Clone Button */}
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
        <button
          className={styles.cloneButton}
          onClick={goToVoiceCloning}
        >
          Clone Voice
        </button>
      </div>

      {/* 🎧 Cloned Voices */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>Cloned Voices</span>
          <button className={styles.viewAll}>View all</button>
        </div>
        {clonedVoices.map((voice) => (
          <div key={voice.id} className={styles.voiceItem}>
            <div className={styles.avatarBox}>
              <img src={voice.avatar} alt="avatar" />
            </div>
            <div className={styles.voiceInfo}>
              <div className={styles.voiceName}>{voice.name}</div>
              <div className={styles.voiceMeta}>Created {voice.created}</div>
            </div>
            <div className={styles.voiceActions}>
              <Play size={16} />
              <MoreVertical size={16} />
            </div>
          </div>
        ))}
      </div>

      {/* 🔥 Default Voices (No View All) */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>Default Voices</span>
        </div>
        {defaultVoices.map((voice) => (
          <div key={voice.id} className={styles.voiceItem}>
            <div className={styles.avatarBox}>
              <div className={styles.defaultAvatar}></div>
            </div>
            <div className={styles.voiceInfo}>
              <div className={styles.voiceName}>{voice.name}</div>
              <div className={styles.voiceMeta}>{voice.description}</div>
            </div>
            <div className={styles.voiceActions}>
              <Play size={16} />
              <MoreVertical size={16} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VoiceLibrary;
