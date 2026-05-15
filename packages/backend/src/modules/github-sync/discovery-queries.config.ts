/**
 * Search queries for GitHub skill discovery.
 * Core queries run every sync; extended queries run weekly.
 */

// Layer 1: Repository keyword search - Core skills
export const CORE_QUERIES = [
  'openclaw/skills',
  'pancakeswap/pancakeswap-ai',
  'trustwallet/tw-agent-skills',
  'unifai-network/unifai-cli',
  'GoPlusSecurity/agentguard',
  'mcp-server',
  'claude-skill',
  'agent-skill',
  'agent-tool',
  'ai-agent-tool',
  'llm-skill',
  'SKILL.md',
  'skill.md',
];

// Layer 1: Repository keyword search - Extended ecosystem
export const EXTENDED_QUERIES = [
  // Agent ecosystems
  'agent plugin',
  'agent extension', 
  'agent capability',
  'ai tool',
  'llm tool',
  'assistant tool',
  'ai automation',
  'ai workflow',
  
  // Platform ecosystems
  'openai tool',
  'gpt action',
  'chatgpt plugin',
  'claude tool',
  'mcp plugin',
  
  // Framework ecosystems  
  'langchain tool',
  'autogen tool',
  'crewai tool',
  'llamaindex tool',
  
  // Functional skills
  'browser tool',
  'search tool',
  'scraper tool',
  'github tool', 
  'pdf tool',
  'database tool',
  'sql tool',
  
  // Legacy keywords
  'model-context-protocol',
  'copilot-extension',
  'claude-mcp',
];

// Layer 2: Topic-based search
export const TOPIC_QUERIES = [
  'topic:ai-agent',
  'topic:llm',
  'topic:ai-tools', 
  'topic:automation',
  'topic:plugin',
  'topic:agent-framework',
  'topic:ai-agent-tool',
  'topic:mcp',
  'topic:claude',
  'topic:openai',
  'topic:chatgpt',
];

// Layer 3: Filename-based code search (HIGH VALUE)
export const FILENAME_QUERIES = [
  'filename:SKILL.md',
  'filename:skill.yaml',
  'filename:manifest.json',
  'filename:tool.json', 
  'filename:skill.json',
  'filename:mcp.json',
  'filename:claude.json',
];

/** Minimum stars required to be indexed (removed restriction) */
export const MIN_STARS = 0;

/** Max pages per query to maximize discovery (increased from 10) */
export const MAX_PAGES = 20;

/** Results per page (max allowed by GitHub) */
export const PER_PAGE = 100;

/** Delay between API calls in ms (reduced with rate limit management) */
export const SEARCH_DELAY_MS = 1000;

/** Concurrency limit for parallel API calls */
export const CONCURRENCY_LIMIT = 5;

/** Rate limit thresholds */
export const RATE_LIMIT_THRESHOLD = 10;
export const RATE_LIMIT_PAUSE_MS = 60000;

/** Category assignment rules based on repo topics / name / description */
export interface CategoryRule {
  keywords: string[];
  category: string;
}

export const CATEGORY_RULES: CategoryRule[] = [
  // BNBChain (keep dedicated)
  { keywords: ['bnb-chain', 'bnbchain', 'binance', 'bsc-', '-bsc', 'pancakeswap', 'trustwallet'], category: 'BNBChain Skills' },
  // Blockchain & Web3
  { keywords: ['defi', 'finance', 'trading', 'swap', 'dex', 'blockchain', 'web3', 'ethereum', 'solana', 'crypto', 'nft', 'token'], category: 'Blockchain' },
  // Developer Tools
  { keywords: ['mcp', 'model-context-protocol', 'ide', 'editor', 'vscode', 'copilot', 'code-gen', 'codegen', 'lint', 'formatter'], category: 'Developer Tools' },
  // Data & Analytics
  { keywords: ['data', 'analytics', 'database', 'sql', 'visualization', 'dashboard', 'reporting', 'bi', 'etl', 'scraping', 'crawler'], category: 'Data & Analytics' },
  // Productivity & Automation
  { keywords: ['automation', 'workflow', 'productivity', 'notion', 'calendar', 'email', 'slack', 'task', 'schedule', 'zapier'], category: 'Productivity' },
  // Security
  { keywords: ['security', 'audit', 'vulnerability', 'pentest', 'auth', 'encryption', 'firewall', 'scan', 'agentguard'], category: 'Security' },
  // DevOps & Infrastructure
  { keywords: ['devops', 'docker', 'kubernetes', 'ci-cd', 'deploy', 'infrastructure', 'monitoring', 'aws', 'cloud', 'terraform'], category: 'DevOps' },
  // Design & Media
  { keywords: ['design', 'image', 'video', 'audio', 'media', 'figma', 'ui', 'ux', 'photo', 'canvas', 'svg'], category: 'Design & Media' },
  // Communication
  { keywords: ['chat', 'message', 'discord', 'telegram', 'twitter', 'social', 'notification', 'sms', 'whatsapp'], category: 'Communication' },
  // Search & Knowledge
  { keywords: ['search', 'knowledge', 'wiki', 'documentation', 'rag', 'retrieval', 'embedding', 'memory', 'research'], category: 'Search & Knowledge' },
  // Content & Writing
  { keywords: ['writing', 'content', 'blog', 'markdown', 'text', 'translate', 'summary', 'pdf', 'document'], category: 'Content & Writing' },
];

export const DEFAULT_CATEGORY = 'Other';
