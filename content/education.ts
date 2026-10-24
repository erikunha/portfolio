import { type Education, EducationSchema } from './schemas';

export const education: Education[] = EducationSchema.array().parse([
  {
    id: 'MBA_AI_ENG',
    degree: 'MBA, AI Engineering',
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
    institution: 'CICCC',
    location: 'Vancouver, Canada',
    studyMode: null,
    startYear: 2023,
    endYear: 2024,
    expectedCompletion: null,
    period: '2023-2024',
  },
  {
    id: 'BS_INFO_SYSTEMS',
    degree: 'BS, Information Systems',
    institution: 'UNISAL',
    location: 'Campinas, Brazil',
    studyMode: null,
    startYear: 2015,
    endYear: 2020,
    expectedCompletion: null,
    period: '2015-2020',
  },
]);
