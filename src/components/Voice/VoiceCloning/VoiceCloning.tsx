import { useState, useRef } from 'react';
import axios from 'axios';
import { Upload, Info, CheckCircle, Trash, ChevronDown, Send, Play, Pause, Loader2, Heart } from 'lucide-react';
import { toast } from 'react-hot-toast';
import styles from './VoiceCloning.module.css';
import VoiceLibrary from '../TextToSpeech/Right/VoiceLibrary/VoiceLibrary';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const VOICE_ENGINE_API_BASE_URL = import.meta.env.VITE_VOICE_ENGINE_API_BASE_URL;

const sampleVoiceTexts = [
  "Hi there! I'm your AI assistant, ready to help you sound clear, confident, and consistent—wherever your voice is needed.",
  
  "Voice cloning lets you turn a short sample into a full voice model. The result sounds natural, expressive, and uniquely yours.",
  
  "This sample shows how your cloned voice can speak with clarity, rhythm, and warmth, perfect for narration or conversations.",
  
  "Imagine not needing to record every line. Your AI voice can speak for you, on demand, with the tone and style you prefer.",
  
  "Welcome! You're about to hear your cloned voice. It learns from how you speak and brings that style to anything you write.",
  
  "A short audio and transcript is all it takes. The system learns your voice and reproduces it with surprising accuracy.",
  
  "This sample shows how your voice flows between phrases, handles punctuation naturally, and captures your speaking style.",
  
  "Want to make a podcast or tutorial? Voice cloning lets you write the script while your AI voice delivers it seamlessly.",
  
  "Hi! I'm reading this to show how your cloned voice handles tone, pacing, and emotion—just like you would say it out loud.",
  
  "Voice cloning saves time and effort. You can now create spoken content with your voice, without needing to record again."
];

interface Props {
  setActiveTab: (tab: 'cloning' | 'tts' | 'stt') => void;
  engineOnline: boolean;
}

const VoiceCloning = ({ setActiveTab, engineOnline }: Props) => {
  const [voiceName, setVoiceName] = useState('');
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [success, setSuccess] = useState(false);
  const [showTips, setShowTips] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const getRandomSampleText = () =>
  sampleVoiceTexts[Math.floor(Math.random() * sampleVoiceTexts.length)];
  const alreadyHandledRef = useRef(false);

  const [text, setText] = useState(getRandomSampleText());

  const audioRef = useRef<HTMLAudioElement | null>(null);

  console.debug('[useSound] audioUrl:', audioUrl);

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

  const removeFile = (index: number) => {
    const updated = [...audioFiles];
    updated.splice(index, 1);
    setAudioFiles(updated);
  };

  const handleClone = async () => {
    alreadyHandledRef.current = false;
    if (audioFiles.length === 0) return toast.error('Upload an audio file.');
    if (!transcript.trim()) return toast.error('Transcript is required.');
  
    const formData = new FormData();
    formData.append('audio', audioFiles[0]); // Only first file is used for cloning
    formData.append('prompt_transcript', transcript.trim());
    formData.append('text', text); // internal speech
    formData.append('language', 'en');
  
    const controller = new AbortController();
    abortControllerRef.current = controller;
  
    try {
      setPreviewFailed(false);
      setIsCloning(true);
      toast.loading('Cloning voice...');
      const res = await axios.post(`${VOICE_ENGINE_API_BASE_URL}/cloning/clone/`, formData, {
        signal: controller.signal,
      });
  
      const id = res.data.task_id;
      setTaskId(id);
      toast.dismiss();
      toast.success('Cloning started.');
      pollCloningStatus(id);
    } catch (err: any) {
      toast.dismiss();
      if (axios.isCancel(err)) {
        toast.error('Cloning cancelled.');
      } else {
        toast.error('Failed to start cloning.');
        console.error('Clone error:', err);
      }
      setIsCloning(false);
    }
    // setSuccess(true);
  };

  const handleCancelClone = async () => {
    alreadyHandledRef.current = false;

    if (pollRef.current) clearInterval(pollRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
  
    setIsCloning(false);
    setTaskId(null);
  
    toast.success('Cloning task cancelled.');
  
    if (taskId) {
      const formData = new FormData();
      formData.append('task_id', taskId);
      try {
        await axios.post(`${VOICE_ENGINE_API_BASE_URL}/cancel-task/`, formData);
      } catch (err) {
        toast.error('Failed to cancel cloning task.');
      }
    }
  };  

  const pollCloningStatus = async (taskId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
  
    pollRef.current = window.setInterval(async () => {
      try {
        const res = await axios.get(`${VOICE_ENGINE_API_BASE_URL}/cloning/task-status/${taskId}`, {
          responseType: 'blob',
        });
  
        if (res.headers['content-type'] === 'audio/wav') {
          if (alreadyHandledRef.current) return; // 🧠 prevent double success
          alreadyHandledRef.current = true;

          clearInterval(pollRef.current!);
          pollRef.current = null;
          setIsCloning(false);
          setTaskId(null);
  
          const blob = new Blob([res.data], { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
          setIsPlaying(false);
          setPreviewFailed(false);
          setSuccess(true);
          toast.success('Voice cloned successfully.');
        } else {
          // The task hasn't completed yet, backend still returns JSON
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const json = JSON.parse(reader.result as string);
              const { state } = json;
              if (['FAILURE', 'REVOKED'].includes(state)) {
                clearInterval(pollRef.current!);
                pollRef.current = null;
                setIsCloning(false);
                setTaskId(null);
                toast.error(`Cloning ${state.toLowerCase()}.`);
              }
            } catch (e) {
              console.error('Failed to parse JSON during polling.', e);
            }
          };
          reader.readAsText(res.data);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 4000);
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

  const handleSave = async () => {
    if (!audioFiles[0]) return;
    const formData = new FormData();
    formData.append('voice_name', voiceName || 'Unnamed Voice');
    formData.append('source_audio', audioFiles[0]);

    try {
      setIsSaving(true);
      await axios.post(`${VOICE_ENGINE_API_BASE_URL}/cloning/save/`, formData);
      toast.success('Voice saved.');
    } catch (err) {
      toast.error('Failed to save voice.');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
  
    console.debug('[togglePlayback] native <audio>', {
      currentTime: audio.currentTime,
      paused: audio.paused,
    });
  
    if (audio.paused) {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.error('Audio play error:', err);
      });
    } else {
      audio.pause();
      setIsPlaying(false);
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
              <div
                className={styles.tooltipWrapper}
                data-tooltip={isPlaying ? 'Pause' : 'Play'}
              >
                <audio
                  ref={audioRef}
                  src={audioUrl || undefined}
                  onEnded={() => setIsPlaying(false)}
                  preload="auto"
                />
                <button
                  onClick={togglePlayback}
                  className={styles.inlinePlayButton}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  disabled={!audioUrl || previewFailed}
                  >
                  {!audioUrl && !previewFailed ? (
                    <Loader2 size={18} className={styles.spinner} />
                  ) : isPlaying ? (
                    <Pause size={18} />
                  ) : (
                    <Play size={18} />
                  )}
                </button>
              </div>
            </div>
            <p className={styles.successSubtitle}>Your voice is ready for use.</p>

            <div className={styles.successActions}>
            <button
              className={styles.secondaryBtn}
              onClick={() => {
                setText(getRandomSampleText()); // 👈 shuffle sample
                setSuccess(false);
              }}
            >
                Clone Again
              </button>
              <button className={styles.primaryBtn} onClick={() => setActiveTab('tts')}>
                Use Voice
              </button>
              <button
                className={styles.primaryBtn}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className={styles.spinner} />
                ) : (
                  <>
                    <Heart size={16} />
                    Save Voice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className={styles.right}>
          <VoiceLibrary
            goToVoiceCloning={() => {}}
            hideCloneButton
            hideDefaultVoices
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
            Transcript of uploaded audio is required. Feel free to use our <span className={styles.link} onClick={() => setActiveTab('stt')}>Speech-to-Text engine</span>.
          </p>
        </div>

        <div className={styles.actionRow}>
        {engineOnline ? (
          <button
            className={styles.primaryBtn}
            onClick={isCloning ? handleCancelClone : handleClone}
            disabled={audioFiles.length === 0 || isCloning && !taskId}
          >
            {isCloning ? (
              <>
                <span className={styles.spinner}></span> Cancel
              </>
            ) : (
              <>
                <Send size={16} /> Clone Voice
              </>
            )}
          </button>

          // <button
          //   className={styles.primaryBtn}
          //   onClick={handleClone}
          // >
          //   <Send size={16} /> Clone Voice
          // </button>

        ) : (
          <button className={styles.primaryBtn} onClick={handleStartEngine}>
            Start Voice Engine
          </button>
        )}
        </div>
      </div>

      <div className={styles.right}>
        <VoiceLibrary
          goToVoiceCloning={() => {}}
          hideCloneButton
          hideDefaultVoices
        />
      </div>
    </div>
  );
};

export default VoiceCloning;
