# Cursor Rules Summary

This document provides an overview of all workspace rules and helps identify duplicates.

## Workspace Rule Files

### 1. `.cursor/rules/cursor_rules.mdc`
- **Purpose**: Guidelines for creating and maintaining Cursor rules
- **Scope**: `.cursor/rules/*.mdc`
- **Always Applied**: Yes
- **Content**: Rule structure, formatting, file references, code examples, best practices

### 2. `.cursor/rules/self_improve.mdc`
- **Purpose**: Guidelines for continuously improving Cursor rules based on emerging patterns
- **Scope**: `**/*` (all files)
- **Always Applied**: Yes
- **Content**: 
  - Rule Improvement Triggers
  - Analysis Process
  - Rule Updates (when to add/modify)
  - Pattern Recognition examples
  - Rule Quality Checks
  - Continuous Improvement
  - Rule Deprecation
  - Documentation Updates

### 3. `.cursor/rules/taskmaster/dev_workflow.mdc`
- **Purpose**: Guide for using Taskmaster to manage task-driven development workflows
- **Scope**: `**/*` (all files)
- **Always Applied**: Yes
- **Content**: Taskmaster workflow, task management, PRD-driven development, tag management

### 4. `.cursor/rules/taskmaster/taskmaster.mdc`
- **Purpose**: Comprehensive reference for Taskmaster MCP tools and CLI commands
- **Scope**: `**/*` (all files)
- **Always Applied**: Yes
- **Content**: Complete command reference for all Taskmaster tools and CLI commands

### 5. `.cursor/rules/shadcn-components.mdc`
- **Purpose**: Guidelines for using shadcn components
- **Scope**: `*.tsx`
- **Always Applied**: No
- **Content**: Instructions to use shadcn components when creating new UI components

## Duplication Issues Found

### ❌ DUPLICATE: Rule Improvement Triggers

**Location 1**: `.cursor/rules/self_improve.mdc` (workspace rule)
- Status: ✅ Active and always applied
- Contains: Complete rule improvement guidelines
- File: `.cursor/rules/self_improve.mdc`

**Location 2**: User Rules (manually added)
- Status: ❌ Redundant - should be removed
- Reason: Already covered by `self_improve.mdc` which has `alwaysApply: true`
- Contains: Identical content about rule improvement triggers, analysis process, rule updates, etc.

**Action Required**: Remove the duplicate "Rule Improvement Triggers" section from Cursor User Rules settings.

## How to Remove Duplicate from User Rules

### Step-by-Step Instructions:

1. **Open Cursor Settings**
   - Press `Cmd+,` (Mac) or `Ctrl+,` (Windows/Linux)
   - Or go to `Cursor` → `Settings` → `Rules`

2. **Locate the Duplicate Rule**
   - Look for a rule block that starts with:
     ```markdown
     ---
     description: Guidelines for continuously improving Cursor rules based on emerging code patterns and best practices.
     globs: **/*
     alwaysApply: true
     ---
     ```
   - It contains sections like:
     - "Rule Improvement Triggers"
     - "Analysis Process"
     - "Rule Updates"
     - "Example Pattern Recognition"
     - "Rule Quality Checks"
     - "Continuous Improvement"
     - "Rule Deprecation"
     - "Documentation Updates"

3. **Delete the Entire Rule Block**
   - Select and delete the entire rule from the first `---` to the last line
   - The same content is already active via `.cursor/rules/self_improve.mdc`

4. **Verify**
   - After removal, the rule improvement guidelines will still be active
   - They're automatically loaded from `.cursor/rules/self_improve.mdc`

## Rule Coverage

All necessary rules are covered by workspace rules:
- ✅ Rule structure and formatting → `cursor_rules.mdc`
- ✅ Rule improvement guidelines → `self_improve.mdc`
- ✅ Taskmaster workflow → `dev_workflow.mdc`
- ✅ Taskmaster commands → `taskmaster.mdc`
- ✅ Shadcn components → `shadcn-components.mdc`

No additional user rules are needed for these topics.

