import Link from 'next/link';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <div className={styles['container']}>
      <div className={styles['content']}>
        <h1 className={styles['code']}>404</h1>
        <h2 className={styles['title']}>404 - Page Not Found</h2>
        <p className={styles['message']}>
          The page you're looking for doesn't exist.
        </p>
        <Link href="/" className={styles['button']}>
          Go to homepage
        </Link>
      </div>
    </div>
  );
}
