import styles from './Sidebar.module.css'
import {
  LayoutDashboard,
  Mail,
  Mic,
  Video,
  Shapes,
  Folder,
  Info,
  Sliders,
  HelpCircle,
  LogOut
} from 'lucide-react'

const Sidebar = () => {
  return (
    <aside className={styles.sidebar}>
      <ul className={styles.navList}>
        <li className={`${styles.navItem} ${styles.active}`}>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </li>
        <li className={styles.navItem}>
          <Mail size={18} />
          <span>Email Assistant</span>
        </li>
        <li className={styles.navItem}>
          <Mic size={18} />
          <span>Voice & TTS</span>
        </li>
        <li className={styles.navItem}>
          <Video size={18} />
          <span>Video Generator</span>
        </li>
        <li className={styles.navItem}>
          <Shapes size={18} />
          <span>Logo Generator</span>
        </li>
        <li className={styles.navItem}>
          <Folder size={18} />
          <span>Projects</span>
        </li>
        <li className={styles.navItem}>
          <Info size={18} />
          <span>Reports</span>
        </li>
        <li className={styles.navItem}>
          <Sliders size={18} />
          <span>Settings</span>
        </li>
      </ul>

      <div className={styles.footer}>
        <div className={styles.navItem}>
          <HelpCircle size={18} />
          <span>Help</span>
        </div>
        <button className={styles.logoutButton}>
          <LogOut size={18} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
