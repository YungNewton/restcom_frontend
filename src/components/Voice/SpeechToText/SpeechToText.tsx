// src/components/Voice/SpeechToText/SpeechToText.tsx
import { useState, useRef, useEffect } from 'react';
import { Upload, Trash, ChevronDown, Download, Send } from 'lucide-react';
import styles from './SpeechToText.module.css';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import type { VoiceService, STTFileFormat } from '../Voice';

interface Props {
  engineOnline: boolean;

  // 🔁 Central task management from <Voice />
  registerTask: (service: VoiceService, taskId: string) => void;
  clearTask: () => void;
  cancelActiveTask: () => void;
  activeTaskId: string | null;
  activeTaskService: VoiceService | null;

  // ✅ Central STT result state from <Voice />
  transcript: string;
  setTranscript: (value: string) => void;
  downloadLink: string | null;
  setDownloadLink: (value: string | null) => void;
  outputName: string;
  setOutputName: (value: string) => void;
  fileFormat: STTFileFormat;
  setFileFormat: (value: STTFileFormat) => void;
}

const formats: STTFileFormat[] = ['txt', 'vtt', 'srt'];
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const VOICE_ENGINE_API_BASE_URL = import.meta.env.VITE_VOICE_ENGINE_API_BASE_URL;

const SpeechToText = ({
  engineOnline,
  registerTask,
  clearTask,
  cancelActiveTask,
  activeTaskId,
  activeTaskService,
  transcript,
  setTranscript,
  downloadLink,
  setDownloadLink,
  outputName,
  setOutputName,
  fileFormat,
  setFileFormat,
}: Props) => {
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [autoPunctuation, setAutoPunctuation] = useState(true);
  const [profanityFilter, setProfanityFilter] = useState(false);
  const [smartContext, setSmartContext] = useState(true);
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const pollRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 🔚 Cleanup on unmount (component-level):
  // - Clear polling interval
  // - Abort any in-flight HTTP request
  // Do NOT cancel the backend task here. <Voice /> handles that on page leave.
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔁 If we come back to STT and there is an active global STT task,
  // re-attach polling so the UI keeps up with the backend.
  useEffect(() => {
    if (
      activeTaskService === 'stt' &&
      activeTaskId &&
      !isTranscribing &&
      !pollRef.current // avoid double attaching
    ) {
      setIsTranscribing(true);
      pollTaskStatus(activeTaskId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTaskId, activeTaskService]);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalFiles = [...audioFiles, ...files];
    if (totalFiles.length > 5) return toast.error('Max 5 files allowed.');
    const oversized = totalFiles.find((file) => file.size > 50 * 1024 * 1024);
    if (oversized) return toast.error(`"${oversized.name}" exceeds 50MB limit.`);
    setAudioFiles(totalFiles);
  };

  const removeFile = (index: number) => {
    const updated = [...audioFiles];
    updated.splice(index, 1);
    setAudioFiles(updated);
  };

  const handleCancelTask = () => {
    // Stop frontend work
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsTranscribing(false);
    setDownloadLink(null);
    setTranscript('');

    // Tell global manager to cancel on server (only if this is the active STT task)
    if (activeTaskService === 'stt') {
      cancelActiveTask();
    }

    toast.success('Transcription cancelled.');
  };

  const handleTranscribe = async () => {
    if (audioFiles.length === 0) {
      return toast.error('Please upload at least one audio file.');
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsTranscribing(true);
    setTranscript('');
    setDownloadLink(null);

    const formData = new FormData();
    audioFiles.forEach((file) => formData.append('files', file));
    formData.append('output_name', outputName);
    formData.append('file_format', fileFormat);
    formData.append('profanity_filter', String(profanityFilter));
    // autoPunctuation + smartContext can be added to the backend later

    try {
      const res = await axios.post(
        `${VOICE_ENGINE_API_BASE_URL}/stt/transcribe/`,
        formData,
        { signal: controller.signal }
      );

      const id = res.data.task_id as string;

      // 🔁 Register this as the active STT task globally
      registerTask('stt', id);

      toast.success('Transcription started.');
      pollTaskStatus(id);
    } catch (err: any) {
      if (axios.isCancel(err)) {
        console.log('STT request canceled by user');
      } else {
        toast.error('Failed to start transcription.');
      }
      setIsTranscribing(false);
    }
  };

  const pollTaskStatus = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = window.setInterval(async () => {
      try {
        const res = await axios.get(`${VOICE_ENGINE_API_BASE_URL}/task-status/${id}`);
        const { state, result } = res.data;

        if (['SUCCESS', 'FAILURE', 'REVOKED', 'CANCELLED'].includes(state)) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setIsTranscribing(false);

          // If this STT task was the globally active one, clear it
          if (activeTaskService === 'stt' && activeTaskId === id) {
            clearTask();
          }

          if (state === 'SUCCESS') {
            const transcriptText = result?.transcript || '';
            setTranscript(transcriptText);

            const mimeType =
              fileFormat === 'srt'
                ? 'application/x-subrip'
                : fileFormat === 'vtt'
                ? 'text/vtt'
                : 'text/plain';

            const blob = new Blob([transcriptText], { type: mimeType });
            const downloadUrl = URL.createObjectURL(blob);
            setDownloadLink(downloadUrl);
            toast.success('Transcription complete.');
          } else if (state === 'CANCELLED' || state === 'REVOKED') {
            toast('Transcription cancelled on server.');
          } else {
            toast.error(`Transcription ${state.toLowerCase()}.`);
          }
        }
      } catch (err: any) {
        if (axios.isCancel?.(err)) {
          return;
        }
        console.error('Polling error:', err);
      }
    }, 4000);
  };

  const handleStartEngine = async () => {
    const t = toast.loading('Starting Voice Engine…');
    try {
      const res = await axios.post(`${API_BASE_URL}/voice/start-runpod/`);
      toast.dismiss(t);

      const statusText = res.data.status;
      if (['RUNNING', 'STARTING', 'REQUESTED'].includes(statusText)) {
        toast.success('Voice Engine is starting.');
      } else if (statusText === 'HEALTHY') {
        toast.success('Voice Engine is already live. Refresh the page if needed.');
      } else {
        toast.error(`Engine status: ${statusText || 'Unknown'}`);
      }
    } catch (err: any) {
      toast.dismiss(t);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to start Voice Engine.';
      toast.error(msg);
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* 🔵 Left Panel */}
      <div className={`${styles.left} ${styles.panel}`}>
        <div className={styles.section}>
          <h3 className={styles.sectionHeader}>Upload Audio</h3>
          <label className={styles.uploadBox}>
            <input
              type="file"
              accept="audio/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleAudioUpload}
            />
            <div className={styles.uploadInner}>
              <Upload size={24} />
              <p>Click to upload or drag & drop</p>
              <p className={styles.subText}>Audio files, up to 5 files, 50MB each</p>
            </div>
          </label>
          {audioFiles.length > 0 && (
            <ul className={styles.fileList}>
              {audioFiles.map((file, i) => (
                <li key={i}>
                  {file.name}
                  <Trash
                    size={14}
                    onClick={() => removeFile(i)}
                    className={styles.trash}
                  />
                </li>
              ))}
            </ul>
          )}
          {downloadLink && (
            <div className={styles.downloadBox}>
              <a
                href={downloadLink}
                download={`${outputName}.${fileFormat}`}
                className={styles.downloadLink}
              >
                <Download size={18} /> Download Transcript
              </a>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionHeader}>Transcript</h3>
          <textarea
            className={styles.textArea}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Transcript will appear here after processing..."
            rows={8}
          />
          <div className={styles.actionRow}>
            <button
              className={styles.primaryBtn}
              onClick={
                engineOnline
                  ? isTranscribing
                    ? handleCancelTask
                    : handleTranscribe
                  : handleStartEngine
              }
              type="button"
            >
              {engineOnline ? (
                isTranscribing ? (
                  <>
                    <span className={styles.spinner} /> Cancel
                  </>
                ) : (
                  <>
                    <Send size={16} /> Transcribe
                  </>
                )
              ) : (
                'Start Voice Engine'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 🟠 Right Panel */}
      <div className={`${styles.right} ${styles.panel}`}>
        <h3 className={styles.sectionHeader}>Settings</h3>

        <div className={styles.toggleRow}>
          <label>Auto Punctuation</label>
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={autoPunctuation}
              onChange={() => setAutoPunctuation(!autoPunctuation)}
            />
            <span className={styles.slider} />
          </label>
        </div>

        <div className={styles.toggleRow}>
          <label>Profanity Filter</label>
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={profanityFilter}
              onChange={() => setProfanityFilter(!profanityFilter)}
            />
            <span className={styles.slider} />
          </label>
        </div>

        <div className={styles.toggleRow}>
          <label>Smart Context</label>
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={smartContext}
              onChange={() => setSmartContext(!smartContext)}
            />
            <span className={styles.slider} />
          </label>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>Output Name</label>
          <input
            className={styles.input}
            value={outputName}
            onChange={(e) => setOutputName(e.target.value)}
          />
        </div>

        <div className={styles.section}>
          <label className={styles.label}>Format</label>
          <div
            className={styles.formatPanel}
            onClick={() => setShowFormatDropdown(!showFormatDropdown)}
          >
            <div className={styles.formatSelector}>
              <span className={styles.formatName}>{fileFormat.toUpperCase()}</span>
              <ChevronDown size={16} />
            </div>
            {showFormatDropdown && (
              <div className={styles.formatDropdown}>
                {formats.map((format) => (
                  <div
                    key={format}
                    className={styles.formatDropdownItem}
                    onClick={() => {
                      setFileFormat(format);
                      setShowFormatDropdown(false);
                    }}
                  >
                    {format.toUpperCase()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeechToText;
