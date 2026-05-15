export interface RepoConfig {
  owner: string;
  repo: string;
  category: string;
  /** flat = skills/<name>/, nested = skills/<provider>/<name>/ */
  structure: 'flat' | 'nested';
}

export interface SearchConfig {
  keywords: string[];
  category: string;
  /** Rate limit per hour for search API */
  rateLimit: number;
}

export const GITHUB_REPOS: RepoConfig[] = [
  {
    owner: 'bnb-chain',
    repo: 'bnbchain-skills',
    category: 'BNBChain Skills',
    structure: 'flat',
  },
  {
    owner: 'binance',
    repo: 'binance-skills-hub',
    category: 'BNBChain Skills',
    structure: 'nested',
  },
];

/** 自动发现配置 - 基于 agent-skills-hub 的搜索策略 */
export const SEARCH_CONFIGS: SearchConfig[] = [
  {
    keywords: ['mcp-server', 'language:python', 'language:typescript'],
    category: 'Community Skills',
    rateLimit: 30,
  },
  {
    keywords: ['claude-skill', 'language:python', 'language:javascript'],
    category: 'Community Skills', 
    rateLimit: 30,
  },
  {
    keywords: ['agent-tool', 'language:python'],
    category: 'Community Skills',
    rateLimit: 30,
  },
  {
    keywords: ['ai-skill', 'llm-plugin','evm-skill'],
    category: 'Community Skills',
    rateLimit: 30,
  },
];

export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
export const AUTO_DISCOVERY_SOURCE = 'auto-discovery';
