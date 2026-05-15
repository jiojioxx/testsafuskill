# 缓存问题解决方案

## 问题描述
当直接在数据库中修改 `gh_featured_skills` 表时，由于缓存机制（5分钟TTL），前端页面不会立即看到变化。

## 解决方案

### 1. 自动清除缓存（推荐）
通过Admin API修改置顶配置时，会自动清除缓存：

```bash
# 添加置顶 - 自动清除缓存
curl -X POST http://localhost:3000/admin/featured \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceRepo": "owner/repo",
    "sourcePath": "path/to/SKILL.md",
    "sortOrder": 0
  }'

# 删除置顶 - 自动清除缓存
curl -X DELETE http://localhost:3000/admin/featured/{id} \
  -H "Authorization: Bearer YOUR_TOKEN"

# 更新排序 - 自动清除缓存
curl -X PUT http://localhost:3000/admin/featured/{id} \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sortOrder": 1}'
```

### 2. 手动清除缓存
如果直接在数据库中修改了数据，可以调用清除缓存API：

```bash
curl -X POST http://localhost:3000/admin/cache/clear \
  -H "Authorization: Bearer YOUR_TOKEN"
```

响应：
```json
{
  "success": true,
  "message": "Skills cache cleared"
}
```

### 3. 等待缓存过期
如果不想手动清除，等待5分钟后缓存会自动过期。

## 缓存机制说明

### 缓存键格式
```
skills:{page}:{limit}:{category}:{sortBy}:{search}
```

例如：
- `skills:1:20:all:downloads:no-search` - 第1页，按下载量排序
- `skills:1:20:all:recent:no-search` - 第1页，按最近更新排序

### 缓存时间
- **TTL**: 5分钟（300秒）
- **自动清理**: 每次设置缓存时会清理过期条目

### 何时清除缓存
以下操作会自动清除所有skills相关缓存：
1. 创建新skill
2. 删除skill
3. 下载skill（更新下载量）
4. 添加置顶skill
5. 删除置顶skill
6. 更新置顶顺序
7. 手动调用清除缓存API

## 测试步骤

### 场景1: 通过API修改（自动清除缓存）
1. 调用 `POST /admin/featured` 添加置顶
2. 立即刷新前端页面
3. ✅ 应该立即看到新的置顶顺序

### 场景2: 直接修改数据库（需要手动清除）
1. 在数据库中执行：
   ```sql
   UPDATE gh_featured_skills SET sort_order = 2 WHERE id = 'xxx';
   ```
2. 刷新前端页面
3. ❌ 仍然显示旧的顺序（缓存未清除）
4. 调用 `POST /admin/cache/clear`
5. 再次刷新前端页面
6. ✅ 显示新的顺序

### 场景3: 等待缓存过期
1. 在数据库中修改数据
2. 等待5分钟
3. 刷新前端页面
4. ✅ 显示新的顺序

## 代码实现

### AdminService
```typescript
async addFeatured(...) {
  const result = await this.prisma.featuredSkill.create(...);
  this.skillsService.clearSkillsCache(); // 清除缓存
  return result;
}

clearSkillsCache(): void {
  this.skillsService.clearSkillsCache();
}
```

### AdminController
```typescript
@Post('cache/clear')
@UseGuards(JwtAuthGuard)
async clearCache(@CurrentUser() user: any) {
  this.adminService.assertAdmin(user.id);
  this.adminService.clearSkillsCache();
  return { success: true, message: 'Skills cache cleared' };
}
```

### SkillsService
```typescript
public clearSkillsCache(): void {
  this.clearRelatedCache();
}

private clearRelatedCache(): void {
  for (const key of this.cache.keys()) {
    if (key.startsWith('skills:')) {
      this.cache.delete(key);
    }
  }
}
```

## 建议

1. **优先使用Admin API** - 自动处理缓存，避免手动操作
2. **直接修改数据库后记得清除缓存** - 调用 `POST /admin/cache/clear`
3. **监控缓存命中率** - 可以添加日志查看缓存效果
4. **考虑使用Redis** - 如果需要分布式缓存或更复杂的缓存策略
