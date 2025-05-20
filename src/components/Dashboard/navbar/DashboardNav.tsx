import styles from './DashboardNavbar.module.css'
import logo from '../../../assets/restcom_logo.svg'
import avatar from '../../../assets/avatar.png'
import { Bell, Settings, ArrowRight, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const DashboardNavbar = () => {
  const navigate = useNavigate()

  return (
    <nav className={styles.navbar}>
      {/* Left: Logo */}
      <div className={styles.left} onClick={() => navigate('/')}>
        <img src={logo} alt="Restcom Logo" className={styles.logo} />
        <span className={styles.brandText}>Restcom</span>
      </div>

      {/* Center: Search */}
      <div className={styles.center}>
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} />
          <input
            type="text"
            placeholder="search..."
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className={styles.right}>
        <button className={styles.newProjectButton}>
          <ArrowRight size={16} />
          <span>Start new project</span>
        </button>
        <Bell className={styles.icon} />
        <Settings className={styles.icon} />
        <div className={styles.avatarWrapper}>
          <img src={avatar} alt="User" className={styles.avatar} />
        </div>
      </div>
    </nav>
  )
}

export default DashboardNavbar
