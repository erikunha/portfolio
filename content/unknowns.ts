import { type Unknowns, UnknownsSchema } from './schemas';

export const unknowns: Unknowns = UnknownsSchema.parse({
  learning: [
    {
      claim: 'knowing when AI-assisted engineering is a force multiplier vs a debt accelerator',
      context:
        'built the 12-agent system at betsson. also watched what it produces when nobody reads the diffs.',
    },
    {
      claim: 'writing specs that someone else can ship without me in the room',
      context: `the 35-page knowledge system was a start. specs are harder. "what i meant" is not what i wrote.`,
    },
    {
      claim: 'deciding what NOT to ship',
      context:
        "the feature that doesn't ship is the one that doesn't cause an incident. learning to advocate for cuts.",
    },
    {
      claim: 'opening a 1:1 with something other than "so, how\'s your week?"',
      context: 'the icebreaker question IS the conversation. learning to ask better ones.',
    },
    {
      claim: 'learning to be wrong in public without making it the story',
      context:
        'engineers who admit mistakes loudly are usually still making it about them. fix it, move on, stop performing the apology.',
    },
  ],
  notSpecializing: [
    {
      claim: 'mobile native (ios/android beyond ionic)',
      context: 'shipped ionic for 5 OSes once. that was enough.',
    },
    {
      claim: 'ML model training / research',
      context: 'applied-AI consumer, not researcher. the agents are the layer i own.',
    },
    {
      claim: 'chasing the framework wars',
      context:
        "i've shipped the same architecture pattern in 4 different syntaxes. the syntax was never the hard part.",
    },
  ],
  footer: '> open to roles that push me harder on any of the above.',
});
