import { type Unknowns, UnknownsSchema } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

const unknownsFor = (locale: SiteLocale): Unknowns => {
  const pt = locale === SITE_LOCALE.pt;
  return UnknownsSchema.parse({
    learningHeading: pt
      ? '# coisas que estou aprendendo ativamente'
      : "# things i'm actively learning",
    notSpecializingHeading: pt
      ? '# coisas nas quais escolhi não me especializar (ainda)'
      : "# things i've chosen not to specialize in (yet)",
    learning: [
      {
        claim: pt
          ? 'saber quando engenharia assistida por IA multiplica força vs acelera dívida'
          : 'knowing when AI-assisted engineering is a force multiplier vs a debt accelerator',
        context: pt
          ? 'construí um sistema de engenharia assistida por IA na betsson. também vi o que ele produz quando ninguém lê os diffs.'
          : 'built an ai-assisted engineering system at betsson. also watched what it produces when nobody reads the diffs.',
        showContext: false,
      },
      {
        claim: pt
          ? 'escrever specs que outra pessoa consegue entregar sem mim na sala'
          : 'writing specs that someone else can ship without me in the room',
        context: pt
          ? 'spec é mais difícil que código. "o que eu quis dizer" não é o que eu escrevi.'
          : 'specs are harder than code. "what i meant" is not what i wrote.',
        showContext: false,
      },
      {
        claim: pt ? 'decidir o que NÃO entregar' : 'deciding what NOT to ship',
        context: pt
          ? 'a feature que não sai é a que não causa incidente. aprendendo a defender cortes.'
          : "the feature that doesn't ship is the one that doesn't cause an incident. learning to advocate for cuts.",
      },
      {
        claim: pt
          ? 'abrir um 1:1 com algo diferente de "então, como foi sua semana?"'
          : 'opening a 1:1 with something other than "so, how\'s your week?"',
        context: pt
          ? 'a pergunta de aquecimento É a conversa. aprendendo a fazer perguntas melhores.'
          : 'the icebreaker question IS the conversation. learning to ask better ones.',
      },
      {
        claim: pt
          ? 'aprender a estar errado em público sem fazer disso a história'
          : 'learning to be wrong in public without making it the story',
        context: pt
          ? 'engenheiros que admitem erros alto geralmente ainda estão fazendo disso sobre eles. corrige, segue em frente, para de performar o pedido de desculpas.'
          : 'engineers who admit mistakes loudly are usually still making it about them. fix it, move on, stop performing the apology.',
      },
    ],
    notSpecializing: [
      {
        claim: pt
          ? 'mobile nativo (ios/android além de ionic)'
          : 'mobile native (ios/android beyond ionic)',
        context: pt
          ? 'entreguei ionic para 5 SOs uma vez. já foi suficiente.'
          : 'shipped ionic for 5 OSes once. that was enough.',
      },
      {
        claim: pt ? 'treinamento / pesquisa de modelos de ML' : 'ML model training / research',
        context: pt
          ? 'consumidor de IA aplicada, não pesquisador. os agentes são a camada que eu domino.'
          : 'applied-AI consumer, not researcher. the agents are the layer i own.',
      },
      {
        claim: pt ? 'correr atrás das guerras de framework' : 'chasing the framework wars',
        context: pt
          ? 'entreguei o mesmo padrão de arquitetura em 4 sintaxes diferentes. a sintaxe nunca foi a parte difícil.'
          : "i've shipped the same architecture pattern in 4 different syntaxes. the syntax was never the hard part.",
      },
    ],
    footer: pt
      ? '> aberto a roles que me pressionem mais em qualquer um dos itens acima.'
      : '> open to roles that push me harder on any of the above.',
  });
};

export const unknowns: Record<SiteLocale, Unknowns> = {
  [SITE_LOCALE.en]: unknownsFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: unknownsFor(SITE_LOCALE.pt),
};
