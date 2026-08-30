// src/config/roleTaxonomy.ts
//
// Role taxonomy for the campaign wizard's "Role(s) you're targeting" picker.
// ROLE_FAMILIES is the searchable universe -- hundreds of specific job-title
// strings grouped into families. Typing filters across every keyword in
// every family; the dropdown only ever surfaces the FAMILY (via
// FAMILY_LABELS), never a raw keyword, so the UI stays a short, scannable
// list even though the match surface underneath is huge. FAMILY_TO_TITLES
// is a separate, hand-picked set of 4 clean display titles per family (not
// sliced from ROLE_FAMILIES) since those keyword lists are optimized for
// matching, not for casing/readability (e.g. 'sde', 'k8s engineer',
// 'ci/cd engineer' are good to match against, bad to show as a title).

export const ROLE_FAMILIES: Record<string, string[]> = {

  // -- Software Engineering --------------------------------------------
  backend: [
    'backend developer', 'backend engineer', 'server side developer',
    'java developer', 'java engineer', 'spring boot developer',
    'python developer', 'python engineer', 'django developer', 'flask developer',
    'node developer', 'nodejs developer', 'node.js developer',
    'golang developer', 'go developer', 'go engineer',
    'ruby developer', 'ruby on rails developer', 'rails developer',
    'php developer', 'laravel developer', 'symfony developer',
    '.net developer', 'c# developer', 'asp.net developer',
    'rust developer', 'rust engineer',
    'scala developer', 'scala engineer',
    'kotlin developer', 'kotlin backend developer',
    'api developer', 'api engineer', 'rest api developer',
    'microservices developer', 'microservices engineer',
    'graphql developer', 'grpc developer',
  ],

  frontend: [
    'frontend developer', 'frontend engineer', 'front end developer',
    'react developer', 'react engineer', 'react.js developer',
    'angular developer', 'angular engineer',
    'vue developer', 'vue.js developer', 'vuejs developer',
    'javascript developer', 'typescript developer',
    'ui developer', 'ui engineer', 'web developer', 'web designer',
    'html css developer', 'html developer',
    'next.js developer', 'nextjs developer',
    'svelte developer', 'svelte engineer',
    'nuxt developer', 'nuxt.js developer',
    'ember developer', 'backbone developer',
    'css developer', 'tailwind developer',
  ],

  fullstack: [
    'full stack developer', 'full stack engineer', 'fullstack developer',
    'fullstack engineer', 'software developer', 'software engineer',
    'sde', 'sde-1', 'sde-2', 'sde1', 'sde2',
    'application developer', 'application engineer',
    'mern stack developer', 'mean stack developer', 'lamp stack developer',
    'web application developer', 'web application engineer',
    'java full stack developer', 'python full stack developer',
    'software development engineer', 'associate software engineer',
    'junior software engineer', 'senior software engineer',
    'staff software engineer', 'principal software engineer',
  ],

  // -- Data & Analytics --------------------------------------------------
  data_engineering: [
    'data engineer', 'data pipeline engineer', 'etl developer',
    'etl engineer', 'data platform engineer', 'big data engineer',
    'spark developer', 'spark engineer', 'hadoop developer',
    'kafka engineer', 'kafka developer', 'streaming engineer',
    'airflow developer', 'dbt developer', 'dbt engineer',
    'snowflake developer', 'snowflake engineer',
    'databricks engineer', 'databricks developer',
    'data warehouse engineer', 'data infrastructure engineer',
    'analytics engineer', 'sql developer', 'sql engineer',
  ],

  data_science: [
    'data scientist', 'data science engineer', 'applied scientist',
    'ml engineer', 'machine learning engineer', 'machine learning scientist',
    'ai engineer', 'artificial intelligence engineer',
    'deep learning engineer', 'deep learning scientist',
    'nlp engineer', 'nlp scientist', 'computer vision engineer',
    'research scientist', 'applied ml engineer',
    'data analyst', 'business analyst', 'business intelligence analyst',
    'bi developer', 'bi engineer', 'reporting analyst',
    'quantitative analyst', 'quant developer',
    'statistician', 'data analytics engineer',
  ],

  // -- DevOps & Cloud ------------------------------------------------------
  devops: [
    'devops engineer', 'devops developer', 'devsecops engineer',
    'sre', 'site reliability engineer', 'platform engineer',
    'cloud engineer', 'cloud architect', 'cloud developer',
    'infrastructure engineer', 'infrastructure developer',
    'terraform engineer', 'terraform developer',
    'ansible engineer', 'ansible developer',
    'kubernetes engineer', 'k8s engineer', 'kubernetes developer',
    'docker engineer', 'container engineer',
    'ci/cd engineer', 'release engineer', 'build engineer',
    'aws engineer', 'aws developer', 'aws architect',
    'azure engineer', 'azure developer', 'azure architect',
    'gcp engineer', 'gcp developer', 'google cloud engineer',
    'linux engineer', 'linux administrator', 'systems engineer',
    'systems administrator', 'sysadmin',
    'network engineer', 'network administrator',
    'helm engineer', 'jenkins engineer',
  ],

  // -- Mobile --------------------------------------------------------------
  mobile: [
    'ios developer', 'ios engineer', 'swift developer', 'swift engineer',
    'android developer', 'android engineer', 'kotlin mobile developer',
    'react native developer', 'react native engineer',
    'flutter developer', 'flutter engineer', 'dart developer',
    'xamarin developer', 'cross platform mobile developer',
    'mobile developer', 'mobile engineer',
    'ionic developer', 'cordova developer',
  ],

  // -- QA & Testing ----------------------------------------------------
  qa: [
    'qa engineer', 'qa analyst', 'quality assurance engineer',
    'quality assurance analyst', 'sdet', 'software development engineer in test',
    'test engineer', 'test analyst', 'test automation engineer',
    'automation engineer', 'automation tester',
    'manual tester', 'manual qa', 'functional tester',
    'performance engineer', 'performance tester', 'load tester',
    'security tester', 'penetration tester for qa',
    'selenium engineer', 'cypress developer', 'playwright engineer',
    'appium engineer', 'mobile test engineer',
    'api test engineer', 'postman engineer',
  ],

  // -- Security --------------------------------------------------------
  security: [
    'security engineer', 'cybersecurity engineer', 'information security engineer',
    'application security engineer', 'appsec engineer',
    'penetration tester', 'pen tester', 'ethical hacker',
    'security analyst', 'cybersecurity analyst', 'soc analyst',
    'incident response engineer', 'threat analyst',
    'cloud security engineer', 'devsecops',
    'iam engineer', 'identity engineer',
    'cryptography engineer', 'vulnerability analyst',
    'security architect', 'ciso', 'security consultant',
    'grc analyst', 'compliance analyst',
  ],

  // -- Database & Storage ------------------------------------------------
  database: [
    'database administrator', 'dba', 'database developer',
    'database engineer', 'mysql developer', 'postgresql developer',
    'oracle developer', 'oracle dba', 'sql server dba',
    'mongodb developer', 'nosql developer', 'cassandra developer',
    'redis developer', 'elasticsearch engineer',
    'database architect', 'data modeler',
  ],

  // -- Embedded & Hardware -------------------------------------------------
  embedded: [
    'embedded engineer', 'embedded software engineer', 'embedded developer',
    'firmware engineer', 'firmware developer',
    'iot engineer', 'iot developer', 'internet of things developer',
    'hardware engineer', 'fpga developer', 'fpga engineer',
    'rtos developer', 'c embedded developer',
    'automotive software engineer', 'robotics engineer',
    'plc programmer', 'scada engineer',
  ],

  // -- Product & Design ----------------------------------------------------
  product: [
    'product manager', 'product owner', 'technical product manager',
    'associate product manager', 'senior product manager',
    'product analyst', 'growth product manager',
  ],

  design: [
    'ui ux designer', 'ux designer', 'ui designer',
    'product designer', 'visual designer', 'graphic designer',
    'interaction designer', 'ux researcher',
    'figma designer', 'design engineer',
    'motion designer', 'brand designer',
  ],

  // -- Project & Program Management -----------------------------------
  management: [
    'project manager', 'program manager', 'technical project manager',
    'scrum master', 'agile coach', 'delivery manager',
    'engineering manager', 'tech lead', 'technical lead',
    'team lead', 'it manager', 'it project manager',
  ],

  // -- Architecture & Governance --------------------------------------
  architecture: [
    'solutions architect', 'software architect', 'enterprise architect',
    'data architect', 'cloud architect', 'technical architect',
    'system architect', 'integration architect',
  ],

  // -- Healthcare IT --------------------------------------------------------
  healthcare_it: [
    'healthcare it analyst', 'clinical informatics analyst',
    'medical informatics specialist', 'ehr developer', 'emr developer',
    'epic developer', 'epic analyst', 'cerner developer',
    'hl7 developer', 'fhir developer', 'health data analyst',
    'clinical data engineer', 'healthcare data analyst',
    'health informatics specialist', 'clinical systems analyst',
    'pharmacy it analyst', 'radiology it analyst',
    'medical device software engineer', 'healthcare software engineer',
  ],

  // -- Finance & Fintech ----------------------------------------------
  fintech: [
    'fintech developer', 'fintech engineer', 'payments engineer',
    'payments developer', 'banking software developer',
    'trading systems developer', 'quant developer',
    'risk analyst', 'financial software engineer',
    'blockchain developer', 'smart contract developer', 'solidity developer',
    'web3 developer', 'defi developer', 'cryptocurrency developer',
    'banking analyst', 'financial analyst',
  ],

  // -- Support & IT Operations ------------------------------------------
  it_support: [
    'it support engineer', 'it support analyst', 'helpdesk engineer',
    'desktop support engineer', 'technical support engineer',
    'it operations engineer', 'service desk analyst',
    'it technician', 'system support engineer',
  ],

  // -- Game Development -------------------------------------------------
  gamedev: [
    'game developer', 'game engineer', 'unity developer', 'unity engineer',
    'unreal developer', 'unreal engine developer',
    'game designer', 'gameplay programmer', 'graphics programmer',
    '3d developer', 'vr developer', 'ar developer',
    'game backend developer', 'game tools developer',
  ],

  // -- Non-IT domains ---------------------------------------------------
  business: [
    'business analyst', 'systems analyst', 'operations analyst',
    'strategy analyst', 'management consultant',
    'it business analyst', 'functional analyst',
  ],

  marketing_tech: [
    'marketing technologist', 'martech developer', 'crm developer',
    'salesforce developer', 'salesforce admin', 'hubspot developer',
    'digital marketing analyst', 'seo specialist', 'growth engineer',
  ],

  research: [
    'research engineer', 'research scientist', 'research analyst',
    'computer science researcher', 'applied researcher',
    'lab engineer', 'simulation engineer',
  ],

}

// Human-readable label shown in the dropdown/tags for each family key --
// never the raw snake_case key, never a raw keyword from ROLE_FAMILIES.
export const FAMILY_LABELS: Record<string, string> = {
  backend: 'Backend Engineering',
  frontend: 'Frontend Engineering',
  fullstack: 'Full-Stack Engineering',
  data_engineering: 'Data Engineering',
  data_science: 'Data Science / ML',
  devops: 'DevOps & Cloud',
  mobile: 'Mobile Engineering',
  qa: 'QA & Testing',
  security: 'Security',
  database: 'Database & Storage',
  embedded: 'Embedded & Hardware',
  product: 'Product Management',
  design: 'Design / UX',
  management: 'Project & Program Management',
  architecture: 'Solutions Architecture',
  healthcare_it: 'Healthcare IT',
  fintech: 'Finance & Fintech',
  it_support: 'IT Support & Operations',
  gamedev: 'Game Development',
  business: 'Business Analysis',
  marketing_tech: 'Marketing Technology',
  research: 'Research',
}

// Hand-picked, cleanly-cased titles per family -- deliberately NOT sliced
// from ROLE_FAMILIES above, since those keyword lists favor exhaustive
// matching over display quality (raw entries like 'sde', 'k8s engineer',
// 'ci/cd engineer' are good to match against, bad to show as a title or
// feed to the AI hiring-title resolver as the candidate's own role).
export const FAMILY_TO_TITLES: Record<string, string[]> = {
  backend: ['Backend Engineer', 'Backend Developer', 'Software Engineer', 'API Engineer'],
  frontend: ['Frontend Engineer', 'Frontend Developer', 'React Developer', 'UI Engineer'],
  fullstack: ['Full Stack Engineer', 'Full Stack Developer', 'Software Engineer', 'Application Developer'],
  data_engineering: ['Data Engineer', 'Analytics Engineer', 'ETL Engineer', 'Data Platform Engineer'],
  data_science: ['Data Scientist', 'Machine Learning Engineer', 'AI Engineer', 'Data Analyst'],
  devops: ['DevOps Engineer', 'Site Reliability Engineer', 'Platform Engineer', 'Cloud Engineer'],
  mobile: ['Mobile Engineer', 'iOS Engineer', 'Android Engineer', 'React Native Developer'],
  qa: ['QA Engineer', 'Test Engineer', 'SDET', 'Automation Engineer'],
  security: ['Security Engineer', 'Application Security Engineer', 'Security Analyst', 'Penetration Tester'],
  database: ['Database Engineer', 'Database Administrator', 'Database Developer', 'Data Modeler'],
  embedded: ['Embedded Engineer', 'Firmware Engineer', 'IoT Engineer', 'Hardware Engineer'],
  product: ['Product Manager', 'Technical Product Manager', 'Senior Product Manager', 'Product Owner'],
  design: ['UX Designer', 'Product Designer', 'UI Designer', 'UX Researcher'],
  management: ['Engineering Manager', 'Technical Program Manager', 'Project Manager', 'Scrum Master'],
  architecture: ['Solutions Architect', 'Software Architect', 'Cloud Architect', 'Technical Architect'],
  healthcare_it: ['Healthcare IT Analyst', 'Clinical Informatics Analyst', 'EHR Developer', 'Health Data Analyst'],
  fintech: ['Fintech Engineer', 'Payments Engineer', 'Financial Software Engineer', 'Blockchain Developer'],
  it_support: ['IT Support Engineer', 'Technical Support Engineer', 'Help Desk Engineer', 'IT Operations Engineer'],
  gamedev: ['Game Developer', 'Unity Developer', 'Gameplay Programmer', 'Graphics Programmer'],
  business: ['Business Analyst', 'Systems Analyst', 'Operations Analyst', 'IT Business Analyst'],
  marketing_tech: ['Marketing Technologist', 'Salesforce Developer', 'CRM Developer', 'Growth Engineer'],
  research: ['Research Engineer', 'Research Scientist', 'Applied Researcher', 'Research Analyst'],
}

// Returns the family key for a given role string, or null if it doesn't
// match anything in the taxonomy -- used to classify a free-typed custom
// role that wasn't picked from a suggestion.
export function getRoleFamily(role: string): string | null {
  const lower = role.toLowerCase().trim()
  for (const [family, keywords] of Object.entries(ROLE_FAMILIES)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword) || keyword.includes(lower)) {
        return family
      }
    }
  }
  return null
}

// Powers the interactive search dropdown: matches the query against every
// keyword in every family (not just the family label), but returns family
// KEYS only, deduped -- so typing something specific like "spring boot" or
// "kafka" surfaces "Backend Engineering" / "Data Engineering" in the list,
// never the raw keyword itself. Empty query returns every family.
export function searchRoleFamilies(query: string): string[] {
  const q = query.trim().toLowerCase()
  const matches: string[] = []
  for (const [family, keywords] of Object.entries(ROLE_FAMILIES)) {
    const label = FAMILY_LABELS[family] ?? family
    const isMatch = !q || label.toLowerCase().includes(q) || keywords.some(k => k.includes(q))
    if (isMatch) matches.push(family)
  }
  return matches
}
