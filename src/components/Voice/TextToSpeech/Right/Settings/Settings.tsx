import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import styles from './Settings.module.css';

import avatar from '../../../../../assets/voice-avatar.png';

interface SettingsProps {
  speed: number;
  setSpeed: (value: number) => void;
  language: string;
  setLanguage: (value: string) => void;
  autoDetect: boolean;
  setAutoDetect: (value: boolean) => void;
  fileName: string;
  setFileName: (value: string) => void;
  fileFormat: string;
  setFileFormat: (value: string) => void;
  selectedVoice: { id: string; name: string; avatar: string };
  setSelectedVoice: (voice: { id: string; name: string; avatar: string }) => void;
  goToVoiceLibrary: () => void;
}

const voices = [
  { id: 'isaac', name: 'Isaac', avatar },
  { id: 'default_male', name: 'Default Male', avatar },
  { id: 'default_female', name: 'Default Female', avatar },
];

const languages = ['English', 'French', 'Spanish', 'German', 'Chinese'];
const fileFormats = ['mp3', 'wav'];

const Settings: React.FC<SettingsProps> = ({
  speed,
  setSpeed,
  language,
  setLanguage,
  autoDetect,
  setAutoDetect,
  fileName,
  setFileName,
  fileFormat,
  setFileFormat,
  selectedVoice,
  setSelectedVoice,
  goToVoiceLibrary,
}) => {
  const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);

  const handleSelectVoice = (voice: typeof voices[0]) => {
    setSelectedVoice(voice);
    setShowVoiceDropdown(false);
  };

  return (
    <div className={styles.wrapper}>
      {/* 🔥 Voice Selector */}
      <div className={styles.section}>
        <label className={styles.label}>Voice</label>
        <div className={styles.voicePanel}>
          <div
            className={styles.voiceSelector}
            onClick={() => setShowVoiceDropdown(!showVoiceDropdown)}
          >
            <img src={selectedVoice.avatar} alt="avatar" className={styles.avatar} />
            <span className={styles.voiceName}>{selectedVoice.name}</span>
            <ChevronDown size={16} color="white" />
          </div>
          {showVoiceDropdown && (
            <div className={styles.dropdown}>
              {voices.map((voice) => (
                <div
                  key={voice.id}
                  className={styles.dropdownItem}
                  onClick={() => handleSelectVoice(voice)}
                >
                  <img src={voice.avatar} alt="avatar" className={styles.avatar} />
                  <span>{voice.name}</span>
                </div>
              ))}
              <div
                className={styles.manageVoices}
                onClick={() => {
                  setShowVoiceDropdown(false);
                  goToVoiceLibrary();
                }}
              >
                Manage Voices →
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🔥 Speed */}
      <div className={styles.section}>
        <label className={styles.label}>Speed</label>
        <div className={styles.sliderWrapper}>
          <Slider
            min={0.5}
            max={2.0}
            step={0.01}
            value={speed}
            onChange={(value) => setSpeed(value as number)}
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
          <div className={styles.speedTag}>
            {`${speed.toFixed(2)}x`}
          </div>
        </div>
        <div className={styles.sliderLabels}>
          <span>Slower</span>
          <span>Faster</span>
        </div>
      </div>

      {/* 🔥 Language */}
      <div className={styles.section}>
        <label className={styles.label}>Language</label>
        <div
          className={`${styles.voicePanel} ${autoDetect ? styles.disabled : ''}`}
          onClick={() => {
            if (!autoDetect) setShowLanguageDropdown(!showLanguageDropdown);
          }}
        >
          <div className={styles.voiceSelector}>
            <span className={styles.voiceName}>{language}</span>
            <ChevronDown size={16} color="white" />
          </div>
          {showLanguageDropdown && (
            <div className={styles.dropdown}>
              {languages.map((lang) => (
                <div
                  key={lang}
                  className={styles.dropdownItem}
                  onClick={() => {
                    setLanguage(lang);
                    setShowLanguageDropdown(false);
                  }}
                >
                  <span>{lang}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.toggleRow}>
          <div
            className={`${styles.checkbox} ${autoDetect ? styles.checked : ''}`}
            onClick={() => setAutoDetect(!autoDetect)}
          />
          <label htmlFor="autoDetect">
            Auto detect from text <br />
            <span className={styles.subText}>
              (May not work for unsupported languages or texts less than 20 characters)
            </span>
          </label>
        </div>
      </div>

      {/* 🔥 File Name */}
      <div className={styles.section}>
        <label className={styles.label}>Output File Name</label>
        <input
          type="text"
          className={styles.input}
          placeholder="e.g. my_audio"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
        />
      </div>

      {/* 🔥 File Format */}
      <div className={styles.section}>
        <label className={styles.label}>File Format</label>
        <div
          className={styles.voicePanel}
          onClick={() => setShowFormatDropdown(!showFormatDropdown)}
        >
          <div className={styles.voiceSelector}>
            <span className={styles.voiceName}>{fileFormat.toUpperCase()}</span>
            <ChevronDown size={16} color="white" />
          </div>
          {showFormatDropdown && (
            <div className={styles.dropdown}>
              {fileFormats.map((format) => (
                <div
                  key={format}
                  className={styles.dropdownItem}
                  onClick={() => {
                    setFileFormat(format);
                    setShowFormatDropdown(false);
                  }}
                >
                  <span>{format.toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
