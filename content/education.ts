import { CredentialSchema, type Education, EducationSchema } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

// Degree and institution names are canonical facts held to llms.txt by the
// identity gate; only display glosses (location, study mode, period, focus)
// carry the translation.
const educationFor = (locale: SiteLocale): Education[] => {
  const pt = locale === SITE_LOCALE.pt;
  return EducationSchema.array().parse([
    {
      id: 'MBA_AI_ENG',
      degree: 'MBA (Lato Sensu), AI Engineering, Machine Learning and Deep Learning',
      institution: 'Instituto Infnet',
      location: pt ? 'Brasil' : 'Brazil',
      studyMode: pt ? 'on-line' : 'online',
      startYear: null,
      endYear: 2027,
      expectedCompletion: '2027-12',
      period: pt ? 'previsto para dez/2027' : 'expected Dec 2027',
      focus: pt
        ? 'Disciplinas: ML, deep learning, LLMs, RAG, sistemas multi-agente. Agora estudando orquestração de agentes (LangGraph) e observabilidade de LLMs (LangSmith, Langfuse).'
        : 'Coursework: ML, deep learning, LLMs, RAG, multi-agent systems. Now studying agent orchestration (LangGraph) and LLM observability (LangSmith, Langfuse).',
    },
    {
      id: 'CO_OP_DIPLOMA',
      degree: 'Web Development Co-op Diploma',
      institution: 'Cornerstone International Community College of Canada (CICCC)',
      location: pt ? 'Vancouver, Canadá' : 'Vancouver, Canada',
      studyMode: null,
      startYear: 2023,
      endYear: 2024,
      expectedCompletion: null,
      period: '2023-2024',
    },
    {
      id: 'BS_INFO_SYSTEMS',
      degree: 'B.S. Information Systems',
      institution: 'Centro Universitário Salesiano de São Paulo (UNISAL)',
      location: pt ? 'Campinas, Brasil' : 'Campinas, Brazil',
      studyMode: null,
      startYear: 2015,
      endYear: 2020,
      expectedCompletion: null,
      period: '2015-2020',
    },
  ]);
};

export const education: Record<SiteLocale, Education[]> = {
  [SITE_LOCALE.en]: educationFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: educationFor(SITE_LOCALE.pt),
};

const educationInstitutions: Record<Education['id'], string> = {
  MBA_AI_ENG: 'Instituto Infnet (online)',
  CO_OP_DIPLOMA: 'CICCC, Vancouver',
  BS_INFO_SYSTEMS: 'UNISAL, Campinas',
};

export const educationTags = (locale: SiteLocale) =>
  CredentialSchema.array().parse(
    education[locale].map((entry) => ({
      label: entry.id,
      badge: educationInstitutions[entry.id],
      evidence: entry.period,
    })),
  );
