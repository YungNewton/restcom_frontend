import styles from './Hero.module.css'
import Navbar from '../Navbar/Navbar'
import bgImage from '../../assets/hero background image.png'
import sparkleIcon from '../../assets/Sparkle icon.svg'
import heroIllustration from '../../assets/Hero Img.png'

const Hero = () => {
  return (
    <section className={styles.hero} style={{ backgroundImage: `url(${bgImage})` }}>
      <Navbar />
      <div className={styles.heroOverlay}>
        <p className={styles.heroTag}>
            <span className={styles.sparkleTag}>
                <img src={sparkleIcon} alt="Sparkle" className={styles.iconImage} />
                AI powered productivity tool
            </span>
        </p>
        <h1 className={styles.heroTitle}>Fuel Your Growth<br />And Boost Your Revenue</h1>
        <p className={styles.heroDescription}>
          Describe your concept and let our AI generate logos, graphics, and content-ready images instantly.
        </p>
        <div className={styles.heroButtons}>
          <a href="#get-started" className={styles.btnPrimary}>Get Started</a>
          <a href="#learn-more" className={styles.btnOutline}>Learn More</a>
        </div>
        <img src={heroIllustration} alt="Dashboard Preview" className={styles.heroImage} />
      </div>
    </section>
  )
}

export default Hero
