import { useState, useRef } from 'react';
import { Upload, Trash, ChevronDown, Download, Send } from 'lucide-react';
import styles from './SpeechToText.module.css';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface Props {
  engineOnline: boolean;
}

const formats = ['txt', 'docx', 'json'];
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const VOICE_ENGINE_API_BASE_URL = import.meta.env.VITE_VOICE_ENGINE_API_BASE_URL;

const SpeechToText = ({ engineOnline }: Props) => {
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [transcript, setTranscript] = useState('');
  const [autoPunctuation, setAutoPunctuation] = useState(true);
  const [profanityFilter, setProfanityFilter] = useState(true);
  const [smartContext, setSmartContext] = useState(true);
  const [outputName, setOutputName] = useState('transcript');
  const [fileFormat, setFileFormat] = useState('txt');
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [downloadLink, setDownloadLink] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalFiles = [...audioFiles, ...files];
    if (totalFiles.length > 5) return toast.error('Max 5 files allowed.');
    const oversized = totalFiles.find(file => file.size > 50 * 1024 * 1024);
    if (oversized) return toast.error(`"${oversized.name}" exceeds 50MB limit.`);
    setAudioFiles(totalFiles);
  };

  const removeFile = (index: number) => {
    const updated = [...audioFiles];
    updated.splice(index, 1);
    setAudioFiles(updated);
  };

  const handleCancelTask = async () => {
    if (!taskId) return;
    try {
      await axios.post(`${VOICE_ENGINE_API_BASE_URL}/cancel-task/`, { task_id: taskId });
      toast.success('Task cancelled.');
      setIsTranscribing(false);
      setTaskId(null);
      setDownloadLink(null);
      setTranscript('');
      if (pollRef.current) clearInterval(pollRef.current);
    } catch (err) {
      toast.error('Failed to cancel task.');
    }
  };

  const handleTranscribe = async () => {
    if (audioFiles.length === 0) return toast.error('Please upload at least one audio file.');
    setIsTranscribing(true);
    setTranscript('');
    setDownloadLink(null);
    const formData = new FormData();
    audioFiles.forEach((file) => formData.append('files', file));
    formData.append('output_name', outputName);
    formData.append('file_format', fileFormat);
    formData.append('profanity_filter', String(profanityFilter));

    try {
      const res = await axios.post(`${VOICE_ENGINE_API_BASE_URL}/stt/transcribe/`, formData);
      const id = res.data.task_id;
      setTaskId(id);
      toast.success('Transcription started.');
      pollTaskStatus(id);
    } catch (err) {
      setIsTranscribing(false);
      toast.error('Failed to start transcription.');
    }
  };

  const pollTaskStatus = (taskId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
  
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${VOICE_ENGINE_API_BASE_URL}/task-status/${taskId}`);
        const { state, result } = res.data;
  
        if (['SUCCESS', 'FAILURE', 'REVOKED'].includes(state)) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setIsTranscribing(false);
          setTaskId(null);
  
          if (state === 'SUCCESS') {
            const transcriptText = result.transcript || '';
            setTranscript(transcriptText);
  
            // 🟢 Create downloadable blob file
            const blob = new Blob([transcriptText], {
              type:
                fileFormat === 'json'
                  ? 'application/json'
                  : fileFormat === 'docx'
                  ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                  : 'text/plain',
            });
  
            const downloadUrl = URL.createObjectURL(blob);
            setDownloadLink(downloadUrl);
  
            toast.success('Transcription complete.');
          } else {
            toast.error(`Transcription ${state.toLowerCase()}.`);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1000);
  };  

  const handleStartEngine = async () => {
    toast.loading('Starting Voice Engine...');
    try {
      const res = await axios.post(`${API_BASE_URL}/voice/start-runpod/`);
      toast.dismiss();
      if (['RUNNING', 'STARTING', 'REQUESTED'].includes(res.data.status)) {
        toast.success('Voice Engine is starting...');
      } else {
        toast.error(`Engine status: ${res.data.status || 'Unknown'}`);
      }
    } catch (err: any) {
      toast.dismiss();
      console.error('API Error:', err);
      toast.error('Failed to start Voice Engine.');
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
                  <Trash size={14} onClick={() => removeFile(i)} className={styles.trash} />
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
              onClick={engineOnline ? (isTranscribing ? handleCancelTask : handleTranscribe) : handleStartEngine}
            >
              {engineOnline ? (
                isTranscribing ? (
                  <>
                    <span className={styles.spinner}></span> Cancel
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
            <input type="checkbox" checked={autoPunctuation} onChange={() => setAutoPunctuation(!autoPunctuation)} />
            <span className={styles.slider}></span>
          </label>
        </div>

        <div className={styles.toggleRow}>
          <label>Profanity Filter</label>
          <label className={styles.toggleSwitch}>
            <input type="checkbox" checked={profanityFilter} onChange={() => setProfanityFilter(!profanityFilter)} />
            <span className={styles.slider}></span>
          </label>
        </div>

        <div className={styles.toggleRow}>
          <label>Smart Context</label>
          <label className={styles.toggleSwitch}>
            <input type="checkbox" checked={smartContext} onChange={() => setSmartContext(!smartContext)} />
            <span className={styles.slider}></span>
          </label>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>Output Name</label>
          <input className={styles.input} value={outputName} onChange={(e) => setOutputName(e.target.value)} />
        </div>

        <div className={styles.section}>
          <label className={styles.label}>Format</label>
          <div className={styles.formatPanel} onClick={() => setShowFormatDropdown(!showFormatDropdown)}>
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
