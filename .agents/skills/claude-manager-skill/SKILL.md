```markdown
# claude-manager-skill Development Patterns

> Auto-generated skill from repository analysis

## Overview
This repository provides a skill for managing and extending Claude's capabilities, focusing on modular TypeScript code without a specific framework. The codebase emphasizes clear documentation, consistent coding conventions, and a workflow-driven approach to feature development and testing.

## Coding Conventions

- **File Naming:**  
  Use kebab-case for all file and directory names.
  ```
  // Good
  hooks/use-feature.ts
  skills/new-skill/skill-handler.ts

  // Bad
  hooks/useFeature.ts
  skills/NewSkill/SkillHandler.ts
  ```

- **Import Style:**  
  Use absolute imports for modules.
  ```typescript
  // Good
  import { useFeature } from 'hooks/use-feature';

  // Bad
  import { useFeature } from '../hooks/use-feature';
  ```

- **Export Style:**  
  Use named exports.
  ```typescript
  // Good
  export const useFeature = () => { /* ... */ };

  // Bad
  export default function useFeature() { /* ... */ }
  ```

- **Documentation:**  
  Place documentation in `docs/`, `README.md`, or `skills/<skill-name>/SKILL.md`.

## Workflows

### Feature Development with Tests and Docs
**Trigger:** When adding a new skill, splitting an existing skill, or introducing a major feature that requires documentation and tests.  
**Command:** `/new-skill`

1. Create or update documentation/spec in `docs/` or `README.md`.
2. Add or modify `SKILL.md` and related files in `skills/<skill-name>/`.
3. Add or update implementation files (e.g., in `hooks/`).
4. Add or update relevant tests in `tests/`.
5. Update references or supporting markdown files as needed.

**Example:**
```bash
# 1. Write or update docs
vim docs/new-feature.md

# 2. Create skill documentation
vim skills/my-new-skill/SKILL.md

# 3. Implement the feature
vim hooks/use-my-new-skill.ts

# 4. Add tests
vim tests/use-my-new-skill.test.ts

# 5. Update README if necessary
vim README.md
```

### Test Update After Implementation Change
**Trigger:** When implementation details change or review feedback requires test updates.  
**Command:** `/update-tests`

1. Modify the implementation or hook file as needed.
2. Update or tighten the corresponding test(s) in `tests/`.

**Example:**
```bash
# 1. Change implementation
vim hooks/use-existing-feature.ts

# 2. Update tests
vim tests/use-existing-feature.test.ts
```

## Testing Patterns

- **Test Files:**  
  Test files use the `.test.ts` extension and are placed in the `tests/` directory.
  ```
  tests/use-feature.test.ts
  ```
- **Framework:**  
  Testing framework is not specified; use standard TypeScript test patterns.
- **Test Example:**
  ```typescript
  import { useFeature } from 'hooks/use-feature';

  describe('useFeature', () => {
    it('should perform expected behavior', () => {
      // Arrange
      // Act
      // Assert
    });
  });
  ```

## Commands

| Command        | Purpose                                                        |
|----------------|----------------------------------------------------------------|
| /new-skill     | Start a new skill or major feature with docs and tests         |
| /update-tests  | Update or tighten tests after implementation changes           |
```
