-- ============================================
-- 置顶功能完整迁移脚本（使用 source_repo + source_path）
-- ============================================

-- 1. 创建 gh_featured_skills 表
CREATE TABLE IF NOT EXISTS `gh_featured_skills` (
  `id` varchar(36) NOT NULL,
  `source_repo` varchar(255) NOT NULL,
  `source_path` varchar(500) NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_gh_featured_skills_repo_path` (`source_repo`, `source_path`),
  KEY `idx_gh_featured_skills_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 插入置顶的skills（直接使用 source_repo 和 source_path）
INSERT INTO gh_featured_skills (id, source_repo, source_path, sort_order, created_at) VALUES
(UUID(), 'GoPlusSecurity/agentguard', 'skills/agentguard', 0, NOW()),
(UUID(), 'bitget-wallet-ai-lab/bitget-wallet-skill', 'SKILL.md', 1, NOW()),
(UUID(), 'panewslab/skills', 'skills/panews/SKILL.md', 2, NOW());

-- 3. 验证插入结果
SELECT 
  fs.id, 
  fs.source_repo, 
  fs.source_path, 
  fs.sort_order,
  s.id as skill_id,
  s.name as skill_name,
  s.stars,
  s.download_count
FROM gh_featured_skills fs
LEFT JOIN gh_skills s ON fs.source_repo = s.source_repo AND fs.source_path = s.source_path
ORDER BY fs.sort_order;

-- ============================================
-- 管理操作示例
-- ============================================

-- 添加新的置顶skill
-- INSERT INTO gh_featured_skills (id, source_repo, source_path, sort_order) 
-- VALUES (UUID(), 'owner/repo', 'path/to/SKILL.md', 3);

-- 删除置顶skill
-- DELETE FROM gh_featured_skills WHERE source_repo = 'owner/repo' AND source_path = 'path/to/SKILL.md';

-- 调整置顶顺序
-- UPDATE gh_featured_skills SET sort_order = 0 WHERE source_repo = 'GoPlusSecurity/agentguard';
-- UPDATE gh_featured_skills SET sort_order = 1 WHERE source_repo = 'bitget-wallet-ai-lab/bitget-wallet-skill';

-- 查看所有置顶配置
-- SELECT * FROM gh_featured_skills ORDER BY sort_order;

-- ============================================
-- 优势说明
-- ============================================
-- 1. 跨环境一致：测试环境和生产环境使用相同的 source_repo + source_path
-- 2. 不依赖skill_id：即使skill被删除重建，只要repo和path相同就能匹配
-- 3. 易于管理：直接通过repo和path识别，不需要查询UUID
-- 4. 自动适配：如果skill不存在或被删除，自动跳过，不会报错
