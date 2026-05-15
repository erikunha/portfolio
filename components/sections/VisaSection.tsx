
import { IconVisa } from '../Icons';
import { Module } from '../responsive/Module';

export function VisaSection() {
  return (
    <Module
      id="sec-visa"
      header="CAT ~/.VISA"
      mobileHeader="CAT ~/.VISA & .CREDENTIALS"
      icon={<IconVisa />}
      defaultOpen={false}
    >
      <div className="visa">

        {/* Desktop — 3-column table matching Portfolio.html */}
        <pre className="visa-desktop-pre">
          <span className="vh">{'JURISDICTION    STATUS                  EVIDENCE'}</span>
          {'\n'}
          <span className="vrule">{'================================================================'}</span>
          {'\n'}
          <span className="vjur">{'EU (MALTA)'}</span>
          {'      '}
          <span className="vstat">{'WORK_AUTHORIZED'}</span>
          {'         '}
          <span className="vev">{'active employer (Betsson)'}</span>
          {'\n'}
          <span className="vjur">{'CA'}</span>
          {'              '}
          <span className="vstat">{'CO_OP_GRADUATE'}</span>
          {'          '}
          <span className="vev">{'CICCC, Vancouver · 2023-2024'}</span>
          {'\n'}
          <span className="vjur">{'BR'}</span>
          {'              '}
          <span className="vstat">{'CITIZEN'}</span>
          {'                 '}
          <span className="vev">{'native'}</span>
          {'\n'}
          <span className="vjur">{'WORLDWIDE'}</span>
          {'       '}
          <span className="vstat">{'OPEN_TO_RELOCATION'}</span>
          {'      '}
          <span className="vev">{'considering opportunities'}</span>
        </pre>

        {/* Mobile — 2-line per row matching Portfolio.mobile.html */}
        <pre className="visa-mobile-pre">
          <span className="cmd-line"><span className="pr">$</span>{' cat ~/.visa'}</span>
          {'\n\n'}
          <span className="vh">{'REGION    STATUS'}</span>
          {'\n'}
          <span className="vrule">{'================================'}</span>
          {'\n'}
          <span className="vjur">{'EU (MT)'}</span>
          {'   '}
          <span className="vstat">{'WORK_AUTHORIZED'}</span>
          {'\n'}
          {'          '}
          <span className="vev">{'active employer (Betsson)'}</span>
          {'\n'}
          <span className="vjur">{'CA'}</span>
          {'        '}
          <span className="vstat">{'CO_OP_GRAD'}</span>
          {'\n'}
          {'          '}
          <span className="vev">{'CICCC Vancouver · 2023-24'}</span>
          {'\n'}
          <span className="vjur">{'BR'}</span>
          {'        '}
          <span className="vstat">{'CITIZEN'}</span>
          {'\n'}
          {'          '}
          <span className="vev">{'native'}</span>
          {'\n'}
          <span className="vjur">{'WORLD'}</span>
          {'     '}
          <span className="vstat">{'OPEN_TO_RELOC'}</span>
          {'\n'}
          {'          '}
          <span className="vev">{'considering opportunities'}</span>
        </pre>

        <div className="visa-foot">// PT (native) · EN (C1) · FR (A2) · ES (A2)</div>
      </div>

      {/* On mobile, credentials are embedded here (prototype combines both sections) */}
      <div className="visa-mobile-creds">
        <pre>
          <span className="cmd-line"><span className="pr">$</span>{' cat ~/.credentials'}</span>
          {'\n\n'}
          <span className="cr-label">{'ANGULAR_DEV'}</span>
          {'  '}
          <span className="cr-badge">{'CERTIFIED'}</span>
          {'\n'}
          {'             '}
          <span className="cr-val">{'Alain Chautard (GDE) · 2024'}</span>
          {'\n'}
          <span className="cr-label">{'ENGLISH'}</span>
          {'      '}
          <span className="cr-badge">{'IELTS_C1'}</span>
          {'\n'}
          {'             '}
          <span className="cr-val">{'band 6.5 · 2023'}</span>
          {'\n'}
          <span className="cr-label">{'INTL_DEGREE'}</span>
          {'  '}
          <span className="cr-badge">{'MES_VERIFIED'}</span>
          {'\n'}
          {'             '}
          <span className="cr-val">{'World Education Svcs · 2022'}</span>
        </pre>
      </div>
    </Module>
  );
}
