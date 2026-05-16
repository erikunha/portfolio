
import { IconGuitar } from '../Icons';
import { Module } from '../responsive/Module';

export function GuitarSection() {
  return (
    <Module id="sec-guitar" header="CAT ~/.GUITAR_RIG" icon={<IconGuitar />} defaultOpen={false}>
      <div className="visa">

        {/* Desktop — matches Portfolio.html labels */}
        <pre className="guitar-desktop">
          <span className="cmd-line"><span className="pr">$</span>{'cat ~/.guitar_rig'}</span>
          {'\n'}
          <span className="gr-comment">{'# updated 2026-05-13'}</span>
          {'\n\n'}
          <span className="gr-label">{'GUITAR_MAIN'}</span>
          {'       '}
          <span className="gr-val">{'Gretsch G5655TG · Electromatic Center Block Jr · Bigsby'}</span>
          {'\n'}
          <span className="gr-label">{'GUITAR_ALT'}</span>
          {'        '}
          <span className="gr-val">{'Martin acoustic'}</span>
          {'\n'}
          <span className="gr-label">{'AMP'}</span>
          {'               '}
          <span className="gr-val">{'modeled · no tube in the chain'}</span>
          {'\n'}
          <span className="gr-label">{'PEDALBOARD'}</span>
          {'        '}
          <span className="gr-val">{'Line 6 HX Stomp XL · amp + effects modeling'}</span>
          {'\n\n'}
          <span className="gr-label">{'INFLUENCES'}</span>
          {'        '}
          <span className="gr-val">{'in order:'}</span>
          {'\n                      '}
          <span className="gr-num">{'1.'}</span>
          {' '}
          <span className="gr-name">{'John Mayer'}</span>
          {'\n                      '}
          <span className="gr-num">{'2.'}</span>
          {' '}
          <span className="gr-name">{'Mateus Asato'}</span>
          {'\n                      '}
          <span className="gr-num">{'3.'}</span>
          {' '}
          <span className="gr-name">{'Jimmy Page'}</span>
          {'\n                      '}
          <span className="gr-num">{'4.'}</span>
          {' '}
          <span className="gr-name">{'John Frusciante'}</span>
          {'\n                      '}
          <span className="gr-num">{'5.'}</span>
          {' '}
          <span className="gr-name">{"Iron Maiden's three (Murray · Smith · Gers)"}</span>
          {'\n\n'}
          <span className="gr-label">{'STYLE'}</span>
          {'             '}
          <span className="gr-val">{'feel / expression over noise · clean tones, lots of space'}</span>
          {'\n'}
          <span className="gr-label">{'TUNING'}</span>
          {'            '}
          <span className="gr-val">{'standard E · sometimes drop D · never Eb'}</span>
          {'\n'}
          <span className="gr-label">{'PRACTICE'}</span>
          {'          '}
          <span className="gr-val">{'jams, tones, live takes · guitarcam from the desk'}</span>
          {'\n'}
          <span className="gr-label">{'GIGS'}</span>
          {'              '}
          <span className="gr-val">{'played live with a band · small venues'}</span>
          {'\n'}
          <span className="gr-label">{'NEVER_LEARNED'}</span>
          {'     '}
          <span className="gr-val">{'reading staff notation · tabs only'}</span>
          {'\n'}
          <span className="gr-label">{'LATEST_OBSESSION'}</span>
          {'  '}
          <span className="gr-val">{'Coldplay\'s "Yellow" — the simplicity is the hard part'}</span>
        </pre>

        {/* Mobile — matches Portfolio.mobile.html labels */}
        <pre className="guitar-mobile" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', fontSize: '11.5px', lineHeight: 1.7 }}>
          <span className="cmd-line"><span className="pr">$</span>{'cat ~/.guitar_rig'}</span>
          {'\n'}
          <span className="gr-comment">{'# the other six strings'}</span>
          {'\n\n'}
          <span className="gr-label">{'MAIN'}</span>
          {'         '}
          <span className="gr-val">{'Gretsch G5655TG · Bigsby'}</span>
          {'\n'}
          <span className="gr-label">{'ALT'}</span>
          {'          '}
          <span className="gr-val">{'Martin acoustic'}</span>
          {'\n'}
          <span className="gr-label">{'PEDAL'}</span>
          {'        '}
          <span className="gr-val">{'Line 6 HX Stomp XL'}</span>
          {'\n'}
          <span className="gr-label">{'AMP'}</span>
          {'          '}
          <span className="gr-val">{'modeled · no tube'}</span>
          {'\n\n'}
          <span className="gr-label">{'INFLUENCES'}</span>
          {'\n              '}
          <span className="gr-num">{'1.'}</span>
          {' '}
          <span className="gr-name">{'John Mayer'}</span>
          {'\n              '}
          <span className="gr-num">{'2.'}</span>
          {' '}
          <span className="gr-name">{'Mateus Asato'}</span>
          {'\n              '}
          <span className="gr-num">{'3.'}</span>
          {' '}
          <span className="gr-name">{'Jimmy Page'}</span>
          {'\n              '}
          <span className="gr-num">{'4.'}</span>
          {' '}
          <span className="gr-name">{'John Frusciante'}</span>
          {'\n              '}
          <span className="gr-num">{'5.'}</span>
          {' '}
          <span className="gr-name">{"Iron Maiden's three"}</span>
          {'\n\n'}
          <span className="gr-label">{'STYLE'}</span>
          {'        '}
          <span className="gr-val">{'feel over noise · lots of space'}</span>
          {'\n'}
          <span className="gr-label">{'TUNING'}</span>
          {'       '}
          <span className="gr-val">{'standard E · sometimes drop D'}</span>
          {'\n'}
          <span className="gr-label">{'GIGS'}</span>
          {'         '}
          <span className="gr-val">{'small venues · band setting'}</span>
          {'\n'}
          <span className="gr-label">{'PRACTICE'}</span>
          {'      '}
          <span className="gr-val">{'jams · tones · live takes'}</span>
          {'\n'}
          <span className="gr-label">{'NEVER_LRND'}</span>
          {'    '}
          <span className="gr-val">{'tabs only · no staff notation'}</span>
          {'\n'}
          <span className="gr-label">{'OBSESSION'}</span>
          {'    '}
          <span className="gr-val">{"Coldplay's \"Yellow\" · simplicity is hard"}</span>
        </pre>

      </div>
    </Module>
  );
}
