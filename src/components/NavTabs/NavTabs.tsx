import { useLocation, useNavigate } from 'react-router-dom';
import styles from './NavTabs.module.css';

type Tab = {
  label: string;
  route: string;
};

const tabs: Tab[] = [
  { label: 'Email Assistant', route: '/email-assistant' },
  { label: 'Voice & TTS', route: '/voice' },
  { label: 'Video Generator', route: '/video' },
  { label: 'Image Generator', route: '/image' },
];

const NavTabs = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleClick = (route: string) => {
    navigate(route);
  };

  return (
    <div className={styles.navWrapper}>
      <div className={styles.tabNav}>
        {tabs.map((tab) => (
          <button
            key={tab.route}
            className={`${styles.tab} ${
              location.pathname === tab.route ? styles.active : ''
            }`}
            onClick={() => handleClick(tab.route)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default NavTabs;
