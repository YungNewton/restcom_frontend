import Navbar from '../../components/Dashboard/navbar/DashboardNav'
import Sidebar from '../../components/Dashboard/sidebar/Sidebar'
import DashboardHome from '../../components/Dashboard/home/DashboardHome'
import styles from '../../components/Dashboard/Dashboard.module.css'
import { useLocation } from 'react-router-dom'

const Dashboard = () => {
  const location = useLocation()

  return (
    <div className={styles.dashboard}>
      <Navbar />
      <div className={styles.main}>
        <Sidebar activePath={location.pathname} />
        <DashboardHome />
      </div>
    </div>
  )
}

export default Dashboard
