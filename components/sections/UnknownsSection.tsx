import { IconUnknowns } from '../Icons';
import { Module } from '../responsive/Module';

export function UnknownsSection() {
  return (
    <Module id="sec-unknowns" header="CAT ~/.UNKNOWNS" icon={<IconUnknowns />} defaultOpen={false}>
      <div className="unknowns">
        <pre>
          <span className="uk-cmd">
            <span className="gt">$</span>
            {' cat ~/.unknowns'}
          </span>
          {'\n\n'}
          <span className="uk-h">{"# things i'm actively learning"}</span>
          {'\n\n'}
          <span className="uk-bul">{'-'}</span>
          {' knowing when AI-assisted engineering is a force multiplier vs a debt accelerator\n'}
          <span className="uk-mute">
            {
              '  (built the 12-agent system at betsson. also watched what it produces\n   when nobody reads the diffs.)'
            }
          </span>
          {'\n\n'}
          <span className="uk-bul">{'-'}</span>
          {' writing specs that someone else can ship without me in the room\n'}
          <span className="uk-mute">
            {
              '  (the 35-page knowledge system was a start. specs are harder.\n   "what i meant" is not what i wrote.)'
            }
          </span>
          {'\n\n'}
          <span className="uk-bul">{'-'}</span>
          {' deciding what NOT to ship\n'}
          <span className="uk-mute">
            {
              "  (the feature that doesn't ship is the one that doesn't cause an incident.\n   learning to advocate for cuts.)"
            }
          </span>
          {'\n\n'}
          <span className="uk-bul">{'-'}</span>
          {' opening a 1:1 with something other than "so, how\'s your week?"\n'}
          <span className="uk-mute">
            {'  (the icebreaker question IS the conversation.\n   learning to ask better ones.)'}
          </span>
          {'\n\n'}
          <span className="uk-bul">{'-'}</span>
          {' learning to be wrong in public without making it the story\n'}
          <span className="uk-mute">
            {
              '  (engineers who admit mistakes loudly are usually still making it about them.\n   fix it, move on, stop performing the apology.)'
            }
          </span>
          {'\n\n'}
          <span className="uk-h">{"# things i've chosen not to specialize in (yet)"}</span>
          {'\n\n'}
          <span className="uk-bul">{'-'}</span>
          {' mobile native (ios/android beyond ionic)\n'}
          <span className="uk-mute">{'  (shipped ionic for 5 OSes once. that was enough.)'}</span>
          {'\n\n'}
          <span className="uk-bul">{'-'}</span>
          {' ML model training / research\n'}
          <span className="uk-mute">
            {'  (applied-AI consumer, not researcher. the agents are the layer i own.)'}
          </span>
          {'\n\n'}
          <span className="uk-bul">{'-'}</span>
          {' chasing the framework wars\n'}
          <span className="uk-mute">
            {
              "  (i've shipped the same architecture pattern in 4 different syntaxes.\n   the syntax was never the hard part.)"
            }
          </span>
          {'\n\n'}
          <span className="uk-open">
            {'> open to roles that push me harder on any of the above.'}
          </span>
        </pre>
      </div>
    </Module>
  );
}
