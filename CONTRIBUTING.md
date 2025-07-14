# Contributing to Domapus

We welcome contributions to Domapus! This document outlines how to contribute to the project effectively.

## 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Domapus.git
   cd Domapus
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Start the development server**:
   ```bash
   npm run dev
   ```
5. **Create a new branch** for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 🛠️ Development Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- Git

### Environment Setup

The project uses Vite for development with hot module replacement. No additional environment variables are required for basic development.

### Project Structure

```
src/
├── components/
│   ├── dashboard/          # Main dashboard components
│   │   ├── map/           # Map-related utilities
│   │   ├── MapLibreMap.tsx # Main map component
│   │   └── ...
│   └── ui/                # Reusable UI components (shadcn/ui)
├── hooks/                 # Custom React hooks
├── workers/               # Web workers for performance
├── utils/                 # Utility functions
└── pages/                 # Page components
```

## 📝 Coding Standards

### TypeScript

- Use TypeScript for all new code
- Avoid `any` types when possible
- Provide proper type definitions for props and state
- Use interfaces for object types

### React

- Use functional components with hooks
- Follow React best practices for performance
- Use proper dependency arrays in useEffect
- Implement proper cleanup in useEffect when needed

### Styling

- Use Tailwind CSS for styling
- Follow the existing design system patterns
- Use CSS variables for theme colors
- Ensure responsive design for all components

### Performance

- Use web workers for heavy data processing
- Implement proper throttling for user interactions
- Use requestAnimationFrame for smooth animations
- Minimize re-renders with proper memoization

## 🎯 Types of Contributions

### 🐛 Bug Reports

When reporting bugs, please include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Browser and device information
- Screenshots or screen recordings if applicable

### ✨ Feature Requests

For new features:

- Describe the feature and its benefits
- Provide use cases
- Consider performance implications
- Suggest implementation approach if possible

### 🔧 Code Contributions

#### Before You Start

- Check existing issues to avoid duplicates
- Discuss major changes in an issue first
- Ensure your changes align with project goals

#### Making Changes

1. **Write clean, readable code**
2. **Add tests** for new functionality (when applicable)
3. **Update documentation** as needed
4. **Follow existing patterns** and conventions
5. **Test thoroughly** across different browsers

#### Commit Guidelines

- Use clear, descriptive commit messages
- Follow conventional commit format:

  ```
  type(scope): description

  Examples:
  feat(map): add zoom controls
  fix(export): resolve PDF generation issue
  docs(readme): update installation instructions
  ```

## 🧪 Testing

### Running Tests

```bash
npm run test
```

### Building

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## 📦 Pull Request Process

1. **Ensure your code builds** without errors
2. **Run linting** and fix any issues
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Create a descriptive PR title** and description
6. **Reference related issues** in your PR description

### PR Description Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Tested locally
- [ ] Added/updated tests
- [ ] Tested on multiple browsers

## Screenshots (if applicable)

Add screenshots to help explain your changes
```

## 🎨 Design Guidelines

### Color Scheme

- Follow the existing dashboard color palette
- Use semantic color names (primary, secondary, accent)
- Ensure proper contrast for accessibility

### Typography

- Use the established font hierarchy
- Maintain consistent spacing
- Consider readability at different zoom levels

### User Experience

- Prioritize performance and responsiveness
- Provide clear feedback for user actions
- Follow accessibility best practices
- Test on both desktop and mobile devices

## 🚀 Performance Guidelines

### Map Performance

- Use MapLibre GL JS for optimal performance
- Implement proper layer management
- Use web workers for data processing
- Throttle user interactions appropriately

### Data Loading

- Implement proper loading states
- Use compression for large datasets
- Cache processed data when appropriate
- Handle errors gracefully

### Memory Management

- Clean up event listeners and timeouts
- Properly dispose of map instances
- Avoid memory leaks in React components

## 🐛 Debugging

### Common Issues

1. **Map not loading**: Check console for errors, verify data URLs
2. **Performance issues**: Use browser dev tools to profile
3. **Build failures**: Check TypeScript errors and dependencies

### Development Tools

- React Developer Tools
- Browser dev tools for performance profiling
- Network tab for data loading issues
- Console for error tracking

## 📚 Resources

### Technologies Used

- **React 18** - UI framework
- **TypeScript** - Type safety
- **MapLibre GL JS** - Map rendering
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **shadcn/ui** - Component library

### Learning Resources

- [React Documentation](https://react.dev/)
- [MapLibre GL JS Documentation](https://maplibre.org/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Community

### Getting Help

- Check existing issues and discussions
- Ask questions in GitHub Discussions
- Join the conversation in pull requests

### Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Focus on the code, not the person

## 📄 License

By contributing to Domapus, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Domapus! Your contributions help make housing data more accessible to everyone. 🏠✨