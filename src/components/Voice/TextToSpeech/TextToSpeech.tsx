import { useEffect, useRef, useState } from 'react';
import {
  Upload, Play, Pause, RotateCcw, Download, Trash2, Info, ChevronDown, 
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

interface TextToSpeechProps {
  setActiveTab: (tab: 'cloning' | 'tts' | 'stt') => void;
  engineOnline: boolean;
  externalSelectedVoice?: { id: string; name: string; avatar: string } | null;
  clearExternalVoice?: () => void;
  setEngineOnline: (status: boolean) => void;
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

  const [selectedVoice, setSelectedVoice] = useState({
    id: 'random',
    name: 'Random',
    avatar,
  });


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
      if (dialogueMode) setDialogueMode(false); // turn off dialogue mode
      setSpeakers([]); // clear speakers
      clearExternalVoice?.();
    }
  }, [externalSelectedVoice]);  

  const handleGenerate = () => {
    if (!engineOnline) {
      toast.error('Voice Engine is Offline');
      return;
    }

    const payload = {
      text,
      voice: selectedVoice,
      speed,
      language,
      autoDetect,
      fileName,
      fileFormat,
    };
    console.log('Submitting settings:', payload);
    setShowPlayback(true);
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
            <button className={styles.generateBtn} onClick={handleGenerate}>
              Generate Speech
            </button>
          ) : (
            <button className={styles.generateBtn} onClick={handleStartEngine}>
              Start Voice Engine
            </button>
          )}
        </div>

        {showPlayback && (
          <div className={styles.playbackContainer}>
            <div className={styles.audioControls}>
              <div className={styles.tooltipWrapper} data-tooltip="Play">
                <button><Play size={20} /></button>
              </div>
              <div className={styles.tooltipWrapper} data-tooltip="Pause">
                <button><Pause size={20} /></button>
              </div>
              <div className={styles.tooltipWrapper} data-tooltip="Reset">
                <button><RotateCcw size={20} /></button>
              </div>
              <div className={styles.tooltipWrapper} data-tooltip="Download">
                <button><Download size={20} /></button>
              </div>
            </div>

            <div className={styles.timeline}>
              <div className={styles.voiceTag}>
                <img src={selectedVoice.avatar} alt="avatar" />
                <span>Output: {selectedVoice.name}</span>
              </div>
              <span>0:00</span>
              <Slider
                min={0}
                max={100}
                defaultValue={0}
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
              <span>0:00</span>
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
            setSelectedVoice={(voice) => {
              setSelectedVoice(voice);
            }}            
            dialogueMode={dialogueMode}
            setDialogueMode={setDialogueMode}
            setSpeakers={setSpeakers}
            goToVoiceLibrary={() => setActiveRightTab('voiceLibrary')}
            seed={seed}
            setSeed={setSeed}
          />
        ) : (
          <VoiceLibrary
            goToVoiceCloning={() => {
              setActiveTab('cloning');
            }}
            setSelectedVoiceFromLibrary={(voice) => {
              setSelectedVoice({
                id: voice.id,
                name: voice.name,
                avatar: voice.avatar_url || avatar
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
