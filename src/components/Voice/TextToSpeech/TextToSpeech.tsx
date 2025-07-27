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
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
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

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

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

  type ClonedVoice = {
    id: string;
    name: string;
    avatar: string;
    reference_audio_url: string;
    reference_transcript: string;
    voice_type: 'cloned' | 'seed';
  };
  
  type Speaker = {
    id: number;
    voice: ClonedVoice; // each speaker can use a different cloned voice
  };
  
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
  const [audioKey, setAudioKey] = useState(0);

  const sampleTexts = [
    "[S1] Morning, Alex! (laughs)\n[S2] You're in a good mood today.\n[S1] Coffee does that to me.\n[S2] Then let’s grab one before the meeting, shall we?",
    "Welcome to our daily briefing. (clears throat) Today, we’ll talk about three major updates, starting with our product launch timeline and marketing goals.",
    "The weekend’s here! (sighs) Finally, a chance to unwind, read that book you’ve been ignoring, and maybe even take a nap or two. You deserve it.",
    "[S1] Did you hear that sound? (gasps)\n[S2] Relax, it’s just the wind.\n[S1] Well, it sounded like footsteps.\n[S2] (laughs) Too many late-night movies.",
    "[S1] Oh, come on, don’t look at me like that.\n[S2] (chuckle) I’m not saying a word.\n[S1] You’re impossible!\n[S2] And yet, you still like me.",
    "Reading a good book is like traveling to another world. Each page unfolds new adventures, perspectives, and emotions, all from the comfort of your favorite chair.",
    "Every great achievement starts with a single step forward. With determination, persistence, and belief in your vision, even the most difficult goals become possible.",
    "The sun dipped below the horizon, painting the sky in hues of orange and purple. A gentle breeze carried the scent of pine and fresh grass, while the first stars began to twinkle above.",
    "Technology continues to shape our lives in remarkable ways. From voice assistants to artificial intelligence, the pace of innovation is accelerating faster than ever before.",
    "Imagine a peaceful morning walk through a quiet park. The soft rustle of leaves, distant birdsong, and warm sunlight create the perfect moment of calm and reflection."
  ];

  
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
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalFiles = [...uploadedFiles, ...files];
    if (totalFiles.length > 5) return toast.error('Max 5 files allowed.');
    setUploadedFiles(totalFiles);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };  

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;
  
    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };
  
  const skipForward = (seconds = 5) => {
    const audio = audioRef.current;
    if (!audio) return;
  
    const dur = Number.isFinite(audio.duration) ? audio.duration : duration || 0;
    audio.currentTime = Math.min(audio.currentTime + seconds, dur);
  };
  
  const skipBackward = (seconds = 5) => {
    const audio = audioRef.current;
    if (!audio) return;
  
    audio.currentTime = Math.max(audio.currentTime - seconds, 0);
  };
  
  const handleSliderChange = (value: number | number[]) => {
    const v = Array.isArray(value) ? value[0] : value;
    const audio = audioRef.current;
    if (!audio) return;
  
    audio.currentTime = v;
    setCurrentTime(v);
  };
  
  const onLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
  
    const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
    setDuration(dur);
  };
  
  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
  
    setCurrentTime(audio.currentTime);
  };
  
  const onEnded = () => {
    setIsPlaying(false);
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

  function appendAudioData(fd: FormData, urls: string[], transcripts: string[]) {
    urls.forEach((url) => fd.append('audio_urls', url));
    transcripts.forEach((t) => fd.append('prompt_transcripts', t));  // FIXED key
  }     

  function getDialogueAudioUrls(): string[] {
    // Use speakers if available, else fallback to selectedVoice
    if (speakers.length > 0) {
      return speakers
        .map((s) => s.voice.reference_audio_url)
        .filter((url): url is string => !!url);
    }
    if (selectedVoice.reference_audio_url) {
      return [selectedVoice.reference_audio_url];
    }
    return [];
  }
  
  function getDialoguePromptTranscripts(): string[] {
    if (speakers.length > 0) {
      return speakers.map((s) => s.voice.reference_transcript || '');
    }
    return selectedVoice.reference_transcript ? [selectedVoice.reference_transcript] : [];
  }
  

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
    if (!text.trim() && uploadedFiles.length === 0) {
      toast.error('Please enter text or upload a file.');
      return;
    }    
  
    const controller = new AbortController();
    abortControllerRef.current = controller;
  
    setIsGenerating(true);
    setShowPlayback(false);
  
    try {
      toast.loading('Starting synthesis...');
  
      // === BRANCH 1: Random / Seed ===
      if (isSeedOrRandom(selectedVoice)) {
        const fd = new FormData();
        if (uploadedFiles.length > 0) {
          uploadedFiles.forEach((file) => fd.append('files', file));
        } else {
          fd.append('text', text);
        }
        fd.append('output_format', fileFormat); // "wav" | "mp3"
        fd.append('speed', String(speed));
        fd.append('seeds', buildSeedsPayload());
  
        const res = await axios.post(
          `${VOICE_ENGINE_API_BASE_URL}/tts/tts/`,
          fd,
          {
            withCredentials: true,
            signal: controller.signal,
          }
        );
  
        const id = res.data.task_id;
        setTaskId(id);
        toast.success('Generation started.');
        await pollAndFetchAudio(id);
        return;
      }
  
      // === BRANCH 2: Cloned voice ===
      if (isClonedVoice(selectedVoice)) {
        if (!selectedVoice.reference_audio_url || !selectedVoice.reference_transcript) {
          throw new Error('Selected cloned voice is missing reference audio or transcript.');
        }
  
        const fd = new FormData();
        const urls = getDialogueAudioUrls();
        const transcripts = getDialoguePromptTranscripts();

        if (urls.length === 0 || transcripts.length === 0) {
          toast.error('Missing audio URLs or transcripts for cloning.');
          setIsGenerating(false);
          return;
        }

        appendAudioData(fd, urls, transcripts);

        if (uploadedFiles.length > 0) {
          uploadedFiles.forEach((file) => fd.append('files', file));
        } else {
          fd.append('text', text);
        }
        fd.append('speed', String(speed));
        fd.append('output_format', fileFormat);
        fd.append('dialogue_mode', dialogueMode ? '1' : '0');
        fd.append('language', language || 'en');
  
        const res = await axios.post(
          `${VOICE_ENGINE_API_BASE_URL}/cloning/clone/`,
          fd,
          {
            withCredentials: true,
            signal: controller.signal,
          }
        );
  
        const id = res.data.task_id;
        setTaskId(id);
        toast.success('Generation started.');
        await pollAndFetchAudio(id);
        return;
      }
  
      // If we get here, it's an unsupported branch for now
      toast.error('Unsupported voice type.');
    } catch (err: any) {
      toast.dismiss();
      if (axios.isCancel(err)) {
        toast('Request cancelled.');
      } else {
        console.error(err);
        toast.error(err?.response?.data?.detail || err.message || 'Failed to start generation.');
      }
      setIsGenerating(false);
    }
  };  

  const pollAndFetchAudio = async (id: string, intervalMs = 1500, timeoutMs = 3000000) => {
    const start = Date.now();
  
    while (true) {
      if (Date.now() - start > timeoutMs) {
        setIsGenerating(false);
        toast.dismiss();
        toast.error('Timed out while generating audio.');
        throw new Error('TTS timeout');
      }
  
      try {
        const res = await fetch(`${VOICE_ENGINE_API_BASE_URL}/cloning/task-status/${id}`, {
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
          setAudioKey((k) => k + 1);  // force <audio> remount
          setCurrentTime(0);
          setDuration(0);
          setIsPlaying(false);
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

                // fallback to selectedVoice if it's a cloned voice
                if (!selectedVoice.reference_audio_url || !selectedVoice.reference_transcript) {
                  toast.error('Pick a cloned voice first to add a speaker.');
                  return;
                }

                const voice: ClonedVoice = {
                  id: selectedVoice.id,
                  name: selectedVoice.name,
                  avatar: selectedVoice.avatar,
                  reference_audio_url: selectedVoice.reference_audio_url,
                  reference_transcript: selectedVoice.reference_transcript,
                  voice_type: selectedVoice.voice_type || 'cloned',
                };

                setSpeakers(prev => [...prev, { id: nextId, voice }]);
              }}
            >
              + Add Speaker
            </button>

            <div className={styles.speakerList} ref={speakerListRef}>
              {speakers.map((speaker, index) => (
                <div key={speaker.id} className={styles.speakerCard}>
                  <img src={avatar} alt="speaker avatar" className={styles.avatar} />
                  <div className={styles.speakerDetails}>
                    <span className={styles.voiceName}>{speaker.voice.name}</span>
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

        {/* Sample Text Suggestions */}
        <div className={styles.sampleTextBar}>
          {sampleTexts.map((item, idx) => (
            <button
              key={idx}
              className={styles.sampleTextBtn}
              onClick={() => setText(item)}
            >
              {item}
            </button>
          ))}
        </div>

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
              multiple
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <div className={styles.uploadInner}>
              <Upload size={22} />
              <p>Click to upload or drag & drop</p>
              <p className={styles.subText}>.txt, .pdf, .docx, .md, .rtf</p>
            </div>
          </label>
        </div>

        {uploadedFiles.length > 0 && (
        <ul className={styles.fileList}>
          {uploadedFiles.map((file, i) => (
            <li key={i}>
              {file.name}
              <Trash2
                size={14}
                onClick={() => removeFile(i)}
                className={styles.trash}
              />
            </li>
          ))}
        </ul>
      )}

        <div className={styles.actionRow}>
          {engineOnline ? (
            <button
              className={styles.generateBtn}
              onClick={isGenerating ? handleCancelGenerate : handleGenerate}
              disabled={false}
            >
              {isGenerating ? (
                <>
                  <span className={styles.spinner}></span>
                  Cancel
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
            <audio
              key={audioKey}
              ref={audioRef}
              src={audioUrl}
              preload="metadata"
              onLoadedMetadata={onLoadedMetadata}
              onTimeUpdate={onTimeUpdate}
              onEnded={onEnded}
            />

            <div className={styles.audioControls}>
              <div className={styles.tooltipWrapper} data-tooltip="Back 5s">
                <button onClick={() => skipBackward(5)}>«</button>
              </div>
              <div className={styles.tooltipWrapper} data-tooltip={isPlaying ? 'Pause' : 'Play'}>
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
                value={Math.min(currentTime, duration || 0)}
                onChange={handleSliderChange}
                disabled={!duration}
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
              <span>{formatTime(Math.max(duration - currentTime, 0))}</span>
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
