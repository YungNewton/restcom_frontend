import styles from './Footer.module.css'
import logo from '../../assets/restcom_logo.svg'

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.divider} />
      <div className={styles.footerContent}>
        <div className={styles.footerLeft}>
          © 2025 Restcom. All rights reserved.
        </div>
        <a href="/" className={styles.footerRight}>
          <img src={logo} alt="Restcom Logo" className={styles.logo} />
          <span className={styles.brandText}>Restcom</span>
        </a>
      </div>
    </footer>
  )
}

export default Footer
