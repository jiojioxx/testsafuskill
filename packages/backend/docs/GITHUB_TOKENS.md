# GitHub Token Configuration

This document explains the GitHub token separation strategy for different operations.

## Token Types

### 1. `GITHUB_USER_TOKEN` - User Upload Operations
**Used for**: User-initiated GitHub URL uploads via the web interface
**Files**: 
- `src/modules/skills/skills.service.ts`
- `createFromGithub()` method

**Purpose**: 
- Handles user requests to upload skills from GitHub URLs
- Triggered by user actions in the frontend
- Should be a dedicated token to avoid rate limit conflicts

**Usage**:
```typescript
// User uploads SKILL.md from GitHub URL
const token = process.env.GITHUB_USER_TOKEN; // Dedicated token for user uploads
```

### 2. `GITHUB_TOKEN` - Automated Discovery Operations  
**Used for**: Automated skill discovery and bulk operations
**Files**:
- `src/modules/github-sync/skill-discovery.service.ts`
- `src/modules/github-sync/bulk-discovery.service.ts` 
- `src/modules/github-sync/auto-discovery.service.ts`
- `src/modules/github-sync/github-sync.service.ts`

**Purpose**:
- Automated skill discovery (runs every 12 hours via cron)
- Bulk repository indexing  
- Background synchronization tasks
- Should be separate from user operations to avoid interference

**Usage**:
```typescript
// Automated discovery background processes
const token = process.env.GITHUB_TOKEN; // For automated discovery - separate from user uploads
```

### 3. Multi-Token Pool (Optional Enhancement)
**Used for**: High-throughput bulk operations
**Files**:
- `src/modules/github-sync/bulk-discovery.service.ts`

**Purpose**:
- Multiple discovery tokens for rate limit management
- Used in bulk operations that need higher API quotas

**Configuration**:
```env
GITHUB_TOKEN_2=ghp_xxx...
GITHUB_TOKEN_3=github_pat_xxx...
GITHUB_TOKEN_4=github_pat_xxx...
GITHUB_TOKEN_5=github_pat_xxx...
```

## Environment Configuration

### Required Environment Variables

```env
# User upload token (for user-initiated GitHub URL uploads)
GITHUB_USER_TOKEN=ghp_your_user_upload_token_here

# Discovery token (for automated background discovery)
GITHUB_TOKEN=ghp_your_discovery_token_here

# Optional: Additional discovery tokens for rate limit management
GITHUB_TOKEN_2=ghp_additional_token_2
GITHUB_TOKEN_3=ghp_additional_token_3
GITHUB_TOKEN_4=ghp_additional_token_4
GITHUB_TOKEN_5=ghp_additional_token_5
```

### Token Permissions

Both tokens should have the following GitHub permissions:
- `public_repo` - Access to public repositories
- `read:org` - Read organization data (for org:openclaw searches)

## Why Separate Tokens?

1. **Rate Limit Isolation**: User uploads won't interfere with automated discovery
2. **Different Usage Patterns**: 
   - User uploads: Sporadic, immediate response needed
   - Discovery: Bulk operations, can be delayed
3. **Monitoring**: Easier to track usage and debug issues
4. **Scalability**: Can optimize each token pool independently

## Token Usage Monitoring

Monitor rate limits independently:
- User token: Monitor for 403 errors during uploads
- Discovery tokens: Monitor bulk operation performance
- Log token usage for debugging

## Migration Notes

- `skills.service.ts` now uses `GITHUB_USER_TOKEN`
- All discovery services continue using `GITHUB_TOKEN`
- Both tokens are required for full functionality
- Backward compatibility: If `GITHUB_USER_TOKEN` is not set, user uploads will fail gracefully