import { useState } from 'react'
import styles from './Contact.module.css'
import mascot from '../../assets/ai-mascot2.png'
import doubleMessage from '../../assets/double-message.png'

const Contact = () => {
  const [form, setForm] = useState({ name: '', email: '', number: '', message: '' })
  const [status, setStatus] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('Sending...')

    try {
      await fetch('https://formspree.io/f/xayrnvlz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setStatus('Message sent!')
      setForm({ name: '', email: '', number: '', message: '' })
    } catch {
      setStatus('Failed to send. Try again.')
    }
  }

  return (
    <section id="contact" className={styles.contactSection}>
      <h2 className={styles.heading}>Still Got Questions?</h2>
      <p className={styles.subtext}>
        Send a message and our team will get back to you in less than an hour.
      </p>

      <div className={styles.contactBox}>
        <div className={styles.imageBox}>
          <img src={doubleMessage} alt="doubleMessage" className={styles.doubleMessage} />
        </div>

        <div className={styles.formBox}>
          <img src={mascot} alt="Mascot" className={styles.mascot} />
          <form onSubmit={handleSubmit}>
            <input type="text" name="name" placeholder="Name" value={form.name} onChange={handleChange} required />
            <input type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} required />
            <input type="text" name="number" placeholder="Number (optional)" value={form.number} onChange={handleChange} />
            <textarea name="message" placeholder="How Can We Help?" value={form.message} onChange={handleChange} required />
            <button type="submit">Submit</button>
            {status && <p className={styles.status}>{status}</p>}
          </form>
        </div>
      </div>
    </section>
  )
}

export default Contact
