import { useRef, useState } from 'react';
import axios from 'axios';
import { Upload, Info, CheckCircle, Trash, ChevronDown, Send, Loader2, Heart } from 'lucide-react';
import { toast } from 'react-hot-toast';
import styles from './VoiceCloning.module.css';
import VoiceLibrary from '../TextToSpeech/Right/VoiceLibrary/VoiceLibrary';
import type { VoiceLibraryRef } from '../TextToSpeech/Right/VoiceLibrary/VoiceLibrary';
import avatar from '../../../assets/voice-avatar.png';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface Props {
  setActiveTab: (tab: 'cloning' | 'tts' | 'stt') => void;
  engineOnline: boolean;
  setSelectedVoiceForTTS: (voice: {
    id: string;
    name: string;
    avatar: string;
    reference_audio_url?: string | null;
    reference_transcript?: string | null;
    voice_type?: 'cloned' | 'seed';
  }) => void;
}

const VoiceCloning = ({ setActiveTab, engineOnline, setSelectedVoiceForTTS }: Props) => {
  const [voiceName, setVoiceName] = useState('');
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [success, setSuccess] = useState(false);
  const [showTips, setShowTips] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const voiceLibraryRef = useRef<VoiceLibraryRef>(null);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalFiles = [...audioFiles, ...files];

    if (totalFiles.length > 1) {
      toast.error('Only 1 file is allowed.');
      return;
    }

    const oversized = totalFiles.find(file => file.size > 50 * 1024 * 1024);
    if (oversized) {
      toast.error(`"${oversized.name}" exceeds 50MB limit.`);
      return;
    }

    setAudioFiles(totalFiles);
  };

  const removeFile = (index: number) => {
    const updated = [...audioFiles];
    updated.splice(index, 1);
    setAudioFiles(updated);
  };

  const handleClone = () => {
    if (!voiceName.trim()) return toast.error('Voice name is required.');
    if (audioFiles.length === 0) return toast.error('Upload an audio file.');
    if (!transcript.trim()) return toast.error('Transcript is required.');

    setIsCloning(true);
    toast.success('Voice cloned successfully.');
    setSuccess(true);
    setIsCloning(false);
  };

  const handleSave = async () => {
    if (!voiceName.trim()) return toast.error('Voice name is required.');
    if (!audioFiles[0]) return toast.error("Missing reference audio.");
    if (!transcript.trim()) return toast.error("Transcript is required.");
  
    const formData = new FormData();
    formData.append('name', voiceName.trim());
    formData.append('reference_transcript', transcript.trim());
    formData.append('voice_type', 'cloned');
    formData.append('reference_audio', audioFiles[0]);
  
    const controller = new AbortController();
    abortControllerRef.current = controller;
  
    try {
      setIsSaving(true);
      toast.loading('Saving voice...');
  
      const response = await axios.post(`${API_BASE_URL}/voice/save/`, formData, {
        signal: controller.signal,
        withCredentials: true,
      });
  
      toast.dismiss();
      voiceLibraryRef.current?.refreshLibrary(voiceName.trim());
      toast.success('Voice saved.');
  
      return response.data;  // Use entire response data
    } catch (err: any) {
      toast.dismiss();
      if (axios.isCancel(err)) {
        toast('Save cancelled.');
      } else {
        const message = err.response?.data?.error 
          || Object.values(err.response?.data || {})[0]
          || 'Failed to save voice.';
        toast.error(message);
      }
      return null;
    } finally {
      setIsSaving(false);
      abortControllerRef.current = null;
    }
  };  
  
  const handleCancelSave = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleStartEngine = async () => {
    toast.loading('Starting Voice Engine...');
    try {
      const res = await axios.post(`${API_BASE_URL}/voice/start-runpod/`);
      toast.dismiss();

      const status = res.data.status;
      if (["RUNNING", "STARTING", "REQUESTED"].includes(status)) {
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
            <div className={styles.voiceTagWithButton}>
              <div className={styles.defaultAvatar} />
              <span>{voiceName || 'Unnamed Voice'}</span>
            </div>
            <p className={styles.successSubtitle}>Your voice is ready for use.</p>

            <div className={styles.successActions}>
              <button
                className={styles.secondaryBtn}
                onClick={() => setSuccess(false)}
              >
                Clone Again
              </button>
              <button
                className={styles.primaryBtn}
                onClick={async () => {
                  if (isSaving) return; // Prevent double-clicks during save

                  const savedVoice = await handleSave(); // handleSave now returns response.data
                  if (!savedVoice || !savedVoice.id) {
                    toast.error('Voice could not be saved. Fix errors and try again.');
                    return;
                  }

                  setSelectedVoiceForTTS({
                    id: savedVoice.id,
                    name: savedVoice.name,
                    avatar: savedVoice.avatar_url || avatar,
                    reference_audio_url: savedVoice.reference_audio_url || null,
                    reference_transcript: savedVoice.reference_transcript || null,
                    voice_type: savedVoice.voice_type || 'cloned',
                  });

                  setActiveTab('tts');
                }}
              >
                Use Voice
              </button>
              {isSaving ? (
                <button className={styles.primaryBtn} onClick={handleCancelSave}>
                  <Loader2 className={styles.spinner} />
                  Cancel
                </button>
              ) : (
                <button className={styles.primaryBtn} onClick={handleSave}>
                  <Heart size={16} />
                  Save Voice
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.right}>
          <VoiceLibrary
            ref={voiceLibraryRef}
            goToVoiceCloning={() => {}}
            hideCloneButton
            setSelectedVoiceFromLibrary={(voice) => {
              setSelectedVoiceForTTS({
                id: voice.id,
                name: voice.name,
                avatar: voice.avatar_url || avatar,
                reference_audio_url: voice.reference_audio_url,
                reference_transcript: voice.reference_transcript,
                voice_type: voice.voice_type || 'cloned',
              });
              setActiveTab('tts');
            }}            
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.left} ${styles.panel}`}>
        <div>
          <h3 className={styles.sectionHeader}>Voice Name</h3>
          <input
            placeholder="Enter a name for your voice"
            className={styles.input}
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
          />
        </div>

        <div className={styles.sectionBox}>
          <h3 className={styles.sectionHeader}>Upload Audio</h3>
          <label className={styles.uploadBox}>
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
              <p className={styles.subText}>Audio or Video files, Max file size 50MB</p>
            </div>
          </label>
          {audioFiles.length > 0 && (
            <ul className={styles.fileList}>
              {audioFiles.map((file, i) => (
                <li key={i}>
                  {file.name}
                  <Trash size={14} onClick={() => removeFile(i)} className={styles.trash} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.infoBox}>
          <div className={styles.infoHeader} onClick={() => setShowTips(!showTips)}>
            <Info size={20} />
            <span>Tips for Better Voice Quality</span>
            <ChevronDown size={18} className={showTips ? styles.rotated : ''} />
          </div>
          {showTips && (
            <div className={styles.tipList}>
              <p>Use clear, high-quality audio recordings.</p>
              <p>Record at least 5–10 seconds of clean speech.</p>
              <p>Avoid background noise or overlapping voices.</p>
              <p>Speak naturally and clearly at a steady pace.</p>
              <p>Focus on clarity — quality matters more than quantity.</p>
            </div>
          )}
        </div>

        <div>
          <h3 className={styles.sectionHeader}>Transcript</h3>
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            placeholder="Paste the transcript of your uploaded audio here..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={5}
          />
          <p className={styles.subText}>
            Transcript of uploaded audio is required. Use our{' '}
            <span className={styles.link} onClick={() => setActiveTab('stt')}>
              Speech-to-Text engine
            </span>.
          </p>
        </div>

        <div className={styles.actionRow}>
          {engineOnline ? (
            <button
              className={styles.primaryBtn}
              onClick={handleClone}
              disabled={isCloning}
            >
              <Send size={16} /> Clone Voice
            </button>
          ) : (
            <button className={styles.primaryBtn} onClick={handleStartEngine}>
              Start Voice Engine
            </button>
          )}
        </div>
      </div>

      <div className={styles.right}>
        <VoiceLibrary
          ref={voiceLibraryRef}
          goToVoiceCloning={() => {}}
          hideCloneButton
          setSelectedVoiceFromLibrary={(voice) => {
            setSelectedVoiceForTTS({
              id: voice.id,
              name: voice.name,
              avatar: voice.avatar_url || avatar,
            });
            setActiveTab('tts');
          }}
        />
      </div>
    </div>
  );
};

export default VoiceCloning;
