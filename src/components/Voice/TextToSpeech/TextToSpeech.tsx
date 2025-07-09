import { useEffect, useRef, useState } from 'react';
import {
  Upload, Play, Pause, RotateCcw, Download, Info, Trash2
} from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { toast } from 'react-hot-toast';

import styles from './TextToSpeech.module.css';
import avatar from '../../../assets/voice-avatar.png';

import Settings from './Right/Settings/Settings';
import VoiceLibrary from './Right/VoiceLibrary/VoiceLibrary';

const voices = [
  { id: 'default_male', name: 'Default Male', avatar },
  { id: 'default_female', name: 'Default Female', avatar },
  { id: 'isaac', name: 'Isaac', avatar },
];

interface TextToSpeechProps {
  setActiveTab: (tab: 'cloning' | 'tts' | 'stt') => void;
  engineOnline: boolean;
  setEngineOnline: (status: boolean) => void;
}

const TextToSpeech: React.FC<TextToSpeechProps> = ({
  setActiveTab,
  engineOnline,
}) => {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(voices[0]);
  const [showPlayback, setShowPlayback] = useState(false);

  const [dialogueMode, setDialogueMode] = useState(false);
  const [speakers, setSpeakers] = useState<{ id: number; voiceName: string }[]>([]);
  const speakerListRef = useRef<HTMLDivElement>(null);

  const [speed, setSpeed] = useState(1);
  const [language, setLanguage] = useState('English');
  const [autoDetect, setAutoDetect] = useState(false);
  const [fileName, setFileName] = useState('output');
  const [fileFormat, setFileFormat] = useState('mp3');

  const [activeRightTab, setActiveRightTab] = useState<'settings' | 'voiceLibrary'>('settings');

  const tabsRef = {
    settings: useRef<HTMLButtonElement>(null),
    voiceLibrary: useRef<HTMLButtonElement>(null),
  };

  const [indicatorLeft, setIndicatorLeft] = useState('0px');
  const [indicatorWidth, setIndicatorWidth] = useState('0px');

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

  const handleStartEngine = () => {
    toast.error('Failed to start Voice Engine. Service is not running.');
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
          />
        ) : (
          <VoiceLibrary
            goToVoiceCloning={() => {
              setActiveTab('cloning');
            }}
          />
        )}
      </div>
    </div>
  );
};

export default TextToSpeech;
