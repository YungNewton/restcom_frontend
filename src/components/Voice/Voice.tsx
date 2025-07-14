import { useState, useEffect } from 'react';
import styles from './Voice.module.css';
import NavTabs from '../NavTabs/NavTabs';
import VoiceCloning from './VoiceCloning/VoiceCloning';
import TextToSpeech from './TextToSpeech/TextToSpeech';
import SpeechToText from './SpeechToText/SpeechToText';

const VOICE_ENGINE_API_BASE_URL = import.meta.env.VITE_VOICE_ENGINE_API_BASE_URL;

const Voice = () => {
  const [activeTab, setActiveTab] = useState<'cloning' | 'tts' | 'stt'>('tts');
  const [engineOnline, setEngineOnline] = useState(false);

  useEffect(() => {
    const checkEngineHealth = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000); // 3 sec timeout
  
      try {
        const res = await fetch(`${VOICE_ENGINE_API_BASE_URL}/health`, {
          signal: controller.signal,
        });
        if (res.ok) {
          setEngineOnline(true);
        } else {
          setEngineOnline(false);
        }
      } catch {
        setEngineOnline(false);
      } finally {
        clearTimeout(timeout);
      }
    };
  
    checkEngineHealth(); // initial call
  
    const interval = setInterval(checkEngineHealth, 5000); // poll every 5s
  
    return () => clearInterval(interval); // cleanup on unmount
  }, []);  

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
          <SpeechToText 
            engineOnline={engineOnline} 
            setEngineOnline={setEngineOnline} 
          />
        )}
      </div>
    </div>
  );
};

export default Voice;
