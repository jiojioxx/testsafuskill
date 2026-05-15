import { Injectable } from '@nestjs/common';

/**
 * Detects supported platforms for a skill based on language, topics, description, and name.
 * Returns a JSON string array of detected platforms.
 */
@Injectable()
export class PlatformDetectorService {
  private readonly platformRules: Array<{ platform: string; keywords: string[] }> = [
    { platform: 'python', keywords: ['python', 'pip', 'pypi', 'django', 'flask', 'fastapi'] },
    { platform: 'node', keywords: ['node', 'npm', 'typescript', 'javascript', 'deno', 'bun'] },
    { platform: 'go', keywords: ['golang', 'go'] },
    { platform: 'rust', keywords: ['rust', 'cargo', 'crate'] },
    { platform: 'docker', keywords: ['docker', 'container', 'dockerfile'] },
    { platform: 'mcp', keywords: ['mcp', 'model-context-protocol', 'mcp-server'] },
    { platform: 'claude', keywords: ['claude', 'anthropic', 'claude-code', 'claude-skill'] },
    { platform: 'openai', keywords: ['openai', 'gpt', 'chatgpt', 'gpt-action'] },
    { platform: 'langchain', keywords: ['langchain', 'langgraph'] },
    { platform: 'vscode', keywords: ['vscode', 'vs-code', 'visual-studio-code', 'extension'] },
    { platform: 'cli', keywords: ['cli', 'command-line', 'terminal'] },
    { platform: 'aws', keywords: ['aws', 'amazon', 'lambda', 's3'] },
    { platform: 'browser', keywords: ['browser', 'chrome', 'firefox', 'web-extension'] },
  ];

  private readonly languageMap: Record<string, string> = {
    Python: 'python',
    TypeScript: 'node',
    JavaScript: 'node',
    Go: 'go',
    Rust: 'rust',
    Ruby: 'ruby',
    Java: 'java',
    'C#': 'dotnet',
    Shell: 'cli',
  };

  detect(skill: {
    name?: string;
    description?: string;
    language?: string;
    topics?: string;
  }): string[] {
    const platforms = new Set<string>();

    // 1. Language mapping
    if (skill.language && this.languageMap[skill.language]) {
      platforms.add(this.languageMap[skill.language]);
    }

    // 2. Keyword matching across name, description, topics
    const text = [
      skill.name || '',
      skill.description || '',
      skill.topics || '',
    ].join(' ').toLowerCase();

    for (const rule of this.platformRules) {
      if (rule.keywords.some((kw) => text.includes(kw))) {
        platforms.add(rule.platform);
      }
    }

    return Array.from(platforms).sort();
  }
}
