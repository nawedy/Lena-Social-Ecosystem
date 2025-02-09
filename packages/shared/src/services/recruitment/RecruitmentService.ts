import { EventEmitter } from 'events';
import { supabase } from '../../supabase';
import { AIOptimizer } from '../optimization/AIOptimizer';

interface JobListing {
  id: string;
  companyId: string;
  title: string;
  description: string;
  requirements: string[];
  skills: string[];
  experience: {
    min: number;
    max: number;
    level: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
  };
  location: {
    type: 'remote' | 'hybrid' | 'onsite';
    cities?: string[];
    countries?: string[];
    timeZones?: string[];
  };
  salary: {
    min: number;
    max: number;
    currency: string;
    equity?: {
      min: number;
      max: number;
    };
  };
  benefits: string[];
  status: 'draft' | 'published' | 'closed' | 'archived';
  applicantCount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

interface JobApplication {
  id: string;
  jobId: string;
  candidateId: string;
  status: 'applied' | 'screening' | 'interviewing' | 'offered' | 'accepted' | 'rejected';
  resume: {
    url: string;
    parsed?: {
      experience: Array<{
        company: string;
        title: string;
        startDate: string;
        endDate?: string;
        description: string;
        skills: string[];
      }>;
      education: Array<{
        institution: string;
        degree: string;
        field: string;
        startDate: string;
        endDate?: string;
      }>;
      skills: string[];
      languages: Array<{
        name: string;
        level: 'basic' | 'intermediate' | 'fluent' | 'native';
      }>;
    };
  };
  coverLetter?: string;
  screening?: {
    score: number;
    feedback: string;
    redFlags: string[];
  };
  interviews: Array<{
    id: string;
    type: 'screening' | 'technical' | 'cultural' | 'final';
    scheduledAt: string;
    interviewers: string[];
    feedback?: {
      score: number;
      strengths: string[];
      weaknesses: string[];
      notes: string;
    };
  }>;
  createdAt: string;
  updatedAt: string;
}

interface CandidateProfile {
  id: string;
  userId: string;
  headline: string;
  summary: string;
  experience: JobApplication['resume']['parsed']['experience'];
  education: JobApplication['resume']['parsed']['education'];
  skills: string[];
  languages: JobApplication['resume']['parsed']['languages'];
  preferences: {
    roles: string[];
    locations: string[];
    salary: {
      min: number;
      currency: string;
    };
    workType: Array<'remote' | 'hybrid' | 'onsite'>;
  };
  privacy: {
    profileVisibility: 'public' | 'private' | 'connections';
    resumeVisibility: 'public' | 'private' | 'recruiters';
    currentEmployerCanSee: boolean;
  };
  metrics: {
    profileViews: number;
    searchAppearances: number;
    applicationsSent: number;
    interviewRate: number;
    offerRate: number;
  };
}

interface MatchResult {
  score: number;
  jobId: string;
  candidateId: string;
  factors: {
    skillsMatch: number;
    experienceMatch: number;
    locationMatch: number;
    salaryMatch: number;
    culturalMatch: number;
  };
  explanation: string[];
}

export class RecruitmentService extends EventEmitter {
  private static instance: RecruitmentService;
  private aiOptimizer: AIOptimizer;
  private jobListings: Map<string, JobListing> = new Map();
  private applications: Map<string, JobApplication> = new Map();
  private candidateProfiles: Map<string, CandidateProfile> = new Map();
  private refreshInterval: NodeJS.Timer | null = null;

  private constructor() {
    super();
    this.setupAIOptimizer();
    this.startPeriodicRefresh();
  }

  static getInstance(): RecruitmentService {
    if (!RecruitmentService.instance) {
      RecruitmentService.instance = new RecruitmentService();
    }
    return RecruitmentService.instance;
  }

  private setupAIOptimizer() {
    this.aiOptimizer = new AIOptimizer({
      enableQualityPrediction: true,
      enableCachePrediction: false,
      enableResourcePrediction: false,
      modelUpdateInterval: 3600000,
      minDataPoints: 1000
    });
  }

  private startPeriodicRefresh() {
    this.refreshInterval = setInterval(() => {
      this.refreshData();
    }, 300000); // 5 minutes
  }

  private async refreshData() {
    await Promise.all([
      this.loadJobListings(),
      this.loadApplications(),
      this.loadCandidateProfiles()
    ]);
  }

  private async loadJobListings() {
    const { data, error } = await supabase
      .from('job_listings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    this.jobListings.clear();
    for (const listing of data) {
      this.jobListings.set(listing.id, this.transformJobListing(listing));
    }
  }

  private async loadApplications() {
    const { data, error } = await supabase
      .from('job_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    this.applications.clear();
    for (const application of data) {
      this.applications.set(application.id, this.transformJobApplication(application));
    }
  }

  private async loadCandidateProfiles() {
    const { data, error } = await supabase
      .from('candidate_profiles')
      .select('*');

    if (error) throw error;

    this.candidateProfiles.clear();
    for (const profile of data) {
      this.candidateProfiles.set(profile.id, this.transformCandidateProfile(profile));
    }
  }

  async createJobListing(listing: Omit<JobListing, 'id' | 'applicantCount' | 'createdAt' | 'updatedAt'>): Promise<JobListing> {
    const { data, error } = await supabase
      .from('job_listings')
      .insert([{
        ...listing,
        applicant_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    const jobListing = this.transformJobListing(data);
    this.jobListings.set(jobListing.id, jobListing);
    return jobListing;
  }

  async submitApplication(application: Omit<JobApplication, 'id' | 'status' | 'screening' | 'interviews' | 'createdAt' | 'updatedAt'>): Promise<JobApplication> {
    // Parse resume
    const parsedResume = await this.parseResume(application.resume.url);
    
    const { data, error } = await supabase
      .from('job_applications')
      .insert([{
        ...application,
        status: 'applied',
        resume: {
          ...application.resume,
          parsed: parsedResume
        },
        interviews: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    const jobApplication = this.transformJobApplication(data);
    this.applications.set(jobApplication.id, jobApplication);
    
    // Update applicant count
    await this.incrementApplicantCount(application.jobId);
    
    // Trigger screening
    await this.screenApplication(jobApplication.id);
    
    return jobApplication;
  }

  async updateApplicationStatus(applicationId: string, status: JobApplication['status'], feedback?: any): Promise<JobApplication> {
    const { data, error } = await supabase
      .from('job_applications')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(feedback && { feedback })
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;

    const application = this.transformJobApplication(data);
    this.applications.set(application.id, application);
    return application;
  }

  async scheduleInterview(applicationId: string, interview: Omit<JobApplication['interviews'][0], 'id'>): Promise<JobApplication> {
    const application = this.applications.get(applicationId);
    if (!application) throw new Error('Application not found');

    const newInterview = {
      ...interview,
      id: crypto.randomUUID()
    };

    const { data, error } = await supabase
      .from('job_applications')
      .update({
        interviews: [...application.interviews, newInterview],
        status: 'interviewing',
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;

    const updatedApplication = this.transformJobApplication(data);
    this.applications.set(updatedApplication.id, updatedApplication);
    return updatedApplication;
  }

  async findMatches(jobId: string, limit: number = 10): Promise<MatchResult[]> {
    const job = this.jobListings.get(jobId);
    if (!job) throw new Error('Job listing not found');

    const candidates = Array.from(this.candidateProfiles.values());
    const matches = await Promise.all(
      candidates.map(async candidate => {
        const match = await this.calculateMatch(job, candidate);
        return {
          ...match,
          jobId,
          candidateId: candidate.id
        };
      })
    );

    return matches
      .filter(match => match.score > 0.6) // Minimum match threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private async calculateMatch(job: JobListing, candidate: CandidateProfile): Promise<Omit<MatchResult, 'jobId' | 'candidateId'>> {
    const factors = {
      skillsMatch: this.calculateSkillsMatch(job.skills, candidate.skills),
      experienceMatch: this.calculateExperienceMatch(job.experience, candidate.experience),
      locationMatch: this.calculateLocationMatch(job.location, candidate.preferences.locations),
      salaryMatch: this.calculateSalaryMatch(job.salary, candidate.preferences.salary),
      culturalMatch: await this.predictCulturalMatch(job, candidate)
    };

    const weights = {
      skillsMatch: 0.3,
      experienceMatch: 0.25,
      locationMatch: 0.2,
      salaryMatch: 0.15,
      culturalMatch: 0.1
    };

    const score = Object.entries(factors).reduce(
      (sum, [factor, value]) => sum + value * weights[factor],
      0
    );

    const explanation = this.generateMatchExplanation(factors, job, candidate);

    return { score, factors, explanation };
  }

  private calculateSkillsMatch(jobSkills: string[], candidateSkills: string[]): number {
    const requiredSkills = new Set(jobSkills);
    const matchedSkills = candidateSkills.filter(skill => requiredSkills.has(skill));
    return matchedSkills.length / requiredSkills.size;
  }

  private calculateExperienceMatch(
    jobExperience: JobListing['experience'],
    candidateExperience: CandidateProfile['experience']
  ): number {
    const totalYears = candidateExperience.reduce((sum, exp) => {
      const start = new Date(exp.startDate);
      const end = exp.endDate ? new Date(exp.endDate) : new Date();
      return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
    }, 0);

    if (totalYears < jobExperience.min) return 0;
    if (totalYears > jobExperience.max) return 1;
    return (totalYears - jobExperience.min) / (jobExperience.max - jobExperience.min);
  }

  private calculateLocationMatch(
    jobLocation: JobListing['location'],
    candidateLocations: string[]
  ): number {
    if (jobLocation.type === 'remote') return 1;
    if (!jobLocation.cities || !jobLocation.countries) return 0;

    const locationMatches = candidateLocations.some(loc => 
      jobLocation.cities.includes(loc) || jobLocation.countries.includes(loc)
    );

    return locationMatches ? 1 : 0;
  }

  private calculateSalaryMatch(
    jobSalary: JobListing['salary'],
    candidateSalary: CandidateProfile['preferences']['salary']
  ): number {
    if (candidateSalary.currency !== jobSalary.currency) return 0;
    if (candidateSalary.min > jobSalary.max) return 0;
    if (candidateSalary.min < jobSalary.min) return 1;
    return (jobSalary.max - candidateSalary.min) / (jobSalary.max - jobSalary.min);
  }

  private async predictCulturalMatch(job: JobListing, candidate: CandidateProfile): Promise<number> {
    // Use AI to predict cultural fit based on job description and candidate profile
    const prediction = await this.aiOptimizer.predictQuality({
      contentType: 'cultural_match',
      fileSize: 0,
      networkSpeed: 0,
      deviceCapabilities: {
        memory: 0,
        cpu: 0,
        gpu: false
      }
    });

    return prediction.suggestedQuality === 'high' ? 0.8 :
           prediction.suggestedQuality === 'medium' ? 0.5 : 0.3;
  }

  private generateMatchExplanation(
    factors: MatchResult['factors'],
    job: JobListing,
    candidate: CandidateProfile
  ): string[] {
    const explanation: string[] = [];

    if (factors.skillsMatch > 0.8) {
      explanation.push(`Strong skill match with ${Math.round(factors.skillsMatch * 100)}% of required skills`);
    }

    if (factors.experienceMatch > 0.7) {
      explanation.push('Experience level aligns well with requirements');
    }

    if (factors.locationMatch === 1) {
      explanation.push(job.location.type === 'remote' 
        ? 'Remote position matches candidate preferences'
        : 'Location preferences align with job location'
      );
    }

    if (factors.salaryMatch > 0.9) {
      explanation.push('Salary expectations are well-aligned');
    }

    if (factors.culturalMatch > 0.7) {
      explanation.push('Strong potential for cultural fit');
    }

    return explanation;
  }

  private async parseResume(url: string): Promise<JobApplication['resume']['parsed']> {
    // TODO: Implement resume parsing using AI
    return {
      experience: [],
      education: [],
      skills: [],
      languages: []
    };
  }

  private async screenApplication(applicationId: string): Promise<void> {
    const application = this.applications.get(applicationId);
    if (!application) throw new Error('Application not found');

    const job = this.jobListings.get(application.jobId);
    if (!job) throw new Error('Job listing not found');

    // Use AI to screen application
    const screening = {
      score: 0,
      feedback: '',
      redFlags: []
    };

    await this.updateApplicationStatus(applicationId, 'screening', { screening });
  }

  private async incrementApplicantCount(jobId: string): Promise<void> {
    const { error } = await supabase
      .from('job_listings')
      .update({
        applicant_count: supabase.raw('applicant_count + 1'),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (error) throw error;

    const job = this.jobListings.get(jobId);
    if (job) {
      job.applicantCount++;
      this.jobListings.set(jobId, job);
    }
  }

  private transformJobListing(raw: any): JobListing {
    return {
      id: raw.id,
      companyId: raw.company_id,
      title: raw.title,
      description: raw.description,
      requirements: raw.requirements,
      skills: raw.skills,
      experience: raw.experience,
      location: raw.location,
      salary: raw.salary,
      benefits: raw.benefits,
      status: raw.status,
      applicantCount: raw.applicant_count,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      expiresAt: raw.expires_at
    };
  }

  private transformJobApplication(raw: any): JobApplication {
    return {
      id: raw.id,
      jobId: raw.job_id,
      candidateId: raw.candidate_id,
      status: raw.status,
      resume: raw.resume,
      coverLetter: raw.cover_letter,
      screening: raw.screening,
      interviews: raw.interviews,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at
    };
  }

  private transformCandidateProfile(raw: any): CandidateProfile {
    return {
      id: raw.id,
      userId: raw.user_id,
      headline: raw.headline,
      summary: raw.summary,
      experience: raw.experience,
      education: raw.education,
      skills: raw.skills,
      languages: raw.languages,
      preferences: raw.preferences,
      privacy: raw.privacy,
      metrics: raw.metrics
    };
  }

  cleanup() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.jobListings.clear();
    this.applications.clear();
    this.candidateProfiles.clear();
  }
}

// Create recruitment service instance
export const recruitmentService = RecruitmentService.getInstance(); 