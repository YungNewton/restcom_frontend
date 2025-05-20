import Navbar from '../../components/Dashboard/navbar/DashboardNav'
import Sidebar from '../../components/Dashboard/sidebar/Sidebar'
import EmailAssistant from '../../components/EmailAssistant/EmailAssistant'
import styles from '../../components/Dashboard/Dashboard.module.css'
import { useLocation } from 'react-router-dom'

const EmailAssistantTool = () => {
  const location = useLocation()

  return (
    <div className={styles.dashboard}>
      <Navbar />
      <div className={styles.main}>
        <Sidebar activePath={location.pathname} />
        <EmailAssistant />
      </div>
    </div>
  )
}

export default EmailAssistantTool
