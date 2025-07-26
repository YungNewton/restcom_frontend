import { useEffect, useRef, useState } from 'react';
import {
  Upload, Play, Pause, Download, Trash2, Info, ChevronDown,
} from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { toast } from 'react-hot-toast';
import axios from 'axios';

import styles from './TextToSpeech.module.css';
import avatar from '../../../assets/voice-avatar.png';

import Settings from './Right/Settings/Settings';
import VoiceLibrary from './Right/VoiceLibrary/VoiceLibrary';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const VOICE_ENGINE_API_BASE_URL = import.meta.env.VITE_VOICE_ENGINE_API_BASE_URL;

interface TextToSpeechProps {
  setActiveTab: (tab: 'cloning' | 'tts' | 'stt') => void;
  engineOnline: boolean;
  externalSelectedVoice?: { id: string; name: string; avatar: string } | null;
  clearExternalVoice?: () => void;
}

const TextToSpeech: React.FC<TextToSpeechProps> = ({
  setActiveTab,
  engineOnline,
  externalSelectedVoice,
  clearExternalVoice,
}) => {
  const [text, setText] = useState('');
  const [showPlayback, setShowPlayback] = useState(false);
  const [showTips, setShowTips] = useState(true);

  const [dialogueMode, setDialogueMode] = useState(false);
  const [speakers, setSpeakers] = useState<{ id: number; voiceName: string }[]>([]);
  const speakerListRef = useRef<HTMLDivElement>(null);

  const [speed, setSpeed] = useState(1);
  const [language, setLanguage] = useState('English');
  const [autoDetect, setAutoDetect] = useState(false);
  const [fileName, setFileName] = useState('output');
  const [fileFormat, setFileFormat] = useState('wav');
  const [seed, setSeed] = useState('-1');

  const [activeRightTab, setActiveRightTab] = useState<'settings' | 'voiceLibrary'>('settings');

  const tabsRef = {
    settings: useRef<HTMLButtonElement>(null),
    voiceLibrary: useRef<HTMLButtonElement>(null),
  };

  const [indicatorLeft, setIndicatorLeft] = useState('0px');
  const [indicatorWidth, setIndicatorWidth] = useState('0px');

  const [selectedVoice, setSelectedVoice] = useState<{
    id: string;
    name: string;
    avatar: string;
    reference_audio_url?: string | null;
    reference_transcript?: string | null;
    voice_type?: 'cloned' | 'seed';
  }>({
    id: 'random',
    name: 'Random',
    avatar,
  });
  
  /** -------- Polling / cancel groundwork -------- */
  const [isGenerating, setIsGenerating] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
  
    const updateTime = () => setCurrentTime(audio.currentTime);
    const setAudioData = () => setDuration(audio.duration);
  
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', setAudioData);
  
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', setAudioData);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, []);  
  
  useEffect(() => {
    const ref = tabsRef[activeRightTab];
    if (ref.current) {
      setIndicatorLeft(ref.current.offsetLeft + 'px');
      setIndicatorWidth(ref.current.offsetWidth + 'px');
    }
  }, [activeRightTab]);

  useEffect(() => {
    if (speakerListRef.current) {
      speakerListRef.current.scrollTo({
        left: speakerListRef.current.scrollWidth,
        behavior: 'smooth',
      });
    }
  }, [speakers]);

  useEffect(() => {
    if (externalSelectedVoice) {
      setSelectedVoice(externalSelectedVoice);
      if (dialogueMode) setDialogueMode(false);
      setSpeakers([]);
      clearExternalVoice?.();
    }
  }, [externalSelectedVoice]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);  

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };
  
  const skipForward = (seconds = 5) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.min(audio.currentTime + seconds, duration);
  };
  
  const skipBackward = (seconds = 5) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.max(audio.currentTime - seconds, 0);
  };
  
  const handleSliderChange = (value: number | number[]) => {
    const newValue = Array.isArray(value) ? value[0] : value; 
    const audio = audioRef.current;
    if (audio) audio.currentTime = newValue;
    setCurrentTime(newValue);
  };  
  
  const handleDownload = () => {
    if (!audioBlob) return;
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName || 'output'}.${fileFormat || 'wav'}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };  

  const buildSeedsPayload = () => {
    // seed is a string in your state
    const n = Number(seed);
    if (!Number.isNaN(n) && n >= 0) return JSON.stringify([n]); // fixed seed
    return JSON.stringify([]); // let backend randomize
  };

  const isSeedOrRandom = (v: typeof selectedVoice) =>
  v.id === 'random' || v.id === 'seeded' || v.id === 'seed';

  const isClonedVoice = (v: typeof selectedVoice) =>
    v.voice_type === 'cloned' || !!v.reference_audio_url;

  const handleCancelGenerate = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
  
    // cleanup URL if one exists
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  
    setIsGenerating(false);
    setTaskId(null);
    setShowPlayback(false);
  
    toast.success('Generation cancelled.');  

    if (taskId) {
      try {
        const formData = new FormData();
        formData.append('task_id', taskId);
        await axios.post(`${VOICE_ENGINE_API_BASE_URL}/cancel-task/`, formData, {
          withCredentials: true,
        });
      } catch (err) {
        toast.error('Failed to cancel task on server.');
      }
    }
  };

  const handleGenerate = async () => {
    if (!engineOnline) {
      toast.error('Voice Engine is Offline');
      return;
    }
    if (!text.trim()) {
      toast.error('Please enter some text.');
      return;
    }
  
    // ✅ Only handle random/seed for now
    const isSeedOrRandom =
      selectedVoice.id === 'random' ||
      selectedVoice.id === 'seeded' || // from your Settings
      selectedVoice.id === 'seed';
  
    if (!isSeedOrRandom) {
      toast.error('Custom/Cloned voices not wired yet — coming next.');
      return;
    }
  
    const controller = new AbortController();
    abortControllerRef.current = controller;
  
    setIsGenerating(true);
    setShowPlayback(false);
  
    try {
      toast.loading('Starting synthesis...');
  
      const fd = new FormData();
      fd.append('text', text);
      fd.append('output_format', fileFormat); // "wav" | "mp3"
      fd.append('speed', String(speed));
      fd.append('seeds', buildSeedsPayload());
  
      // 🔸 hit the FastAPI route you showed: POST /tts/tts/
      const res = await axios.post(`${VOICE_ENGINE_API_BASE_URL}/tts/tts/`, fd, {
        withCredentials: true,
        signal: controller.signal,
      });
  
      const id = res.data.task_id;
      setTaskId(id);
      toast.success('Generation started.');
      await pollAndFetchAudio(id);
    } catch (err: any) {
      toast.dismiss();
      if (axios.isCancel(err)) {
        toast('Request cancelled.');
      } else {
        console.error(err);
        toast.error(err?.response?.data?.detail || 'Failed to start generation.');
      }
      setIsGenerating(false);
    }
  };  

  const pollAndFetchAudio = async (id: string, intervalMs = 1500, timeoutMs = 120000) => {
    const start = Date.now();
  
    while (true) {
      if (Date.now() - start > timeoutMs) {
        setIsGenerating(false);
        toast.dismiss();
        toast.error('Timed out while generating audio.');
        throw new Error('TTS timeout');
      }
  
      try {
        const res = await fetch(`${VOICE_ENGINE_API_BASE_URL}/task-status/${id}`, {
          method: 'GET',
          credentials: 'include',
          signal: abortControllerRef.current?.signal,
        });
  
        const contentType = res.headers.get('content-type') || '';
  
        // ✅ SUCCESS: the endpoint streams audio bytes
        if (res.ok && contentType.includes('audio/')) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
  
          // cleanup previous url
          if (audioUrl) URL.revokeObjectURL(audioUrl);
  
          setAudioBlob(blob);
          setAudioUrl(url);
          setShowPlayback(true);
          setIsGenerating(false);
          toast.dismiss();
          toast.success('Speech ready!');
  
          return;
        }
  
        // still pending? read JSON
        const json = await res.json();
        if (json.state === 'FAILURE') {
          setIsGenerating(false);
          toast.dismiss();
          toast.error(json.error || 'Generation failed.');
          return;
        }
        // else: PENDING/STARTED -> wait & retry
      } catch (e) {
        if (abortControllerRef.current?.signal.aborted) {
          // user cancelled
          return;
        }
        console.warn('Polling error, retrying...', e);
        // continue retrying
      }
  
      await new Promise((r) => setTimeout(r, intervalMs));
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

  return (
    <div className={styles.wrapper}>
      {/* ✅ Left Panel */}
      <div className={`${styles.left} ${styles.panel}`}>
        <div className={styles.voicePanel}>
          <div className={styles.voiceSelector}>
            <img src={selectedVoice.avatar} alt="avatar" className={styles.avatar} />
            <span className={styles.voiceName}>{selectedVoice.name}</span>
          </div>
        </div>

        {dialogueMode && (
          <div className={styles.dialogueContainer}>
            <button
              className={styles.addSpeakerBtn}
              onClick={() => {
                const nextId = speakers.length + 1;
                setSpeakers([...speakers, { id: nextId, voiceName: selectedVoice.name }]);
              }}
            >
              + Add Speaker
            </button>

            <div className={styles.speakerList} ref={speakerListRef}>
              {speakers.map((speaker, index) => (
                <div key={speaker.id} className={styles.speakerCard}>
                  <img src={avatar} alt="speaker avatar" className={styles.avatar} />
                  <div className={styles.speakerDetails}>
                    <span className={styles.voiceName}>{speaker.voiceName}</span>
                    <span className={styles.speakerLabel}>Speaker {index + 1}</span>
                  </div>
                  <button
                    className={styles.removeSpeakerBtn}
                    onClick={() => {
                      setSpeakers((prev) =>
                        prev
                          .filter((s) => s.id !== speaker.id)
                          .map((s, i) => ({ ...s, id: i + 1 }))
                      );
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <textarea
          className={styles.textArea}
          placeholder="Start typing here or paste any text you want to turn into life-like speech..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={3000}
        />
        <div className={styles.charCount}>{text.length} / 3000 Characters</div>

        {/* Tips Section */}
        <div className={styles.infoBox}>
          <div className={styles.infoHeader} onClick={() => setShowTips(!showTips)}>
            <Info size={20} />
            <span>Tips for Better Output</span>
            <ChevronDown size={18} className={showTips ? styles.rotated : ''} />
          </div>
          {showTips && (
            <div className={styles.tipList}>
              <p>Short input (under ~5s of audio) may sound unnatural.</p>
              <p>Our batching algorithm automatically handles long text.</p>
              <p>Generate non-verbal sounds with <code>(laughs)</code>, <code>(coughs)</code>, etc.</p>
              <p>Verbal tags recognized at <a href="hyperlink" target="_blank" rel="noopener noreferrer">how it works</a>.</p>
              <p>Use non-verbal tags sparingly; overusing or using unlisted ones may cause artifacts.</p>
              <p>Generate dialogue using speaker tags like <code>[S1]</code> and <code>[S2]</code>.</p>
              <p>Example: <code>[S1] Hello! [S2] Hi, how are you?</code></p>
            </div>
          )}
        </div>

        <div className={styles.uploadNote}>
          <Info size={16} />
          <span>
            Upload — for longer texts beyond the typing limit (e.g. audiobooks, documents, chapters).
          </span>
        </div>

        <div className={styles.uploadBox}>
          <label>
            <input
              type="file"
              accept=".txt,.pdf,.doc,.docx,.md,.rtf"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  console.log('File selected:', file.name);
                }
              }}
            />
            <div className={styles.uploadInner}>
              <Upload size={22} />
              <p>Click to upload or drag & drop</p>
              <p className={styles.subText}>.txt, .pdf, .docx, .md, .rtf</p>
            </div>
          </label>
        </div>

        <div className={styles.actionRow}>
          {engineOnline ? (
            <button
              className={styles.generateBtn}
              onClick={isGenerating ? handleCancelGenerate : handleGenerate}
              disabled={false}
            >
              {isGenerating ? (
                <>
                  <span className={styles.spinner}></span> Cancel
                </>
              ) : (
                'Generate Speech'
              )}
            </button>
          ) : (
            <button className={styles.generateBtn} onClick={handleStartEngine}>
              Start Voice Engine
            </button>
          )}
        </div>

        {showPlayback && audioUrl && (
          <div className={styles.playbackContainer}>
            <audio ref={audioRef} src={audioUrl} preload="metadata" />

            <div className={styles.audioControls}>
              <div className={styles.tooltipWrapper} data-tooltip="Back 5s">
                <button onClick={() => skipBackward(5)}>«</button>
              </div>
              <div className={styles.tooltipWrapper} data-tooltip={isPlaying ? "Pause" : "Play"}>
                <button onClick={togglePlayPause}>
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
              </div>
              <div className={styles.tooltipWrapper} data-tooltip="Forward 5s">
                <button onClick={() => skipForward(5)}>»</button>
              </div>
              <div className={styles.tooltipWrapper} data-tooltip="Download">
                <button onClick={handleDownload}><Download size={20} /></button>
              </div>
            </div>

            <div className={styles.timeline}>
              <div className={styles.voiceTag}>
                <img src={selectedVoice.avatar} alt="avatar" />
                <span>Output: {selectedVoice.name}</span>
              </div>
              <span>{formatTime(currentTime)}</span>
              <Slider
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={handleSliderChange}
                railStyle={{ backgroundColor: '#444', height: 4 }}
                trackStyle={{ backgroundColor: '#0073ff', height: 4 }}
                handleStyle={{
                  borderColor: '#0073ff',
                  height: 14,
                  width: 14,
                  marginTop: -5,
                  backgroundColor: '#fff',
                }}
              />
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ✅ Right Panel */}
      <div className={styles.right}>
        <div className={styles.tabs}>
          <button
            ref={tabsRef.settings}
            className={activeRightTab === 'settings' ? styles.active : ''}
            onClick={() => setActiveRightTab('settings')}
          >
          Settings
          </button>
          <button
            ref={tabsRef.voiceLibrary}
            className={activeRightTab === 'voiceLibrary' ? styles.active : ''}
            onClick={() => setActiveRightTab('voiceLibrary')}
          >
            Voice Library
          </button>
          <div
            className={styles.tabIndicator}
            style={{ left: indicatorLeft, width: indicatorWidth }}
          />
        </div>

        {activeRightTab === 'settings' ? (
          <Settings
            speed={speed}
            setSpeed={setSpeed}
            language={language}
            setLanguage={setLanguage}
            autoDetect={autoDetect}
            setAutoDetect={setAutoDetect}
            fileName={fileName}
            setFileName={setFileName}
            fileFormat={fileFormat}
            setFileFormat={setFileFormat}
            selectedVoice={selectedVoice}
            setSelectedVoice={(voice) => setSelectedVoice(voice)}
            dialogueMode={dialogueMode}
            setDialogueMode={setDialogueMode}
            setSpeakers={setSpeakers}
            goToVoiceLibrary={() => setActiveRightTab('voiceLibrary')}
            seed={seed}
            setSeed={setSeed}
          />
        ) : (
          <VoiceLibrary
            goToVoiceCloning={() => setActiveTab('cloning')}
            setSelectedVoiceFromLibrary={(voice) => {
              setSelectedVoice({
                id: voice.id,
                name: voice.name,
                avatar: voice.avatar_url || avatar,
                reference_audio_url: voice.reference_audio_url,
                reference_transcript: voice.reference_transcript,
                voice_type: voice.voice_type || 'cloned',
              });
              setActiveRightTab('settings');
            }}
          />
        )}
      </div>
    </div>
  );
};

export default TextToSpeech;
