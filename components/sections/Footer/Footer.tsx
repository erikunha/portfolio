import { dmesgLines, dmesgStatus } from '@/content/dmesg';
import { footerContent as content, footerSectionIds } from '@/content/footer';
import { RebootControl, SessionCounters } from './Footer.client';

const TREE_BRANCH = '│\n├──\n│';
const TREE_LAST_BRANCH = '│\n└──\n ';
const INITIAL_UPTIME = '00:00:00';
const INITIAL_COUNT = '0';
const INITIAL_DEPTH = '0%';
const DMESG_PRECISION = 3;
const DMESG_WIDTH = 9;
const CONNECTION_STATE = { listening: 'LISTEN' } as const;

export function Footer() {
  return (
    <footer className="site-footer" id="shutdown">
      <div className="footer-inner">
        <h2 className="footer-shutdown-title">{content.shutdownTitle}</h2>
        <p className="footer-command">
          <span>{content.prompt}</span> {content.shutdownCommand}
        </p>
        <div className="footer-cards">
          <section className="footer-card" aria-labelledby="footer-session-title">
            <h3 className="footer-card-title" id="footer-session-title">
              {content.sessionTitle}
            </h3>
            <SessionCounters sectionIds={footerSectionIds}>
              <dl className="footer-session-grid">
                <dt>{content.sessionLabels.user}</dt>
                <dd>{content.user}</dd>
                <dt>{content.sessionLabels.uptime}</dt>
                <dd data-sess="uptime" data-volatile>
                  {INITIAL_UPTIME}
                </dd>
                <dt>{content.sessionLabels.depth}</dt>
                <dd>
                  <meter
                    className="footer-depth"
                    min={0}
                    max={100}
                    value={0}
                    aria-label={content.sessionLabels.depth}
                  />
                  <span data-sess="depth" data-volatile>
                    {INITIAL_DEPTH}
                  </span>
                </dd>
                <dt>{content.sessionLabels.seen}</dt>
                <dd>
                  <span data-sess="seen" data-volatile>
                    {INITIAL_COUNT}
                  </span>{' '}
                  / {footerSectionIds.length}
                </dd>
                <dt>{content.sessionLabels.commands}</dt>
                <dd data-sess="commands" data-volatile>
                  {INITIAL_COUNT}
                </dd>
              </dl>
            </SessionCounters>
          </section>
          <section className="footer-card" aria-labelledby="footer-netstat-title">
            <h3 className="footer-card-title" id="footer-netstat-title">
              {content.netstatTitle}
            </h3>
            <table className="footer-netstat">
              <thead>
                <tr>
                  <th scope="col">{content.connectionLabels.protocol}</th>
                  <th scope="col">{content.connectionLabels.state}</th>
                  <th scope="col">{content.connectionLabels.endpoint}</th>
                </tr>
              </thead>
              <tbody>
                {content.connections.map((connection) => (
                  <tr key={connection.href}>
                    <td>{connection.protocol}</td>
                    <td
                      className={
                        connection.state === CONNECTION_STATE.listening
                          ? 'footer-listening'
                          : 'footer-established'
                      }
                    >
                      {connection.state}
                    </td>
                    <td>
                      <a
                        className="footer-link"
                        href={connection.href}
                        {...(connection.external
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : {})}
                      >
                        {connection.label}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
        <section className="footer-card footer-tree" aria-labelledby="footer-tree-title">
          <h3 className="footer-card-title" id="footer-tree-title">
            {content.treeTitle}
          </h3>
          <nav className="sitemap" aria-label={content.treeLabel}>
            <ul className="sm-groups">
              {content.groups.map((group) => (
                <li key={group.directory}>
                  <h4 className="sm-title">{group.directory}</h4>
                  <ul>
                    {group.links.map((link, index) => (
                      <li key={link.href}>
                        <a href={link.href}>
                          <span className="tr" aria-hidden="true">
                            {index === group.links.length - 1 ? TREE_LAST_BRANCH : TREE_BRANCH}
                          </span>
                          <span className="tl">{link.label}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>
        </section>
        <ul className="footer-dmesg" aria-hidden="true">
          {dmesgLines.map((line) => (
            <li key={line.off}>
              <span className="footer-timestamp">
                [{line.off.toFixed(DMESG_PRECISION).padStart(DMESG_WIDTH)}]
              </span>
              <span>
                {line.prefix}
                {line.bold && <b>{line.bold}</b>}
                {line.suffix}
              </span>
              <span className="footer-established">{line.ok ? dmesgStatus.ok : null}</span>
            </li>
          ))}
        </ul>
        <div className="footer-halt">
          <span className="footer-halt-plate">{content.halted}</span>
          <RebootControl copy={content.reboot} />
        </div>
        <p className="footer-copyright">{content.copyright}</p>
      </div>
    </footer>
  );
}
