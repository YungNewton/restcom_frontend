import styles from './Pricing.module.css'
import checkIcon from '../../assets/check.png' // adjust if needed

const plans = [
  {
    name: 'Pro',
    price: '$79/mo',
    features: ['Keyword Optimization', 'Keyword Optimization', 'Keyword Optimization'],
    featured: false,
  },
  {
    name: 'Pro',
    price: '$79/mo',
    features: ['Keyword Optimization', 'Keyword Optimization', 'Keyword Optimization', 'Keyword Optimization', 'Keyword Optimization'],
    featured: true,
  },
  {
    name: 'Pro',
    price: '$79/mo',
    features: ['Keyword Optimization', 'Keyword Optimization', 'Keyword Optimization', 'Keyword Optimization', 'Keyword Optimization', 'Keyword Optimization'],
    featured: false,
  },
]

const Pricing = () => {
  return (
    <section id="pricing" className={styles.pricingSection}>
      <h2 className={styles.heading}>Plans for every Creator</h2>
      <p className={styles.subtext}>
        14 days unlimited free trial, choose from a variety of plans that fit your category
      </p>

      <div className={styles.cardGrid}>
        {plans.map((plan, idx) => (
          <div key={idx} className={`${styles.card} ${plan.featured ? styles.featured : ''}`}>
            <h3 className={styles.planName}>{plan.name}</h3>
            <p className={styles.planPrice}>{plan.price}</p>
            <hr className={styles.divider} />

            <ul className={styles.featureList}>
              {plan.features.map((feature, i) => (
                <li key={i} className={styles.feature}>
                  <img src={checkIcon} alt="Check" className={styles.checkIcon} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button className={`${styles.button} ${plan.featured ? styles.featuredButton : ''}`}>
              Get Started
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

export default Pricing
