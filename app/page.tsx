import { StructuredData } from '../components/seo/structured-data';
import styles from './page.module.css';

export default async function Index() {
  return (
    <>
      <main id="main-content">
        <StructuredData type="Person" />
        <StructuredData type="WebSite" />

        <div className={styles['page']}>
          {/* Hero Section */}
          <section className={styles['hero']} aria-label="Hi, I'm">
            <div className={styles['hero-content']}>
              <h1 className={styles['hero-title']}>
                <span className={styles['hero-greeting']}>Hi, I'm</span>
                <span className={styles['hero-name']}>
                  Erik Henrique Alves Cunha
                </span>
              </h1>
              <p className={styles['hero-subtitle']}>Frontend Engineer</p>
              <p className={styles['hero-description']}>
                Building modern web applications with React, Next.js, and
                TypeScript
              </p>
            </div>
          </section>

          {/* Projects Section - Placeholder */}
          <section
            className={styles['section']}
            aria-labelledby="projects-heading"
          >
            <h2 id="projects-heading" className={styles['section-title']}>
              Featured Projects
            </h2>
            <p className={styles['section-placeholder']}>
              Project showcase coming soon...
            </p>
          </section>

          {/* Skills Section - Placeholder */}
          <section
            className={styles['section']}
            aria-labelledby="skills-heading"
          >
            <h2 id="skills-heading" className={styles['section-title']}>
              Technical Skills
            </h2>
            <p className={styles['section-placeholder']}>
              Skills showcase coming soon...
            </p>
          </section>
        </div>
      </main>

      {/* Footer Landmark for Skip Navigation */}
      <footer id="footer" className={styles['footer']} role="contentinfo">
        <div className={styles['footer-content']}>
          <p className={styles['footer-text']}>Get in Touch</p>
          <p className={styles['footer-a11y']}>
            <span className="sr-only">Accessibility: </span>
            This site is designed with accessibility in mind, following WCAG AAA
            standards.
          </p>
        </div>
      </footer>
    </>
  );
}
