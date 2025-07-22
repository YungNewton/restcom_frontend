import { useState, useEffect } from 'react';
import styles from './Voice.module.css';
import NavTabs from '../NavTabs/NavTabs';
import VoiceCloning from './VoiceCloning/VoiceCloning';
import TextToSpeech from './TextToSpeech/TextToSpeech';
import SpeechToText from './SpeechToText/SpeechToText';
import { toast } from 'react-hot-toast';

const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const Voice = () => {
  const [activeTab, setActiveTab] = useState<'cloning' | 'tts' | 'stt'>('tts');
  const [engineOnline, setEngineOnline] = useState(true);

  useEffect(() => {
    const eventSource = new EventSource(`${VITE_API_BASE_URL}/voice/status/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const isOnline = !!data.online;
        setEngineOnline(isOnline);

        if (isOnline) {
          toast.success('Voice Engine is live.');
        } else {
          toast.error('Voice Engine offline.');
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      eventSource.close();
      setEngineOnline(false);
    };

    return () => {
      eventSource.close();
    };
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
          />
        )}
      </div>
    </div>
  );
};

export default Voice;
