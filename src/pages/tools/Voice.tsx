import Navbar from '../../components/Dashboard/navbar/DashboardNav'
import Sidebar from '../../components/Dashboard/sidebar/Sidebar'
import Voice from '../../components/Voice/Voice'
import styles from '../../components/Dashboard/Dashboard.module.css'
import { useLocation } from 'react-router-dom'

const VoiceCloningTool = () => {
  const location = useLocation()

  return (
    <div className={styles.dashboard}>
      <Navbar />
      <div className={styles.main}>
        <Sidebar activePath={location.pathname} />
        <Voice />
      </div>
    </div>
  )
}

export default VoiceCloningTool
