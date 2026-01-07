# Create GitHub Issues

Create GitHub issues for this repository based on a spec, plan, or prompt provided by the user.

## Instructions

When the user invokes `/create-issues`, you should:

1. **Ask for input** if not provided:

   - A spec file path (e.g., `.taskmaster/docs/prd.txt`)
   - A plan or feature description
   - Or a simple prompt describing what issues to create

2. **Parse the input** to extract actionable issues:

   - Look for tasks, features, bugs, or user stories
   - Extract titles and descriptions
   - Identify appropriate labels (bug, feature, enhancement, etc.)

3. **Generate GitHub CLI commands** using `gh issue create`:

   ```bash
   gh issue create --title "<title>" --body "<body>" --label "<labels>"
   ```

4. **Best practices for issue creation**:

   - Use descriptive titles (action verb + subject)
   - Include acceptance criteria in the body
   - Add appropriate labels: `bug`, `enhancement`, `feature`, `documentation`, `task`
   - Use `--assignee "@me"` if the user wants self-assignment
   - Reference related issues or PRs when applicable

5. **Present the issues** for user review before creating:
   - Show a summary of all issues to be created
   - Ask for confirmation before running the commands
   - Offer `--dry-run` preview option

## Example Usage

**From a prompt:**

```
/create-issues Add user authentication with OAuth support
```

**From a spec file:**

```
/create-issues Parse .taskmaster/docs/prd.txt and create issues for each task
```

**With options:**

```
/create-issues Create issues for the dashboard feature --labels="frontend,feature" --assignee="@me"
```

## Issue Format Template

For each issue, generate:

```markdown
## Description

[Clear description of what needs to be done]

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Notes

[Any relevant technical details or constraints]

## Related

- Related to #[issue-number] (if applicable)
```

## GitHub CLI Commands Reference

```bash
# Create single issue
gh issue create --title "Title" --body "Body" --label "label1,label2" --assignee "@me"

# Create with milestone
gh issue create --title "Title" --body "Body" --milestone "v1.0"

# Create from template
gh issue create --template "Bug Report"

# View repo issues
gh issue list

# Check authentication
gh auth status
```

## Requirements

- GitHub CLI (`gh`) must be installed and authenticated
- Run `gh auth login` if not authenticated
- Must be in a git repository linked to GitHub
