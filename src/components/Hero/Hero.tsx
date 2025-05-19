import { useEffect } from 'react'
import AOS from 'aos'
import 'aos/dist/aos.css'

import styles from './Hero.module.css'
import Navbar from '../Navbar/Navbar'
import bgImage from '../../assets/hero background image.png'
import sparkleIcon from '../../assets/Sparkle icon.svg'
import heroIllustration from '../../assets/Hero Img.png'

const Hero = () => {
  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: true, // only animate once
    })
  }, [])

  return (
    <section className={styles.hero} style={{ backgroundImage: `url(${bgImage})` }}>
      <Navbar />
      <div className={styles.heroOverlay}>
        <p className={styles.heroTag} data-aos="fade-down">
          <span className={styles.sparkleTag}>
            <img src={sparkleIcon} alt="Sparkle" className={styles.iconImage} />
            AI powered productivity tool
          </span>
        </p>
        <h1 className={styles.heroTitle} data-aos="fade-up" data-aos-delay="100">
          Fuel Your Growth<br />And Boost Your Revenue
        </h1>
        <p className={styles.heroDescription} data-aos="fade-up" data-aos-delay="200">
          Describe your concept and let our AI generate logos, graphics, and content-ready images instantly.
        </p>
        <div className={styles.heroButtons} data-aos="fade-up" data-aos-delay="300">
          <a href="#get-started" className={styles.btnPrimary}>Get Started</a>
          <a href="#learn-more" className={styles.btnOutline}>Learn More</a>
        </div>
      </div>

      <img
        src={heroIllustration}
        alt="Dashboard Preview"
        className={styles.heroImage}
        data-aos="fade-in"
        data-aos-delay="400"
      />
    </section>
  )
}

export default Hero
