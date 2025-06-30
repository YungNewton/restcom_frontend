import { useState } from 'react';
import styles from './Voice.module.css';
import NavTabs from '../NavTabs/NavTabs';
import VoiceCloning from './VoiceCloning/VoiceCloning';
import TextToSpeech from './TextToSpeech/TextToSpeech';
import SpeechToText from './SpeechToText/SpeechToText';

const Voice = () => {
  const [activeTab, setActiveTab] = useState<'cloning' | 'tts' | 'stt'>('cloning');

  const [engineOnline, setEngineOnline] = useState(false);

  return (
    <div className={styles.wrapper}>
      <NavTabs />
      
      <div className={styles.tabNavRow}>
        <div className={styles.tabNav}>
          <button
            className={`${styles.tab} ${activeTab === 'tts' ? styles.active : ''}`}
            onClick={() => setActiveTab('tts')}
          >
            Text to Speech
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'cloning' ? styles.active : ''}`}
            onClick={() => setActiveTab('cloning')}
          >
            Voice Cloning
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'stt' ? styles.active : ''}`}
            onClick={() => setActiveTab('stt')}
          >
            Speech to Text
          </button>
        </div>

        <div className={styles.engineStatus}>
          <div
            className={`${styles.statusDot} ${
              engineOnline ? styles.online : styles.offline
            }`}
          ></div>
          <span>Voice Engine {engineOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      <div className={styles.content}>
        {activeTab === 'cloning' && (
          <VoiceCloning 
          setActiveTab={setActiveTab} 
          engineOnline={engineOnline} 
          setEngineOnline={setEngineOnline} 
        />        
        )}

        {activeTab === 'tts' && (
          <TextToSpeech 
          setActiveTab={setActiveTab} 
          engineOnline={engineOnline} 
          setEngineOnline={setEngineOnline} 
        />
        )}

        {activeTab === 'stt' && (
          <SpeechToText />
        )}
      </div>
    </div>
  );
};

export default Voice;
