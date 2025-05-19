import { useState } from 'react'
import styles from './Navbar.module.css'
import logo from '../../assets/restcom_logo.svg'

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false)

  const toggleMenu = () => setMenuOpen(!menuOpen)

  return (
    <>
      <nav className={styles.navbar}>
        <a href="/" className={styles.navbarLeft}>
          <img src={logo} alt="Restcom Logo" className={styles.logo} />
          <span className={styles.brandText}>Restcom</span>
        </a>

        <div className={styles.hamburger} onClick={toggleMenu}>
          <div className={styles.bar}></div>
          <div className={styles.bar}></div>
          <div className={styles.bar}></div>
        </div>

        <ul className={`${styles.navbarLinks} ${menuOpen ? styles.showMenu : ''}`}>
          <li><a href="#product" onClick={toggleMenu}>Product</a></li>
          <li><a href="#pricing" onClick={toggleMenu}>Pricing</a></li>
          <li><a href="#blog" onClick={toggleMenu}>Blog</a></li>
          <li><a href="#contact" onClick={toggleMenu}>Contact</a></li>
          <li className={styles.mobileLogin}><a href="/login">Login</a></li>
        </ul>

        <a href="/login" className={styles.loginButton}>Login</a>
      </nav>

      {menuOpen && <div className={styles.overlay} onClick={toggleMenu}></div>}
    </>
  )
}

export default Navbar
