import { useEffect, useState, useRef } from 'react'
import { ChevronDown, ChevronUp, RefreshCcw, Copy, Mail, Send } from 'lucide-react'
import styles from './EmailAssistant.module.css'
import NavTabs from '../../components/NavTabs/NavTabs';
import sparkleIcon from '../../assets/sparkle-icon.png'
import playIcon from '../../assets/play.png'
import uploadIcon from '../../assets/upload.png'
import { CircleStop } from 'lucide-react';
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import removeMarkdown from 'remove-markdown'
import { toast } from 'react-hot-toast'
import * as RadioGroup from '@radix-ui/react-radio-group';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const defaultPrompts = [
  "Create a discount promo email",
  "Generate a customer re-engagement message",
  "Write a newsletter for upcoming features",
  "Draft a holiday campaign message",
  "Compose a welcome email",
  "Suggest an upsell follow-up"
]

function forceCleanMarkdown(text: string) {
  return removeMarkdown(text.replace(/^\*{1,2}\s*/, "").replace(/\*{1,2}$/, "").trim())
}

function extractSubjectAndBody(rawText: string) {
  const lines = rawText.split("\n");
  let subject = "";
  const bodyLines: string[] = [];
  let foundSubject = false;
  let isInBody = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const normalized = trimmed.toLowerCase();

    if (!foundSubject && /^(\*\*)?\s*subject\s*:/i.test(trimmed)) {
      const withoutPrefix = trimmed.replace(/^(\*\*)?\s*subject\s*:\s*/i, "")
      subject = forceCleanMarkdown(withoutPrefix).trim()
      foundSubject = true
      continue
    }

    if (normalized.startsWith("body:")) {
      isInBody = true;
      continue;
    }

    if (foundSubject && !isInBody && trimmed !== "") {
      isInBody = true;
    }

    if (isInBody) {
      if (/^[A-Z][a-z]+:/.test(trimmed) && !normalized.startsWith("p.s.")) break;
      bodyLines.push(line);
    }
  }

  const body = forceCleanMarkdown(bodyLines.join("\n")).trim();
  return { subject, body };
}

const EmailAssistant = () => {
  const [aiExpanded, setAiExpanded] = useState(true)
  const [prompts, setPrompts] = useState<string[]>([])
  const [askInput, setAskInput] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<any[]>([])
  const [controller, setController] = useState<AbortController | null>(null)
  const subjectRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [insertTooltip, setInsertTooltip] = useState("Insert into Mail");
  const [copyTooltip, setCopyTooltip] = useState('Copy to Clipboard')

  const responseRef = useRef<HTMLDivElement>(null)

  const [lastPrompt, setLastPrompt] = useState('')
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [recipientMode, setRecipientMode] = useState<'file' | 'manual'>('file');
  const [manualEmails, setManualEmails] = useState('');
  const [recipientsFile, setRecipientsFile] = useState<File | null>(null);
  const [emailTaskId, setEmailTaskId] = useState<string | null>(null)
  const [isSendingEmails, setIsSendingEmails] = useState(false)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSendEmails = async () => {
    const subject = subjectRef.current?.value?.trim();
    const message = messageRef.current?.value?.trim();
  
    if (!subject) return toast.error("Subject is required.");
    if (!message) return toast.error("Message is required.");
  
    const formData = new FormData();
    formData.append("subject", subject);
    formData.append("message", message);
  
    if (recipientMode === 'file') {
      if (!recipientsFile) return toast.error("Please upload a recipient list.");
      formData.append("file", recipientsFile);
    } else {
      if (!manualEmails.trim()) return toast.error("Please enter recipient emails.");
      formData.append("emails", manualEmails);
    }
  
    attachmentFiles.forEach((file, i) => {
      formData.append(`attachment_${i}`, file);
    });
    const toastId = toast.loading("Sending emails...");
  
    try {
      const res = await fetch(`${API_BASE_URL}/emails/send-bulk/`, {
        method: "POST",
        body: formData,
      });
  
      const data = await res.json();
  
      if (res.ok) {
        setEmailTaskId(data.task_id);
        toast.success("Email job started.", { id: toastId });
        pollTaskStatus(data.task_id);
      } else {
        setIsSendingEmails(false);
        toast.error(data.error || "Failed to send emails.", { id: toastId });
      }
    } catch (err) {
      setIsSendingEmails(false);
      toast.error("Something went wrong while sending emails.", { id: toastId });
    }
  };
  
  const handleCancelEmailTask = async () => {
    if (!emailTaskId) return;
  
    try {
      await fetch(`${API_BASE_URL}/cancel-task/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: emailTaskId }),
      });
  
      toast.success("Email task cancelled.");
    } catch (err) {
      toast.error("Failed to cancel task.");
    } finally {
      setIsSendingEmails(false);
      setEmailTaskId(null);

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }      
    }
  }; 
  
  const pollTaskStatus = (taskId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/task-status/${taskId}`);
        const data = await res.json();
  
        if (data.state === "SUCCESS" || data.state === "FAILURE" || data.state === "REVOKED") {
          toast.success(`Task ${data.state.toLowerCase()}.`);
          setIsSendingEmails(false);
          setEmailTaskId(null);
  
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
        }
      } catch (err) {
        console.error("Polling error:", err);
        // Optional: Retry count limit or notify user
      }
    }, 1000);
  };  
  
  const handleRegenerate = () => {
    if (isTyping) return
    if (!lastPrompt.trim()) return
    setAskInput(lastPrompt)
    sendPrompt(lastPrompt)
  
  }

  const handleCopy = async () => {
    try {
      const cleaned = forceCleanMarkdown(aiResponse); 
      await navigator.clipboard.writeText(cleaned); 
      setCopyTooltip('Copied!');
      setTimeout(() => setCopyTooltip('Copy to Clipboard'), 2000);
    } catch (err) {
      setCopyTooltip('Failed to copy');
      setTimeout(() => setCopyTooltip('Copy to Clipboard'), 2000);
    }
  };  

  const handleInsertIntoMail = () => {
    if (!aiResponse) return;
    const { subject, body } = extractSubjectAndBody(aiResponse);
  
    if (subjectRef.current) subjectRef.current.value = removeMarkdown(subject);
    if (messageRef.current) messageRef.current.value = removeMarkdown(body);
  
    setInsertTooltip("Inserted!");
    setTimeout(() => setInsertTooltip("Insert into Mail"), 2000);
  };
  
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);
  
  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/emails/email-prompts/`)
        const data = await response.json()
        setPrompts(data.prompts.slice(0, 6))
      } catch (error) {
        console.error("Failed to fetch prompts:", error)
        setPrompts(defaultPrompts.slice(0, 4))
      }
    }

    fetchPrompts()
  }, [])

  const sendPrompt = async (prompt: string) => {
    if (isTyping) {
      controller?.abort();
      setIsTyping(false);
      setAskInput('');
      return;
    }
  
    if (!prompt.trim()) return;
  
    setAiResponse('');
    setIsTyping(true);
    setAskInput('AI is thinking');
  
    await Promise.resolve();
  
    const abortController = new AbortController();
    setController(abortController);
  
    let dotIndex = 0;
    const dots = ['.', '..', '...'];
    const animateInterval = setInterval(() => {
      setAskInput(`AI is thinking${dots[dotIndex % dots.length]}`);
      dotIndex++;
    }, 500);
  
    try {
      setLastPrompt(prompt);
  
      const res = await fetch(`${API_BASE_URL}/emails/generate-ai-email/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          history: conversationHistory,
          stream: true,
        }),
        signal: abortController.signal,
      });
  
      if (!res.ok || !res.body) {
        const error = await res.text();
        throw new Error(error || 'Request failed');
      }
  
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
  
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value);
  
        const lines = chunk
          .split('\n')
          .filter((line) => line.trim().startsWith('data:'));
  
        for (const line of lines) {
          const data = line.replace('data: ', '').trim();
          if (data === '[DONE]') {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.token) {
              setAiResponse((prev) => prev + parsed.token);
            }
            if (parsed.error) {
              throw parsed.error;
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
  
      clearInterval(animateInterval);
      setIsTyping(false);
      setAskInput('');
  
      setConversationHistory((prev) => [
        ...prev,
        { role: 'user', content: prompt },
        { role: 'assistant', content: aiResponse },
      ]);
    } catch (error) {
      console.error('Streaming error:', error);
      clearInterval(animateInterval);
      if (error instanceof DOMException && error.name === 'AbortError') {
        setAiResponse('Request cancelled.');
      } else {
        setAiResponse(`Something went wrong: ${error}`);
      }
      setIsTyping(false);
      setAskInput('');
    } finally {
      setController(null);
    }
  };  
  
  const handleAsk = () => {
    if (!askInput.trim()) return
    sendPrompt(askInput.trim())
  }  

  return (
    <div className={styles.wrapper}>
      <NavTabs />
      <div className={styles.contentRow}>
        <div className={styles.assistantPanel}>
          <div className={styles.aiSectionHeader}>
            <div className={styles.leftGroup}>
              <img src={sparkleIcon} alt="sparkle" className={styles.sparkleIcon} />
              <span className={styles.aiTitle}>Rest AI</span>
              <button onClick={() => setAiExpanded(!aiExpanded)} className={styles.toggleBtn}>
                {aiExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
            <select className={styles.projectDropdown}>
              <option>Untitled project</option>
            </select>
          </div>

          {aiExpanded && (
            <div className={styles.aiCore}>
              <div className={styles.promptBar}>
                <input
                  type="text"
                  placeholder="Ask anything..."
                  value={askInput}
                  onChange={(e) => setAskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAsk()
                    }
                  }}
                />
                {isTyping ? (
                  <CircleStop
                    className={styles.playBtn}
                    color="#0073ff"
                    size={22}
                    onClick={handleAsk}
                  />
                ) : (
                  <img
                    src={playIcon}
                    className={styles.playBtn}
                    alt="send"
                    onClick={handleAsk}
                  />
                )}
              </div>

              <div className={styles.promptSuggestions}>
                {prompts.map((text, index) => (
                  <button key={index} onClick={() => setAskInput(text)}>
                    {text}
                  </button>
                ))}
              </div>

              <div className={styles.aiResponse} ref={responseRef}>
                <div className={styles.responseContent}>
                  <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                    {aiResponse}
                  </ReactMarkdown>
                </div>
                <div className={styles.responseActions}>
                  <div className={styles.leftActions}>
                    <div className={styles.tooltipWrapper} data-tooltip="Regenerate">
                      <RefreshCcw
                        size={20}
                        className={`${styles.icon} ${isTyping ? styles.disabledIcon : ''}`}
                        onClick={handleRegenerate}
                      />
                    </div>
                  </div>

                  <div className={styles.rightActions}>
                    <div className={styles.tooltipWrapper} data-tooltip={copyTooltip}>
                      <Copy size={20} className={styles.icon} onClick={handleCopy} />
                    </div>
                    <div
                      className={styles.tooltipWrapper}
                      data-tooltip={insertTooltip}
                      onClick={handleInsertIntoMail}
                    >
                      <Mail size={20} className={styles.icon} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={styles.emailFields}>
            <div className={styles.fieldGroup}>
              <label htmlFor="subject">Subject</label>
              <input ref={subjectRef} type="text" id="subject" className={styles.subjectInput} placeholder="Enter subject" />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="message">Message</label>
              <textarea ref={messageRef} id="message" className={styles.messageInput} placeholder="Enter email content" rows={10} />
            </div>
          </div>
        </div>

        <div className={styles.sidePanel}>
          <div className={styles.attachmentBox}>
            <p className={styles.attachmentTitle}>Attachment</p>
            <label className={styles.uploadArea}>
            <input
              type="file"
              accept=".pdf,.docx,.jpg,.png"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                const totalSize = files.reduce((sum, file) => sum + file.size, 0);
                if (totalSize > 5 * 1024 * 1024) {
                  toast.error("Total attachment size must be under 5MB.");
                  return;
                }
                setAttachmentFiles(files);
              }}
            />
              <img src={uploadIcon} alt="upload" className={styles.uploadIcon} />
              <p className={styles.fileHint}>
                {attachmentFiles.length > 0
                  ? `${attachmentFiles.length} file${attachmentFiles.length > 1 ? 's' : ''} selected`
                  : "Attachment (.pdf, .jpg, etc)"}
              </p>
            </label>
          </div>

          <RadioGroup.Root
            className={styles.modeToggle}
            value={recipientMode}
            onValueChange={(value) => setRecipientMode(value as 'file' | 'manual')}
          >
            <RadioGroup.Item asChild value="file">
              <label className={styles.radioItem}>
                <span className={styles.radioButton}>
                  <span className={styles.radioIndicator} />
                </span>
                <span>Upload</span>
              </label>
            </RadioGroup.Item>

            <RadioGroup.Item asChild value="manual">
              <label className={styles.radioItem}>
                <span className={styles.radioButton}>
                  <span className={styles.radioIndicator} />
                </span>
                <span>Type In</span>
              </label>
            </RadioGroup.Item>
          </RadioGroup.Root>

          {recipientMode === 'file' ? (
            <div className={styles.attachmentBox}>
              <p className={styles.attachmentTitle}>Recipient List (.csv, .xlsx)</p>
              <label className={`${styles.uploadArea} ${styles.uploadAreaThin}`}>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setRecipientsFile(file);
                  }}
                />
                <img src={uploadIcon} alt="upload" className={styles.uploadIcon} />
                <p className={styles.fileHint} title={recipientsFile?.name}>
                  {recipientsFile?.name || "Upload .csv with emails"}
                </p>
              </label>
            </div>
          ) : (
            <div className={styles.attachmentBox}>
              <p className={styles.attachmentTitle}>
                Enter Emails <span className={styles.indent}>(separated by commas)</span>
              </p>
              <textarea
                className={styles.manualInput}
                rows={4}
                placeholder="email1@example.com, email2@example.com"
                value={manualEmails}
                onChange={(e) => setManualEmails(e.target.value)}
              />
            </div>
          )}
          {isSendingEmails ? (
            <button className={styles.sendBtn} onClick={handleCancelEmailTask}>
              <div className={styles.spinner} />
              <span>Cancel</span>
            </button>
          ) : (
            <button className={styles.sendBtn} onClick={handleSendEmails}>
              <Send size={16} />
              <span>Send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default EmailAssistant
