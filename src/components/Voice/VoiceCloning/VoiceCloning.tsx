import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Upload, Info, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import styles from './VoiceCloning.module.css';
import VoiceLibrary from '../TextToSpeech/Right/VoiceLibrary/VoiceLibrary';

interface Props {
  setActiveTab: (tab: 'cloning' | 'tts' | 'stt') => void;
  engineOnline: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const VoiceCloning = ({ setActiveTab, engineOnline }: Props) => {
  const [voiceName, setVoiceName] = useState('');
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [success, setSuccess] = useState(false);

  const tabsRef = { voiceLibrary: useRef<HTMLButtonElement>(null) };
  const [indicatorLeft, setIndicatorLeft] = useState('0px');
  const [indicatorWidth, setIndicatorWidth] = useState('0px');

  useEffect(() => {
    const ref = tabsRef.voiceLibrary;
    if (ref.current) {
      setIndicatorLeft(ref.current.offsetLeft + 'px');
      setIndicatorWidth(ref.current.offsetWidth + 'px');
    }
  }, []);

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

  const handleStartEngine = async () => {
    toast.loading('Starting Voice Engine...');
    try {
      const res = await axios.post(`${API_BASE_URL}/voice/start-runpod/`);
      toast.dismiss();
  
      const status = res.data.status;
  
      if (['RUNNING', 'STARTING', 'REQUESTED'].includes(status)) {
        toast.success('Voice Engine is starting.');
      } else if (status === 'HEALTHY') {
        toast.success('Voice Engine is already live. Refresh the page if needed.');
      } else {
        toast.error(`Engine status: ${status || 'Unknown'}`);
      }
    } catch (err: any) {
      toast.dismiss();
      console.error('API Error:', err);
      toast.error('Failed to start Voice Engine.');
    }
  };

  if (success) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.left}>
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
              <button className={styles.primaryBtn} onClick={() => setActiveTab('tts')}>
                Use Voice
              </button>
            </div>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.tabs}>
            <button
              ref={tabsRef.voiceLibrary}
              className={styles.active}
              onClick={() => {}}
            >
              Voice Library
            </button>
            <div
              className={styles.tabIndicator}
              style={{ left: indicatorLeft, width: indicatorWidth }}
            />
          </div>
          <VoiceLibrary goToVoiceCloning={() => {}} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* ✅ Left Panel */}
      <div className={styles.left}>
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

        <div className={styles.infoBox}>
          <div className={styles.infoHeader}>
            <Info size={18} />
            <b>Tips for Better Voice Quality</b>
          </div>
          <p>• Use clear, high-quality audio recordings.</p>
          <p>• Avoid background noise or overlapping voices.</p>
          <p>• Speak naturally and clearly at a steady pace.</p>
          <p>• 5–10 seconds of clean speech is recommended.</p>
          <p>• Focus on clarity — quality matters more than quantity.</p>
        </div>

        <div>
          <h3 className={styles.sectionHeader}>Voice Name</h3>
          <input
            placeholder="Enter a name for your voice"
            className={styles.input}
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
          />
        </div>

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

        <div className={styles.actionRow}>
          {engineOnline ? (
            <button className={styles.primaryBtn} onClick={handleClone}>
              Clone Voice
            </button>
          ) : (
            <button className={styles.primaryBtn} onClick={handleStartEngine}>
              Start Voice Engine
            </button>
          )}
        </div>
      </div>

      {/* ✅ Right Panel */}
      <div className={styles.right}>
        <div className={styles.tabs}>
          <button
            ref={tabsRef.voiceLibrary}
            className={styles.active}
            onClick={() => {}}
          >
            Voice Library
          </button>
          <div
            className={styles.tabIndicator}
            style={{ left: indicatorLeft, width: indicatorWidth }}
          />
        </div>
        <VoiceLibrary goToVoiceCloning={() => {}} />
      </div>
    </div>
  );
};

export default VoiceCloning;
