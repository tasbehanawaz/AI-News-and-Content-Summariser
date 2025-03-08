/* eslint-disable @next/next/no-img-element */
import { motion } from 'framer-motion';
import styles from './BrowseNews.module.css';

export default function BrowseNews() {
  const categories = ['General', 'Business', 'Technology', 'Entertainment', 'Health', 'Science', 'Sports'];
  
  return (
    <div className={styles.container}>
      {/* Main Navigation */}
      <nav className={styles.mainNav}>
        <motion.div 
          className={`${styles.navItem} ${styles.active}`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className={styles.icon}>📰</span>
          Browse News
        </motion.div>
        <motion.div 
          className={styles.navItem}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className={styles.icon}>📝</span>
          Text Summary
        </motion.div>
        <motion.div 
          className={styles.navItem}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className={styles.icon}>🎥</span>
          Video Summary
        </motion.div>
      </nav>

      {/* Search and Categories */}
      <div className={styles.filterSection}>
        <motion.div 
          className={styles.searchContainer}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <input 
            type="text" 
            placeholder="Search news..."
            className={styles.searchInput}
          />
          <motion.button 
            className={styles.searchButton}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            🔍
          </motion.button>
        </motion.div>

        <motion.div 
          className={styles.categories}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {categories.map((category, index) => (
            <motion.button
              key={category}
              className={`${styles.categoryButton} ${category === 'General' ? styles.active : ''}`}
              whileHover={{ 
                scale: 1.05,
                backgroundColor: 'rgba(71, 99, 255, 0.1)'
              }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {category}
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* News Grid */}
      <motion.div 
        className={styles.newsGrid}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {/* Example News Card */}
        <motion.div 
          className={styles.newsCard}
          whileHover={{ 
            scale: 1.02,
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)'
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className={styles.newsImage}>
            <img src="/placeholder-news.jpg" alt="News" />
          </div>
          <div className={styles.newsContent}>
            <div className={styles.newsSource}>
              <span>The Washington Post</span>
              <span>02/03/2025</span>
            </div>
            <h3 className={styles.newsTitle}>
              Oscars 2025: Who's hosting, favorites to win and how to watch
            </h3>
            <p className={styles.newsExcerpt}>
              Conan O'Brien takes center stage at the 97th Academy Awards on Sunday in Los Angeles.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
} 