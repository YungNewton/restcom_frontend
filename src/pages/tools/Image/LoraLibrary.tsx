// pages/dashboard/image/LoraLibraryPage.tsx
import { useLocation } from 'react-router-dom'

import Navbar from '../../../components/Dashboard/navbar/DashboardNav'
import Sidebar from '../../../components/Dashboard/sidebar/Sidebar'
import styles from '../../../components/Dashboard/Dashboard.module.css'

import LoraLibraryComponent from '../../../components/Image/LoraLibrary/LoraLibrary'

export default function LoraLibraryPage() {
  const location = useLocation()

  return (
    <div className={styles.dashboard}>
      <Navbar />
      <div className={styles.main}>
        <div className={styles.sidebarPane}>
          <Sidebar activePath={location.pathname} />
        </div>

        <div className={styles.contentPane}>
          <div className={styles.libraryPane}>
            {/* 👇 No props, let the component self-wire */}
            <LoraLibraryComponent />
          </div>
        </div>
      </div>
    </div>
  )
}
