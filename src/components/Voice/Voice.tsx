// src/components/Voice/Voice.tsx
import { useState, useEffect } from 'react';
import styles from './Voice.module.css';
import NavTabs from '../NavTabs/NavTabs';
import VoiceCloning from './VoiceCloning/VoiceCloning';
import TextToSpeech from './TextToSpeech/TextToSpeech';
import SpeechToText from './SpeechToText/SpeechToText';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const VOICE_ENGINE_API_BASE_URL = import.meta.env.VITE_VOICE_ENGINE_API_BASE_URL;

type VoiceTab = 'cloning' | 'tts' | 'stt';
export type VoiceService = 'cloning' | 'tts' | 'stt';
export type STTFileFormat = 'txt' | 'vtt' | 'srt';
export type TTSFileFormat = 'wav' | 'mp3';

const Voice = () => {
  const [activeTab, setActiveTab] = useState<VoiceTab>('tts');
  const [engineOnline, setEngineOnline] = useState(false);
  const [selectedVoiceForTTS, setSelectedVoiceForTTS] = useState<any | null>(null);

  // ✅ Centralized task tracking (one active voice task at a time)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeTaskService, setActiveTaskService] = useState<VoiceService | null>(null);

  // ✅ Central STT result state (survives tab switches)
  const [sttTranscript, setSttTranscript] = useState('');
  const [sttDownloadLink, setSttDownloadLink] = useState<string | null>(null);
  const [sttOutputName, setSttOutputName] = useState('transcript');
  const [sttFileFormat, setSttFileFormat] = useState<STTFileFormat>('txt');

  // ✅ Central TTS result state (survives tab switches)
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsAudioBlob, setTtsAudioBlob] = useState<Blob | null>(null);
  const [ttsFileName, setTtsFileName] = useState('output');
  const [ttsFileFormat, setTtsFileFormat] = useState<TTSFileFormat>('wav');
  const [ttsOutputVoice, setTtsOutputVoice] = useState<{
    id: string;
    name: string;
    avatar: string;
    reference_audio_url?: string | null;
    reference_transcript?: string | null;
    voice_type?: 'cloned' | 'seed';
  } | null>(null);

  // Helper: fire-and-forget cancel on the Voice Engine
  const cancelTaskOnServer = (taskId: string | null) => {
    if (!taskId) return;
    try {
      const formData = new FormData();
      formData.append('task_id', taskId);
      // Generic "voice namespace" cancel endpoint – works for cloning / tts / stt Celery tasks
      axios
        .post(`${VOICE_ENGINE_API_BASE_URL}/cloning/cancel/`, formData, {
          withCredentials: true,
        })
        .catch((err) => {
          console.error('Failed to cancel voice task on server:', err);
        });
    } catch (err) {
      console.error('Error preparing cancel request:', err);
    }
  };

  // Called by children when they start a new async task
  const registerTask = (service: VoiceService, taskId: string) => {
    // Cancel any previous task when a new one starts
    if (activeTaskId && activeTaskId !== taskId) {
      cancelTaskOnServer(activeTaskId);
    }
    setActiveTaskId(taskId);
    setActiveTaskService(service);
  };

  // Called by children when a task settles (SUCCESS / FAILURE / CANCELLED)
  const clearTask = () => {
    setActiveTaskId(null);
    setActiveTaskService(null);
  };

  // Optional: children can invoke this to request a global cancel
  const cancelActiveTask = () => {
    if (!activeTaskId) return;
    cancelTaskOnServer(activeTaskId);
    setActiveTaskId(null);
    setActiveTaskService(null);
  };

  // On unmount of <Voice />, automatically cancel any in-flight task
  useEffect(() => {
    return () => {
      if (activeTaskId) {
        cancelTaskOnServer(activeTaskId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTaskId]);

  // Revoke TTS audio URL when replaced / component unmounts
  useEffect(() => {
    return () => {
      if (ttsAudioUrl) {
        try {
          URL.revokeObjectURL(ttsAudioUrl);
        } catch (e) {
          console.warn('Failed to revoke TTS audio URL', e);
        }
      }
    };
  }, [ttsAudioUrl]);

  // Voice Engine status via SSE
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
          // Optionally show offline notice
          // toast.error('Voice Engine offline.');
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
            type="button"
          >
            Text to Speech
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'cloning' ? styles.active : ''}`}
            onClick={() => setActiveTab('cloning')}
            type="button"
          >
            Voice Cloning
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'stt' ? styles.active : ''}`}
            onClick={() => setActiveTab('stt')}
            type="button"
          >
            Speech to Text
          </button>
        </div>

        <div
          className={`${styles.engineStatus} ${engineOnline ? styles.onlineStatus : ''}`}
        >
          <div
            className={`${styles.statusDot} ${
              engineOnline ? styles.online : styles.offline
            }`}
          />
          <span>Voice Engine {engineOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      <div className={styles.content}>
        {activeTab === 'cloning' && (
          <VoiceCloning
            setActiveTab={setActiveTab}
            engineOnline={engineOnline}
            setSelectedVoiceForTTS={setSelectedVoiceForTTS}
          />
        )}

        {activeTab === 'tts' && (
          <TextToSpeech
            setActiveTab={setActiveTab}
            engineOnline={engineOnline}
            externalSelectedVoice={selectedVoiceForTTS}
            clearExternalVoice={() => setSelectedVoiceForTTS(null)}
            // central task helpers
            registerTask={registerTask}
            clearTask={clearTask}
            cancelActiveTask={cancelActiveTask}
            activeTaskId={activeTaskId}
            activeTaskService={activeTaskService}
            // central TTS result state
            ttsAudioUrl={ttsAudioUrl}
            setTtsAudioUrl={setTtsAudioUrl}
            ttsAudioBlob={ttsAudioBlob}
            setTtsAudioBlob={setTtsAudioBlob}
            ttsOutputVoice={ttsOutputVoice}
            setTtsOutputVoice={setTtsOutputVoice}
            ttsFileName={ttsFileName}
            setTtsFileName={setTtsFileName}
            ttsFileFormat={ttsFileFormat}
            setTtsFileFormat={setTtsFileFormat}
          />
        )}

        {activeTab === 'stt' && (
          <SpeechToText
            engineOnline={engineOnline}
            // central task helpers
            registerTask={registerTask}
            clearTask={clearTask}
            cancelActiveTask={cancelActiveTask}
            activeTaskId={activeTaskId}
            activeTaskService={activeTaskService}
            // central STT result state
            transcript={sttTranscript}
            setTranscript={setSttTranscript}
            downloadLink={sttDownloadLink}
            setDownloadLink={setSttDownloadLink}
            outputName={sttOutputName}
            setOutputName={setSttOutputName}
            fileFormat={sttFileFormat}
            setFileFormat={setSttFileFormat}
          />
        )}
      </div>
    </div>
  );
};

export default Voice;
