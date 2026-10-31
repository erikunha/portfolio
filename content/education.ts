import { CredentialSchema, type Education, EducationSchema } from './schemas';

export const education: Education[] = EducationSchema.array().parse([
  {
    id: 'MBA_AI_ENG',
    degree: 'MBA (Lato Sensu), AI Engineering, Machine Learning and Deep Learning',
    institution: 'Instituto Infnet',
    location: 'Brazil',
    studyMode: 'online',
    startYear: null,
    endYear: 2027,
    expectedCompletion: '2027-12',
    period: 'expected Dec 2027',
  },
  {
    id: 'CO_OP_DIPLOMA',
    degree: 'Web Development Co-op Diploma',
    institution: 'Cornerstone International Community College of Canada (CICCC)',
    location: 'Vancouver, Canada',
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
    location: 'Campinas, Brazil',
    studyMode: null,
    startYear: 2015,
    endYear: 2020,
    expectedCompletion: null,
    period: '2015-2020',
  },
]);

const educationInstitutions: Record<Education['id'], string> = {
  MBA_AI_ENG: 'Instituto Infnet (online)',
  CO_OP_DIPLOMA: 'CICCC, Vancouver',
  BS_INFO_SYSTEMS: 'UNISAL, Campinas',
};

export const educationTags = CredentialSchema.array().parse(
  education.map((entry) => ({
    label: entry.id,
    badge: educationInstitutions[entry.id],
    evidence: entry.period,
  })),
);
