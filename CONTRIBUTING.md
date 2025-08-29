# Contributing to PENNY

Thank you for your interest in contributing to PENNY! This document provides guidelines and
instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please read
[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) before contributing.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/penny.git
   cd penny
   ```
3. Set up development environment:
   ```bash
   npm install
   make setup-local
   ```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feat/amazing-feature
# or
git checkout -b fix/issue-123
```

### 2. Make Changes

- Write clean, documented code
- Follow existing patterns
- Add tests for new features
- Update documentation

### 3. Commit Changes

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat(api): add new endpoint for tool execution"
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style
- `refactor`: Code refactoring
- `perf`: Performance
- `test`: Tests
- `build`: Build system
- `ci`: CI/CD
- `chore`: Maintenance
- `security`: Security fix

### 4. Test Your Changes

```bash
# Run tests
npm run test

# Run linting
npm run lint

# Run type checking
npm run typecheck
```

### 5. Create a Changeset

```bash
npm run changeset
```

Follow the prompts to describe your changes.

### 6. Submit Pull Request

1. Push your branch
2. Open a PR against `develop`
3. Fill out the PR template
4. Wait for review

## Pull Request Guidelines

### PR Title

Follow conventional commits format:

- `feat(scope): description`
- `fix(scope): description`

### PR Description

- Describe what changed and why
- Link related issues
- Include screenshots for UI changes
- List breaking changes

### PR Checklist

- [ ] Tests pass
- [ ] Documentation updated
- [ ] Changeset added
- [ ] No console.logs
- [ ] No commented code
- [ ] Security considered

## Code Style

### TypeScript

- Use strict mode
- Prefer interfaces over types
- Document complex functions
- Use meaningful variable names

### React

- Functional components only
- Custom hooks for logic
- Proper error boundaries
- Accessibility first

### General

- No magic numbers
- DRY principle
- SOLID principles
- Early returns

## Testing

### Unit Tests

```typescript
describe('calculateTotal', () => {
  it('should calculate sum correctly', () => {
    expect(calculateTotal([1, 2, 3])).toBe(6);
  });
});
```

### Integration Tests

Test complete flows with mocked dependencies.

### E2E Tests

Test critical user journeys.

## Documentation

- Update README if needed
- Add JSDoc comments
- Update API docs
- Include examples

## Security

- Never commit secrets
- Validate all inputs
- Sanitize outputs
- Review dependencies
- Report vulnerabilities

## Questions?

- GitHub Issues for bugs/features
- Discussions for questions
- Discord for real-time help

## Recognition

Contributors are recognized in:

- CONTRIBUTORS.md
- Release notes
- Project website

Thank you for contributing! 🎉
