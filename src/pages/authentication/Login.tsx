import styles from '../../components/Auth/Login.module.css'
import LoginForm from '../../components/Auth/LoginForm'
import logo from '../../assets/restcom_logo.svg'

const Login = () => {
  return (
    <div className={styles.loginPage}>
      <div className={styles.navbarLeft}>
        <a href="/" className={styles.brandWrapper}>
          <img src={logo} alt="Restcom Logo" className={styles.logo} />
          <span className={styles.brandText}>Restcom</span>
        </a>
      </div>

      <div className={styles.formWrapper}>
        <LoginForm />
      </div>
    </div>
  )
}

export default Login
