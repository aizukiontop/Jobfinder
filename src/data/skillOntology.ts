/**
 * JobFinder – Skill Ontology  Gs = (Vs, Es)
 *
 * Thesis §Method (p.24):
 *   "Let Gs = (Vs, Es) represent the skill ontology.
 *    Vs is the set of skill nodes, and Es is the set of relationships
 *    between skills."
 *
 * Structure:
 *   • Six disjoint category trees — one per JobFinder category.
 *   • No common super-root: Sim(React, Bookkeeping) = 0.
 *   • Edge types: 'broader' | 'narrower' | 'related' — all cost 1.
 *   • Traversal is undirected (BFS ignores direction) so Sim is symmetric.
 *   • Skills not in Vs return Sim = 0 and are logged as coverage gaps.
 */

export interface SkillNode {
  id: string
  label: string
  synonyms: string[]
  category: string
}

export interface SkillEdge {
  from: string
  to: string
  type: 'broader' | 'narrower' | 'related'
}

// ─── Vs: Skill Nodes ──────────────────────────────────────────────────────────

export const SKILL_NODES: SkillNode[] = [
  // ── IT & Software ──────────────────────────────────────────────────────────
  { id: 'programming', label: 'Programming', synonyms: ['coding', 'software development', 'software engineering'], category: 'IT & Software' },

  { id: 'web_dev', label: 'Web Development', synonyms: ['web development', 'web developer'], category: 'IT & Software' },
  { id: 'html', label: 'HTML', synonyms: ['html5', 'hypertext markup language'], category: 'IT & Software' },
  { id: 'css', label: 'CSS', synonyms: ['css3', 'cascading style sheets', 'styling'], category: 'IT & Software' },
  { id: 'tailwind', label: 'Tailwind CSS', synonyms: ['tailwindcss', 'tailwind'], category: 'IT & Software' },
  { id: 'javascript', label: 'JavaScript', synonyms: ['js', 'javascript', 'ecmascript', 'es6', 'vanilla js'], category: 'IT & Software' },
  { id: 'typescript', label: 'TypeScript', synonyms: ['ts', 'typescript'], category: 'IT & Software' },
  { id: 'react', label: 'React', synonyms: ['reactjs', 'react.js', 'react js'], category: 'IT & Software' },
  { id: 'vue', label: 'Vue.js', synonyms: ['vue', 'vuejs', 'vue3', 'vue js'], category: 'IT & Software' },
  { id: 'angular', label: 'Angular', synonyms: ['angularjs', 'angular js'], category: 'IT & Software' },
  { id: 'react_native', label: 'React Native', synonyms: ['react native', 'rn'], category: 'IT & Software' },
  { id: 'nextjs', label: 'Next.js', synonyms: ['next', 'next.js', 'nextjs'], category: 'IT & Software' },
  { id: 'figma', label: 'Figma', synonyms: ['figma'], category: 'IT & Software' },
  { id: 'accessibility', label: 'Accessibility', synonyms: ['wcag', 'a11y', 'web accessibility'], category: 'IT & Software' },
  { id: 'design_systems', label: 'Design Systems', synonyms: ['design system', 'component library', 'ui library'], category: 'IT & Software' },

  { id: 'game_dev', label: 'Game Development', synonyms: ['game development', 'game developer', 'game programming', 'gamedev', 'game design'], category: 'IT & Software' },
  { id: 'unity', label: 'Unity', synonyms: ['unity', 'unity3d', 'unity 3d', 'unity engine'], category: 'IT & Software' },
  { id: 'unreal', label: 'Unreal Engine', synonyms: ['unreal', 'unreal engine', 'ue4', 'ue5'], category: 'IT & Software' },
  { id: 'cpp', label: 'C++', synonyms: ['c++', 'cpp', 'c plus plus'], category: 'IT & Software' },
  { id: 'csharp', label: 'C#', synonyms: ['c#', 'csharp', 'c sharp'], category: 'IT & Software' },
  { id: 'luau', label: 'Luau', synonyms: ['luau', 'lua', 'roblox scripting'], category: 'IT & Software' },

  { id: 'data_analytics', label: 'Data Analytics', synonyms: ['data analytics', 'data analysis', 'data analyst', 'data science'], category: 'IT & Software' },
  { id: 'ai_ml', label: 'Artificial Intelligence', synonyms: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning'], category: 'IT & Software' },

  { id: 'backend_dev', label: 'Backend Development', synonyms: ['backend', 'server-side', 'server side'], category: 'IT & Software' },
  { id: 'nodejs', label: 'Node.js', synonyms: ['node', 'nodejs', 'node js'], category: 'IT & Software' },
  { id: 'python', label: 'Python', synonyms: ['python3', 'py'], category: 'IT & Software' },
  { id: 'java', label: 'Java', synonyms: ['java'], category: 'IT & Software' },
  { id: 'php', label: 'PHP', synonyms: ['php', 'laravel'], category: 'IT & Software' },
  { id: 'dotnet', label: '.NET', synonyms: ['.net', 'dotnet', 'asp.net', 'aspnet', '.net core', 'asp.net core'], category: 'IT & Software' },
  { id: 'express', label: 'Express.js', synonyms: ['express', 'expressjs', 'express.js'], category: 'IT & Software' },
  { id: 'rest_api', label: 'REST API', synonyms: ['rest', 'restful api', 'api development', 'api design'], category: 'IT & Software' },
  { id: 'microservices', label: 'Microservices', synonyms: ['microservices', 'micro-services'], category: 'IT & Software' },

  { id: 'databases', label: 'Databases', synonyms: ['database', 'db'], category: 'IT & Software' },
  { id: 'sql', label: 'SQL', synonyms: ['sql', 'structured query language', 'mysql', 'mariadb'], category: 'IT & Software' },
  { id: 'postgresql', label: 'PostgreSQL', synonyms: ['postgres', 'postgresql'], category: 'IT & Software' },
  { id: 'mongodb', label: 'MongoDB', synonyms: ['mongo', 'mongodb'], category: 'IT & Software' },
  { id: 'redis', label: 'Redis', synonyms: ['redis'], category: 'IT & Software' },

  { id: 'cloud_devops', label: 'Cloud & DevOps', synonyms: ['devops', 'cloud computing', 'cloud'], category: 'IT & Software' },
  { id: 'aws', label: 'AWS', synonyms: ['amazon web services', 'aws'], category: 'IT & Software' },
  { id: 'gcp', label: 'Google Cloud', synonyms: ['gcp', 'google cloud platform'], category: 'IT & Software' },
  { id: 'docker', label: 'Docker', synonyms: ['docker', 'containerization', 'containers'], category: 'IT & Software' },
  { id: 'git', label: 'Git', synonyms: ['git', 'github', 'gitlab', 'version control'], category: 'IT & Software' },
  { id: 'cicd', label: 'CI/CD', synonyms: ['cicd', 'ci/cd', 'continuous integration', 'continuous deployment', 'github actions'], category: 'IT & Software' },

  { id: 'it_support', label: 'IT Support', synonyms: ['technical support', 'helpdesk', 'help desk', 'tech support', 'it support'], category: 'IT & Software' },
  { id: 'networking', label: 'Networking', synonyms: ['networking', 'network administration', 'network admin'], category: 'IT & Software' },
  { id: 'tcpip', label: 'TCP/IP', synonyms: ['tcp/ip', 'tcpip', 'tcp ip'], category: 'IT & Software' },
  { id: 'lan_wan', label: 'LAN/WAN', synonyms: ['lan', 'wan', 'lan/wan', 'local area network'], category: 'IT & Software' },
  { id: 'cisco', label: 'Cisco', synonyms: ['cisco', 'ccna', 'cisco networking'], category: 'IT & Software' },
  { id: 'windows_os', label: 'Windows OS', synonyms: ['windows', 'windows os', 'microsoft windows'], category: 'IT & Software' },
  { id: 'office365', label: 'Office 365', synonyms: ['office 365', 'microsoft 365', 'ms office', 'microsoft office', 'office365'], category: 'IT & Software' },
  { id: 'troubleshooting', label: 'Troubleshooting', synonyms: ['troubleshooting', 'problem solving technical', 'equipment troubleshooting', 'fault diagnosis', 'technical diagnosis', 'maintenance troubleshooting'], category: 'IT & Software' },

  { id: 'testing', label: 'Software Testing', synonyms: ['qa', 'quality assurance', 'testing', 'unit testing'], category: 'IT & Software' },
  { id: 'jest', label: 'Jest', synonyms: ['jest', 'jest testing'], category: 'IT & Software' },
  { id: 'automation', label: 'Automation', synonyms: ['automation', 'scripting', 'automated testing'], category: 'IT & Software' },

  // ── Sales & Marketing ──────────────────────────────────────────────────────
  { id: 'marketing', label: 'Marketing', synonyms: ['marketing'], category: 'Sales & Marketing' },
  { id: 'digital_marketing', label: 'Digital Marketing', synonyms: ['digital marketing', 'online marketing', 'internet marketing'], category: 'Sales & Marketing' },
  { id: 'social_media', label: 'Social Media', synonyms: ['social media management', 'social media marketing', 'smm'], category: 'Sales & Marketing' },
  { id: 'content_creation', label: 'Content Creation', synonyms: ['content creation', 'content writing', 'copywriting', 'content marketing'], category: 'Sales & Marketing' },
  { id: 'seo', label: 'SEO', synonyms: ['seo', 'search engine optimization', 'sem'], category: 'Sales & Marketing' },
  { id: 'analytics', label: 'Marketing Analytics', synonyms: ['analytics', 'google analytics', 'marketing analytics', 'web analytics', 'campaign analytics'], category: 'Sales & Marketing' },
  { id: 'campaign_management', label: 'Campaign Management', synonyms: ['campaign management', 'campaign planning'], category: 'Sales & Marketing' },

  { id: 'sales', label: 'Sales', synonyms: ['sales', 'selling', 'b2b sales', 'b2c sales'], category: 'Sales & Marketing' },
  { id: 'pos_operation', label: 'POS Operation', synonyms: ['pos', 'point of sale', 'cashiering', 'cashier', 'cash handling', 'cash register', 'register operation', 'till operation'], category: 'Sales & Marketing' },
  { id: 'crm', label: 'CRM', synonyms: ['crm', 'customer relationship management', 'salesforce'], category: 'Sales & Marketing' },

  { id: 'graphic_design', label: 'Graphic Design', synonyms: ['graphic design', 'visual design', 'graphics'], category: 'Sales & Marketing' },
  { id: 'photoshop', label: 'Adobe Photoshop', synonyms: ['photoshop', 'adobe photoshop', 'ps'], category: 'Sales & Marketing' },
  { id: 'illustrator', label: 'Adobe Illustrator', synonyms: ['illustrator', 'adobe illustrator'], category: 'Sales & Marketing' },
  { id: 'canva', label: 'Canva', synonyms: ['canva'], category: 'Sales & Marketing' },
  { id: 'typography', label: 'Typography', synonyms: ['typography', 'type design'], category: 'Sales & Marketing' },
  { id: 'branding', label: 'Branding', synonyms: ['branding', 'brand identity', 'brand management'], category: 'Sales & Marketing' },

  // ── Visual Media Production (Sales & Marketing sub-domain) ─────────────────
  { id: 'video_editing', label: 'Video Editing', synonyms: [
    'video editing', 'video editor', 'video production', 'video production specialist',
    'video creation', 'film editing', 'video content creation', 'videography',
  ], category: 'Sales & Marketing' },
  { id: 'premiere', label: 'Adobe Premiere', synonyms: ['adobe premiere', 'premiere', 'premiere pro', 'adobe premiere pro'], category: 'Sales & Marketing' },
  { id: 'image_editing', label: 'Image Editing', synonyms: [
    'image editing', 'photo editing', 'photo retouching', 'digital photo editing',
    'image manipulation', 'photo manipulation',
  ], category: 'Sales & Marketing' },

  // ── Customer Service ───────────────────────────────────────────────────────
  { id: 'customer_service', label: 'Customer Service', synonyms: ['customer service', 'client service', 'customer care', 'customer support', 'client relations', 'guest relations', 'service orientation'], category: 'Customer Service' },
  { id: 'english_communication', label: 'English Communication', synonyms: ['english communication', 'english proficiency', 'business english', 'english skills'], category: 'Customer Service' },
  { id: 'communication', label: 'Communication', synonyms: ['communication', 'communication skills', 'verbal communication', 'written communication', 'interpersonal skills', 'interpersonal communication'], category: 'Customer Service' },
  { id: 'problem_solving', label: 'Problem Solving', synonyms: ['problem solving', 'analytical thinking', 'critical thinking', 'analytical skills', 'diagnostic thinking'], category: 'Customer Service' },
  { id: 'technical_support', label: 'Technical Support', synonyms: ['technical support', 'tech support', 'tier 1 support', 'tier 2 support'], category: 'Customer Service' },

  // ── Healthcare ─────────────────────────────────────────────────────────────
  { id: 'nursing', label: 'Nursing', synonyms: ['nursing', 'registered nurse', 'rn'], category: 'Healthcare' },
  { id: 'patient_care', label: 'Patient Care', synonyms: ['patient care', 'bedside manner', 'clinical care'], category: 'Healthcare' },
  { id: 'bls_cpr', label: 'BLS/CPR', synonyms: ['bls', 'cpr', 'basic life support', 'cardiopulmonary resuscitation'], category: 'Healthcare' },
  { id: 'clinical_assessment', label: 'Clinical Assessment', synonyms: ['clinical assessment', 'health assessment', 'patient assessment'], category: 'Healthcare' },
  { id: 'medication_admin', label: 'Medication Administration', synonyms: ['medication administration', 'drug administration', 'medication management'], category: 'Healthcare' },
  { id: 'vital_signs', label: 'Vital Signs Monitoring', synonyms: ['vital signs', 'vitals monitoring'], category: 'Healthcare' },

  // ── Accounting ─────────────────────────────────────────────────────────────
  { id: 'accounting', label: 'Accounting', synonyms: ['accounting', 'accountancy'], category: 'Accounting' },
  { id: 'bookkeeping', label: 'Bookkeeping', synonyms: ['bookkeeping', 'bookkeeper', 'books of accounts', 'financial record keeping', 'basic bookkeeping', 'accounts recording'], category: 'Accounting' },
  { id: 'financial_reporting', label: 'Financial Reporting', synonyms: ['financial reporting', 'financial statements', 'financial reports'], category: 'Accounting' },
  { id: 'bir_compliance', label: 'BIR Compliance', synonyms: ['bir compliance', 'bir filing', 'tax filing', 'tax compliance', 'bir'], category: 'Accounting' },
  { id: 'accounts_payable', label: 'Accounts Payable', synonyms: ['accounts payable', 'ap', 'payables'], category: 'Accounting' },
  { id: 'accounts_receivable', label: 'Accounts Receivable', synonyms: ['accounts receivable', 'ar', 'receivables'], category: 'Accounting' },
  { id: 'quickbooks', label: 'QuickBooks', synonyms: ['quickbooks', 'quick books'], category: 'Accounting' },
  { id: 'excel_accounting', label: 'Microsoft Excel', synonyms: ['microsoft excel', 'excel', 'ms excel', 'spreadsheet'], category: 'Accounting' },
  { id: 'audit', label: 'Auditing', synonyms: ['audit', 'auditing', 'internal audit'], category: 'Accounting' },

  // ── Administrative ─────────────────────────────────────────────────────────
  { id: 'admin_support', label: 'Administrative Support', synonyms: ['administrative support', 'admin support', 'clerical work', 'clerical'], category: 'Administrative' },
  { id: 'ms_office', label: 'Microsoft Office', synonyms: ['microsoft office', 'ms office', 'office suite'], category: 'Administrative' },
  { id: 'ms_word', label: 'Microsoft Word', synonyms: ['microsoft word', 'ms word', 'word processing'], category: 'Administrative' },
  { id: 'ms_excel_admin', label: 'Microsoft Excel', synonyms: ['microsoft excel', 'excel', 'ms excel', 'spreadsheet', 'excel spreadsheet', 'spreadsheet management'], category: 'Administrative' },
  { id: 'filing', label: 'Filing & Records Management', synonyms: ['filing', 'records management', 'document management', 'file management'], category: 'Administrative' },
  { id: 'scheduling', label: 'Scheduling', synonyms: ['scheduling', 'calendar management', 'time management', 'production planning', 'work planning', 'operations scheduling', 'production scheduling'], category: 'Administrative' },
  { id: 'data_entry', label: 'Data Entry', synonyms: ['data entry', 'data encoding', 'encoding', 'data processing', 'records entry'], category: 'Administrative' },
  { id: 'typing', label: 'Typing', synonyms: ['typing', 'keyboarding', 'fast typing'], category: 'Administrative' },
  { id: 'inventory_mgmt', label: 'Inventory Management', synonyms: ['inventory management', 'inventory control', 'stock management', 'stock control', 'materials management', 'warehouse management', 'stores management'], category: 'Administrative' },
  { id: 'logistics', label: 'Logistics', synonyms: ['logistics', 'supply chain', 'warehousing', 'distribution', 'supply chain management', 'shipping and receiving'], category: 'Administrative' },
]

// ─── Es: Skill Edges ──────────────────────────────────────────────────────────

export const SKILL_EDGES: SkillEdge[] = [
  // ── IT & Software tree ────────────────────────────────────────────────────

  // Programming → Web/Backend
  { from: 'programming', to: 'web_dev', type: 'narrower' },
  { from: 'programming', to: 'backend_dev', type: 'narrower' },
  { from: 'programming', to: 'testing', type: 'narrower' },
  { from: 'programming', to: 'automation', type: 'narrower' },
  { from: 'programming', to: 'databases', type: 'related' },

  // Web Dev → languages/frameworks
  { from: 'web_dev', to: 'html', type: 'narrower' },
  { from: 'web_dev', to: 'css', type: 'narrower' },
  { from: 'web_dev', to: 'javascript', type: 'narrower' },
  { from: 'web_dev', to: 'typescript', type: 'narrower' },
  { from: 'web_dev', to: 'figma', type: 'related' },
  { from: 'web_dev', to: 'accessibility', type: 'related' },
  { from: 'web_dev', to: 'design_systems', type: 'related' },

  // CSS specialisations
  { from: 'css', to: 'tailwind', type: 'narrower' },
  { from: 'css', to: 'design_systems', type: 'related' },

  // JavaScript → frameworks
  { from: 'javascript', to: 'typescript', type: 'related' },
  { from: 'javascript', to: 'react', type: 'narrower' },
  { from: 'javascript', to: 'vue', type: 'narrower' },
  { from: 'javascript', to: 'angular', type: 'narrower' },
  { from: 'javascript', to: 'react_native', type: 'narrower' },
  { from: 'javascript', to: 'nodejs', type: 'related' },

  // React family
  { from: 'react', to: 'nextjs', type: 'narrower' },
  { from: 'react', to: 'react_native', type: 'related' },
  { from: 'react', to: 'vue', type: 'related' },
  { from: 'react', to: 'angular', type: 'related' },

  // Game development — the engine and its language carry the match,
  // not the fact that a language is involved at all.
  { from: 'programming', to: 'game_dev', type: 'narrower' },
  { from: 'game_dev', to: 'unity', type: 'narrower' },
  { from: 'game_dev', to: 'unreal', type: 'narrower' },
  { from: 'game_dev', to: 'cpp', type: 'narrower' },
  { from: 'game_dev', to: 'csharp', type: 'narrower' },
  { from: 'game_dev', to: 'luau', type: 'narrower' },
  { from: 'unity', to: 'csharp', type: 'related' },
  { from: 'unreal', to: 'cpp', type: 'related' },
  { from: 'cpp', to: 'csharp', type: 'related' },

  // Data analytics — distinct from the marketing sense of "analytics", and
  // anchored to the data it works on rather than to programming in general.
  { from: 'databases', to: 'data_analytics', type: 'related' },
  { from: 'data_analytics', to: 'ai_ml', type: 'narrower' },
  { from: 'data_analytics', to: 'sql', type: 'related' },
  { from: 'data_analytics', to: 'python', type: 'related' },
  { from: 'ai_ml', to: 'python', type: 'related' },

  // Backend
  { from: 'backend_dev', to: 'nodejs', type: 'narrower' },
  { from: 'backend_dev', to: 'python', type: 'narrower' },
  { from: 'backend_dev', to: 'java', type: 'narrower' },
  { from: 'backend_dev', to: 'php', type: 'narrower' },
  { from: 'backend_dev', to: 'dotnet', type: 'narrower' },
  { from: 'backend_dev', to: 'rest_api', type: 'narrower' },
  { from: 'dotnet', to: 'csharp', type: 'related' },
  { from: 'nodejs', to: 'express', type: 'narrower' },
  { from: 'backend_dev', to: 'microservices', type: 'narrower' },

  // REST/microservices
  { from: 'rest_api', to: 'microservices', type: 'related' },

  // Databases
  { from: 'databases', to: 'sql', type: 'narrower' },
  { from: 'databases', to: 'postgresql', type: 'narrower' },
  { from: 'databases', to: 'mongodb', type: 'narrower' },
  { from: 'databases', to: 'redis', type: 'narrower' },
  { from: 'sql', to: 'postgresql', type: 'narrower' },

  // Cloud/DevOps
  { from: 'cloud_devops', to: 'aws', type: 'narrower' },
  { from: 'cloud_devops', to: 'gcp', type: 'narrower' },
  { from: 'cloud_devops', to: 'docker', type: 'narrower' },
  { from: 'cloud_devops', to: 'git', type: 'narrower' },
  { from: 'cloud_devops', to: 'cicd', type: 'narrower' },
  { from: 'aws', to: 'gcp', type: 'related' },
  { from: 'git', to: 'cicd', type: 'related' },

  // Programming → Cloud/DevOps
  { from: 'programming', to: 'cloud_devops', type: 'related' },

  // Testing
  { from: 'testing', to: 'jest', type: 'narrower' },
  { from: 'testing', to: 'automation', type: 'related' },

  // IT Support
  { from: 'it_support', to: 'troubleshooting', type: 'narrower' },
  { from: 'it_support', to: 'networking', type: 'related' },
  { from: 'it_support', to: 'windows_os', type: 'related' },
  { from: 'it_support', to: 'office365', type: 'related' },

  // Networking
  { from: 'networking', to: 'tcpip', type: 'narrower' },
  { from: 'networking', to: 'lan_wan', type: 'narrower' },
  { from: 'networking', to: 'cisco', type: 'related' },

  // Design
  { from: 'figma', to: 'design_systems', type: 'related' },
  { from: 'figma', to: 'accessibility', type: 'related' },

  // ── Sales & Marketing tree ─────────────────────────────────────────────────
  { from: 'marketing', to: 'digital_marketing', type: 'narrower' },
  { from: 'marketing', to: 'campaign_management', type: 'narrower' },
  { from: 'marketing', to: 'analytics', type: 'related' },
  { from: 'marketing', to: 'graphic_design', type: 'related' },
  { from: 'marketing', to: 'branding', type: 'related' },

  { from: 'digital_marketing', to: 'social_media', type: 'narrower' },
  { from: 'digital_marketing', to: 'content_creation', type: 'narrower' },
  { from: 'digital_marketing', to: 'seo', type: 'narrower' },
  { from: 'digital_marketing', to: 'analytics', type: 'related' },
  { from: 'digital_marketing', to: 'campaign_management', type: 'related' },

  { from: 'social_media', to: 'content_creation', type: 'related' },
  { from: 'content_creation', to: 'branding', type: 'related' },

  { from: 'sales', to: 'crm', type: 'related' },
  { from: 'sales', to: 'pos_operation', type: 'related' },
  { from: 'marketing', to: 'sales', type: 'related' },

  { from: 'graphic_design', to: 'photoshop', type: 'narrower' },
  { from: 'graphic_design', to: 'illustrator', type: 'narrower' },
  { from: 'graphic_design', to: 'canva', type: 'narrower' },
  { from: 'graphic_design', to: 'typography', type: 'narrower' },
  { from: 'graphic_design', to: 'branding', type: 'related' },
  { from: 'photoshop', to: 'illustrator', type: 'related' },
  { from: 'photoshop', to: 'canva', type: 'related' },

  // ── Customer Service tree ──────────────────────────────────────────────────
  { from: 'customer_service', to: 'communication', type: 'narrower' },
  { from: 'customer_service', to: 'english_communication', type: 'narrower' },
  { from: 'customer_service', to: 'problem_solving', type: 'related' },
  { from: 'customer_service', to: 'technical_support', type: 'related' },
  { from: 'customer_service', to: 'crm', type: 'related' },

  { from: 'communication', to: 'english_communication', type: 'related' },
  { from: 'technical_support', to: 'problem_solving', type: 'related' },
  { from: 'technical_support', to: 'communication', type: 'related' },

  // ── Healthcare tree ────────────────────────────────────────────────────────
  { from: 'nursing', to: 'patient_care', type: 'narrower' },
  { from: 'nursing', to: 'bls_cpr', type: 'narrower' },
  { from: 'nursing', to: 'clinical_assessment', type: 'narrower' },
  { from: 'nursing', to: 'medication_admin', type: 'narrower' },
  { from: 'nursing', to: 'vital_signs', type: 'narrower' },

  { from: 'patient_care', to: 'clinical_assessment', type: 'related' },
  { from: 'patient_care', to: 'vital_signs', type: 'related' },
  { from: 'clinical_assessment', to: 'vital_signs', type: 'related' },
  { from: 'medication_admin', to: 'clinical_assessment', type: 'related' },
  { from: 'bls_cpr', to: 'patient_care', type: 'related' },

  // ── Accounting tree ────────────────────────────────────────────────────────
  { from: 'accounting', to: 'bookkeeping', type: 'narrower' },
  { from: 'accounting', to: 'financial_reporting', type: 'narrower' },
  { from: 'accounting', to: 'bir_compliance', type: 'narrower' },
  { from: 'accounting', to: 'audit', type: 'narrower' },
  { from: 'accounting', to: 'excel_accounting', type: 'related' },

  { from: 'bookkeeping', to: 'accounts_payable', type: 'narrower' },
  { from: 'bookkeeping', to: 'accounts_receivable', type: 'narrower' },
  { from: 'bookkeeping', to: 'quickbooks', type: 'related' },
  { from: 'bookkeeping', to: 'excel_accounting', type: 'related' },
  { from: 'bookkeeping', to: 'bir_compliance', type: 'related' },

  { from: 'financial_reporting', to: 'bir_compliance', type: 'related' },
  { from: 'accounts_payable', to: 'accounts_receivable', type: 'related' },
  { from: 'quickbooks', to: 'excel_accounting', type: 'related' },

  // ── Administrative tree ────────────────────────────────────────────────────
  { from: 'admin_support', to: 'ms_office', type: 'narrower' },
  { from: 'admin_support', to: 'filing', type: 'narrower' },
  { from: 'admin_support', to: 'scheduling', type: 'narrower' },
  { from: 'admin_support', to: 'data_entry', type: 'narrower' },
  { from: 'admin_support', to: 'communication', type: 'related' },

  { from: 'ms_office', to: 'ms_word', type: 'narrower' },
  { from: 'ms_office', to: 'ms_excel_admin', type: 'narrower' },

  { from: 'data_entry', to: 'typing', type: 'narrower' },
  { from: 'data_entry', to: 'ms_excel_admin', type: 'related' },

  { from: 'inventory_mgmt', to: 'logistics', type: 'related' },
  { from: 'admin_support', to: 'inventory_mgmt', type: 'related' },

  // ── Cross-tree semantic relationships (academically defensible) ─────────────
  //
  // IT & Software ↔ Customer Service:
  //   Troubleshooting is applied problem-solving in a technical/mechanical context.
  //   This edge is consistent with existing cross-tree design (admin_support→communication,
  //   customer_service→crm). Existing cross-tree precedent: dist(troubleshooting, customer_service) = 2.
  { from: 'troubleshooting', to: 'problem_solving', type: 'related' },

  // Administrative (within-tree direct shortcut):
  //   Scheduling and logistics are operationally coupled in warehouse/operations roles.
  //   Reduces existing dist=3 (via admin_support→inventory_mgmt) to dist=1.
  { from: 'scheduling', to: 'logistics', type: 'related' },

  // ── Sales & Marketing visual media sub-domain edges ─────────────────────────
  { from: 'graphic_design', to: 'image_editing', type: 'narrower' },
  { from: 'photoshop', to: 'image_editing', type: 'related' },
  { from: 'graphic_design', to: 'video_editing', type: 'related' },
  { from: 'video_editing', to: 'premiere', type: 'narrower' },
  { from: 'content_creation', to: 'video_editing', type: 'related' },
]
