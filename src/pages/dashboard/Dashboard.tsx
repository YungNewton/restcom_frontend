import Navbar from '../../components/Dashboard/navbar/DashboardNav'
import Sidebar from '../../components/Dashboard/sidebar/Sidebar'
import styles from '../../components/Dashboard/Dashboard.module.css'

const Dashboard = () => {

  return (
    <div className={styles.dashboard}>
      <Navbar />
      <Sidebar />
    </div>
  )
}

export default Dashboard
