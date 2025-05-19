import { useEffect } from 'react'
import AOS from 'aos'
import 'aos/dist/aos.css'

import styles from './Products.module.css'
import iconDescribe from '../../assets/icon-describe.png'
import iconReview from '../../assets/icon-review.png'
import iconDownload from '../../assets/icon-download.png'

import emailIcon from '../../assets/icon-email.png'
import voiceIcon from '../../assets/icon-voice.png'
import videoIcon from '../../assets/icon-video.png'
import imageIcon from '../../assets/icon-image.png'
import mascot from '../../assets/ai-mascot.png'

const Products = () => {
  useEffect(() => {
    AOS.init({ duration: 1000, once: true })
  }, [])

  return (
    <section className={styles.products}>
      <div className={styles.textCenter}>
        <h2 className={styles.heading}>Powering Progress<br />Through Sustainability</h2>
        <p className={styles.subtext}>
          Describe your concept and let our AI generate logos, graphics, and<br />
          content-ready images – instantly.
        </p>
      </div>

      <div className={styles.cards}>
        <div className={styles.card} data-aos="fade-right">
          <img src={iconDescribe} alt="Describe Icon" className={styles.icon} />
          <h3 className={styles.cardTitle}>Describe Your Idea</h3>
          <p className={styles.cardText}>
            Tell our AI what you need; a logo, banner, social post, etc.
          </p>
        </div>
        <div className={styles.card} data-aos="fade-left">
          <img src={iconReview} alt="Review Icon" className={styles.icon} />
          <h3 className={styles.cardTitle}>Review Output</h3>
          <p className={styles.cardText}>
            Get multiple visual variations based on your input.
          </p>
        </div>
        <div className={styles.card} data-aos="fade-right">
          <img src={iconDownload} alt="Download Icon" className={styles.icon} />
          <h3 className={styles.cardTitle}>Refine or Download</h3>
          <p className={styles.cardText}>
            Pick your favorite, tweak, and download instantly.
          </p>
        </div>
      </div>

      <div className={styles.toolsSection}>
        <h2 className={styles.secondaryHeading}>More Than a Platform<br />A Partner For Your Growth</h2>
        <p className={styles.subtext}>
          Experience the power of our AI tools to boost productivity and acquire real progress.
        </p>

        <div className={styles.toolCardWrapper}>
          <img src={mascot} alt="AI Mascot" className={styles.mascot} />
          <div className={styles.toolCard} data-aos="fade-right">
            <div className={styles.toolContent}>
              <h3>AI Email Outreach Assistant</h3>
              <p>Enables manual or AI-generated email messages and targeted or global send-outs based on the scraped contact list</p>
              <div className={styles.toolActions}>
                <button className={styles.toolButton}>Launch Tool</button>
                <a className={styles.toolLink} href="#">How it works ↘</a>
              </div>
            </div>
            <img src={emailIcon} alt="Email Icon" className={styles.toolIcon} />
          </div>
        </div>

        <div className={`${styles.toolCard} ${styles.reverse}`} data-aos="fade-left">
          <div className={styles.toolContent}>
            <h3>Voice Cloning & Text-to-Speech Engine</h3>
            <p>Converts PDF books or text into audio using cloned voices to create audiobooks with personalized models.</p>
            <div className={styles.toolActions}>
              <button className={styles.toolButton}>Launch Tool</button>
              <a className={styles.toolLink} href="#">How it works ↘</a>
            </div>
          </div>
          <img src={voiceIcon} alt="Voice Icon" className={styles.toolIcon} />
        </div>

        <div className={styles.toolCard} data-aos="fade-right">
          <div className={styles.toolContent}>
            <h3>AI Video Generator</h3>
            <p>Enables users to create videos based on their ideas and inputs, potentially using AI-generated visuals and voiceovers.</p>
            <div className={styles.toolActions}>
              <button className={styles.toolButton}>Launch Tool</button>
              <a className={styles.toolLink} href="#">How it works ↘</a>
            </div>
          </div>
          <img src={videoIcon} alt="Video Icon" className={styles.toolIcon} />
        </div>

        <div className={`${styles.toolCard} ${styles.reverse}`} data-aos="fade-left">
          <div className={styles.toolContent}>
            <h3>Logo & Image Generator</h3>
            <p>Allows users to describe visual concepts for logos or graphics and get AI-generated image options.</p>
            <div className={styles.toolActions}>
              <button className={styles.toolButton}>Launch Tool</button>
              <a className={styles.toolLink} href="#">How it works ↘</a>
            </div>
          </div>
          <img src={imageIcon} alt="Image Icon" className={styles.toolIcon} />
        </div>
      </div>
    </section>
  )
}

export default Products
