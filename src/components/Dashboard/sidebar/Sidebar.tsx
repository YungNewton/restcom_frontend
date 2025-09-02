import { useState } from 'react'
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
import { useAuth } from '../../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

type SidebarProps = {
  activePath: string
}

const Sidebar = ({ activePath }: SidebarProps) => {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path: string) => activePath === path
  const handleNav = (path: string) => {
    navigate(path)
    setIsOpen(false)
  }

  return (
    <>
      {/* Burger menu — hidden when sidebar is open */}
      <div className={`${styles.burgerWrapper} ${isOpen ? styles.hidden : ''}`}>
        <div className={styles.hamburger} onClick={() => setIsOpen(true)}>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <ul className={styles.navList}>
          <li className={`${styles.navItem} ${isActive('/dashboard') ? styles.active : ''}`} onClick={() => handleNav('/dashboard')}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </li>
          <li className={`${styles.navItem} ${isActive('/email-assistant') ? styles.active : ''}`} onClick={() => handleNav('/email-assistant')}>
            <Mail size={18} />
            <span>Email Assistant</span>
          </li>
          <li className={`${styles.navItem} ${isActive('/voice') ? styles.active : ''}`} onClick={() => handleNav('/voice')}>
            <Mic size={18} />
            <span>Voice & TTS</span>
          </li>
          <li className={`${styles.navItem} ${isActive('/video') ? styles.active : ''}`} onClick={() => handleNav('/video')}>
            <Video size={18} />
            <span>Video Generator</span>
          </li>
          <li className={`${styles.navItem} ${isActive('/image') ? styles.active : ''}`} onClick={() => handleNav('/image')}>
            <Shapes size={18} />
            <span>Image Generator</span>
          </li>
          <li className={`${styles.navItem} ${isActive('/projects') ? styles.active : ''}`} onClick={() => handleNav('/projects')}>
            <Folder size={18} />
            <span>Projects</span>
          </li>
          <li className={`${styles.navItem} ${isActive('/reports') ? styles.active : ''}`} onClick={() => handleNav('/reports')}>
            <Info size={18} />
            <span>Reports</span>
          </li>
          <li className={`${styles.navItem} ${isActive('/settings') ? styles.active : ''}`} onClick={() => handleNav('/settings')}>
            <Sliders size={18} />
            <span>Settings</span>
          </li>
        </ul>

        <div className={styles.footer}>
          <div className={styles.navItem}>
            <HelpCircle size={18} />
            <span>Help</span>
          </div>
          <button className={styles.logoutButton} onClick={handleLogout}>
            <LogOut size={18} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Overlay for small screen */}
      {isOpen && <div className={styles.overlay} onClick={() => setIsOpen(false)} />}
    </>
  )
}

export default Sidebar
