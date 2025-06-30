import { useState } from 'react';
import { Upload, Trash, ChevronDown } from 'lucide-react';
import styles from './SpeechToText.module.css';
import { toast } from 'react-hot-toast';

const formats = ['txt', 'docx', 'json'];

const SpeechToText = () => {
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [transcript, setTranscript] = useState('');
  const [autoPunctuation, setAutoPunctuation] = useState(true);
  const [profanityFilter, setProfanityFilter] = useState(true);
  const [smartContext, setSmartContext] = useState(true);
  const [outputName, setOutputName] = useState('transcript');
  const [fileFormat, setFileFormat] = useState('txt');
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalFiles = [...audioFiles, ...files];

    if (totalFiles.length > 5) {
      toast.error('Max 5 files allowed.');
      return;
    }

    const oversized = totalFiles.find(file => file.size > 100 * 1024 * 1024);
    if (oversized) {
      toast.error(`"${oversized.name}" exceeds 100MB limit.`);
      return;
    }

    setAudioFiles(totalFiles);
  };

  const removeFile = (index: number) => {
    const updated = [...audioFiles];
    updated.splice(index, 1);
    setAudioFiles(updated);
  };

  const handleTranscribe = () => {
    if (audioFiles.length === 0) {
      toast.error('Please upload at least one audio file.');
      return;
    }

    setTranscript('This is a dummy transcript generated from the uploaded audio files.');
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
              <p className={styles.subText}>Audio files, up to 5 files, 100MB each</p>
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
              onClick={handleTranscribe}
            >
              Transcribe
            </button>
          </div>
        </div>
      </div>

      {/* 🟠 Right Panel */}
      <div className={`${styles.right} ${styles.panel}`}>
        <h3 className={styles.sectionHeader}>Settings</h3>

        {/* ✅ Toggles */}
        <div className={styles.toggleRow}>
          <label>Auto Punctuation</label>
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={autoPunctuation}
              onChange={() => setAutoPunctuation(!autoPunctuation)}
            />
            <span className={styles.slider}></span>
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
            <span className={styles.slider}></span>
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
            <span className={styles.slider}></span>
          </label>
        </div>

        {/* ✅ Output Name */}
        <div className={styles.section}>
          <label className={styles.label}>Output Name</label>
          <input
            className={styles.input}
            placeholder="transcript"
            value={outputName}
            onChange={(e) => setOutputName(e.target.value)}
          />
        </div>

        {/* ✅ Custom Format Dropdown */}
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
