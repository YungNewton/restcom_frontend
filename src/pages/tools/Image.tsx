import Navbar from '../../components/Dashboard/navbar/DashboardNav'
import Sidebar from '../../components/Dashboard/sidebar/Sidebar'
import Image from '../../components/Image/Image'
import styles from '../../components/Dashboard/Dashboard.module.css'
import { useLocation } from 'react-router-dom'

const ImageTool = () => {
  const location = useLocation()

  return (
    <div className={styles.dashboard}>
      <Navbar />
      <div className={styles.main}>
        <Sidebar activePath={location.pathname} />
        <Image />
      </div>
    </div>
  )
}

export default ImageTool
