export interface PortfolioProject {
  id: string;
  title: string;
  description: string;
  longDescription?: string;
  technologies: string[];
  imageUrl: string;
  githubUrl?: string;
  liveUrl?: string;
  featured: boolean;
  completedDate: string;
  category: 'web' | 'mobile' | 'fullstack' | 'library' | 'tool';
}

export interface Skill {
  name: string;
  category: 'frontend' | 'backend' | 'tools' | 'practices';
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface Experience {
  company: string;
  position: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description: string;
  achievements: string[];
  technologies: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate?: string;
  current: boolean;
}
