import styles from './Navbar.module.css'
import logo from '../../assets/restcom_logo.svg'

const Navbar = () => {
  return (
    <nav className={styles.navbar}>
      <div className={styles.navbarLeft}>
        <img src={logo} alt="Restcom Logo" className={styles.logo} />
        <span className={styles.brandText}>Restcom</span>
      </div>
      <ul className={styles.navbarLinks}>
        <li><a href="#product">Product</a></li>
        <li><a href="#pricing">Pricing</a></li>
        <li><a href="#blog">Blog</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
      <a href="/login" className={styles.loginButton}>Login</a>
    </nav>
  )
}

export default Navbar
