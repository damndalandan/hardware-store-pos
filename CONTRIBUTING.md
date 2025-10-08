# Contributing to Hardware Store POS System

First off, thank you for considering contributing to the Hardware Store POS System! It's people like you that make this project better.

## Code of Conduct

This project and everyone participating in it is governed by our commitment to creating a welcoming and respectful environment. Please be kind and courteous.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* Use a clear and descriptive title
* Describe the exact steps which reproduce the problem
* Provide specific examples to demonstrate the steps
* Describe the behavior you observed after following the steps
* Explain which behavior you expected to see instead and why
* Include screenshots if possible

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* Use a clear and descriptive title
* Provide a step-by-step description of the suggested enhancement
* Provide specific examples to demonstrate the steps
* Describe the current behavior and explain which behavior you expected to see instead
* Explain why this enhancement would be useful

### Pull Requests

* Fill in the required template
* Do not include issue numbers in the PR title
* Follow the TypeScript styleguide
* Include thoughtfully-worded, well-structured tests
* Document new code
* End all files with a newline

## Development Process

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/hardware-store-pos.git

# Install dependencies
cd hardware-store-pos
npm install
cd backend && npm install
cd ../frontend && npm install

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Initialize database
cd backend
npm run migrate

# Run development servers
npm run dev
```

## Styleguide

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

### TypeScript Styleguide

* Use 2 spaces for indentation
* Prefer `const` over `let`
* Use meaningful variable names
* Add JSDoc comments for functions
* Use TypeScript types, avoid `any` when possible

### Testing

* Write tests for new features
* Ensure all tests pass before submitting PR
* Aim for high test coverage

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
