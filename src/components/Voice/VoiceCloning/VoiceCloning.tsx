import { useState } from 'react';
import { Upload, Info, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import styles from './VoiceCloning.module.css';

interface Props {
  setActiveTab: (tab: 'cloning' | 'tts' | 'stt') => void;
  engineOnline: boolean;
  setEngineOnline: (status: boolean) => void;
}

const VoiceCloning = ({ setActiveTab, engineOnline }: Props) => {
  const [voiceName, setVoiceName] = useState('');
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalFiles = [...audioFiles, ...files];

    if (totalFiles.length > 10) {
      toast.error('Max 10 files allowed.');
      return;
    }

    const oversized = totalFiles.find(file => file.size > 20 * 1024 * 1024);
    if (oversized) {
      toast.error(`"${oversized.name}" exceeds 20MB limit.`);
      return;
    }

    setAudioFiles(totalFiles);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds 5MB limit.`);
        return;
      }
      setAvatarFile(file);
    }
  };

  const handleClone = () => {
    setSuccess(true);
  };

  const handleStartEngine = () => {
    toast.error('Failed to start Voice Engine. Service is not running.');
  };

  if (success) {
    return (
      <div className={styles.panel}>
        <div className={styles.successContainer}>
          <CheckCircle size={50} className={styles.successIcon} />
          <h2 className={styles.successTitle}>Voice Cloned Successfully</h2>
          <div className={styles.voiceTag}>
            {avatarFile ? (
              <img src={URL.createObjectURL(avatarFile)} alt="avatar" />
            ) : (
              <div className={styles.defaultAvatar} />
            )}
            <span>{voiceName || 'Unnamed Voice'}</span>
          </div>
          <p className={styles.successSubtitle}>Your voice is ready for use.</p>

          <div className={styles.successActions}>
            <button className={styles.secondaryBtn} onClick={() => setSuccess(false)}>
              Clone Again
            </button>
            <button
              className={styles.primaryBtn}
              onClick={() => setActiveTab('tts')}
            >
              Use Voice
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {/* ✅ Upload Section */}
      <div className={`${styles.uploadBox} ${styles.sectionBox}`}>
        <label>
          <input
            type="file"
            accept="audio/*,video/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleAudioUpload}
          />
          <div className={styles.uploadInner}>
            <Upload size={24} />
            <p>Click to upload a file or drag and drop</p>
            <p className={styles.subText}>Audio or Video files, up to 10 files, 20MB each</p>
          </div>
        </label>
        {audioFiles.length > 0 && (
          <ul className={styles.fileList}>
            {audioFiles.map((file, i) => (
              <li key={i}>{file.name}</li>
            ))}
          </ul>
        )}
      </div>

      {/* ✅ Info Section */}
      <div className={styles.infoBox}>
        <div className={styles.infoHeader}>
          <Info size={18} />
          <b>Tips for Better Voice Quality</b>
        </div>
        <p>• High-quality audio gives better results.</p>
        <p>• Noisy recordings may cause poor voice quality.</p>
        <p>• Aim for clear speech, minimal background noise.</p>
        <p>• Around <b>5 minutes total</b> of clean speech produces improved output.</p>
        <p>• Audio quality is more important than quantity.</p>
      </div>

      {/* ✅ Voice Name */}
      <div>
        <h3 className={styles.sectionHeader}>Voice Name</h3>
        <input
          placeholder="Enter a name for your voice"
          className={styles.input}
          value={voiceName}
          onChange={(e) => setVoiceName(e.target.value)}
        />
      </div>

      {/* ✅ Avatar Upload */}
      <div className={styles.uploadBox}>
        <label>
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarUpload}
          />
          <div className={styles.uploadInner}>
            <Upload size={20} />
            <p>Upload Avatar</p>
            <p className={styles.subText}>Max file size 5MB (Optional)</p>
          </div>
        </label>
        {avatarFile && <p className={styles.subText}>{avatarFile.name}</p>}
      </div>

      {/* ✅ Clone/Start Button */}
      <div className={styles.actionRow}>
        {engineOnline ? (
          <button
            className={styles.primaryBtn}
            onClick={handleClone}
          >
            Clone Voice
          </button>
        ) : (
          <button
            className={styles.primaryBtn}
            onClick={handleStartEngine}
          >
            Start Voice Engine
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceCloning;
