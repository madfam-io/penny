# Changesets

This directory contains changeset files that track changes to packages.

## Creating a changeset

When you make changes that should be released, run:

```bash
npm run changeset
```

This will prompt you to:
1. Select which packages have changed
2. Select the type of change (major, minor, patch)
3. Write a summary of the changes

## Releasing

The release process is automated via GitHub Actions. When changesets are merged to main:

1. A "Version Packages" PR is automatically created
2. Merging this PR will:
   - Update package versions
   - Update changelogs
   - Publish packages (if configured)
   - Create GitHub releases