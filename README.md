# <img src="https://jasperc2024.github.io/Domapus//android-chrome-512x512.png" width="40">  Domapus
# Interactive U.S. Housing Market Dashboard

[![Live Demo](https://img.shields.io/badge/Live-Demo-blue)](https://jasperc2024.github.io/Domapus/)
[![GitHub](https://img.shields.io/badge/GitHub-Repo-black)](https://github.com/Jasperc2024/Domapus)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

Domapus is a high-performance, interactive dashboard for exploring U.S. housing market data at the ZIP code level. Built with React, TypeScript, and MapLibre GL JS, it visualizes real estate trends across 24,000+ ZIP codes using data sourced from Redfin.

![Domapus Preview](https://jasperc2024.github.io/Domapus/preview.png)

## ✨ Features

### 🗺️ Interactive Map Visualization

- **Real-time ZIP code data** for 24,000+ locations across the United States
- **Multiple housing metrics** including median sale price, inventory, days on market, and more
- **Smooth zoom and pan** with hardware-accelerated MapLibre GL JS rendering
- **Hover tooltips** displaying detailed information for each ZIP code
- **Search functionality** to quickly locate specific ZIP codes

### 📊 Advanced Analytics

- **Dynamic color scaling** based on data distribution
- **Quintile-based legend** showing actual data ranges
- **Regional filtering** by state and metropolitan area
- **Real-time metric switching** without data reloading

### 📸 Professional Export System

- **High-quality map exports** in PNG and PDF formats
- **Dynamic legend scaling** based on selected data
- **Alaska and Hawaii repositioning** for professional national reports
- **Customizable export options** including title, legend, and attribution
- **Professional branding** with Domapus logo integration

### ⚡ Performance Optimizations

- **Web Workers** for data processing to improve responsiveness
- **Hardware-accelerated rendering** with MapLibre GL JS
- **Optimized INP (Interaction to Next Paint)** for better user experience
- **Resource preconnection** and prefetching for faster loading
- **Debounced interactions** to reduce main thread blocking
- **Efficient memory management** with proper cleanup

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn package manager

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Jasperc2024/Domapus.git
   cd Domapus
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:8080/Domapus/`

### Build for Production

```bash
npm run build
npm run preview
```

## 🏗️ Project Structure

```
src/
├── components/
│   ├── dashboard/           # Main dashboard components
│   │   ├── map/            # Map-related utilities and hooks
│   │   ├── MapLibreMap.tsx       # Main MapLibre GL JS component
│   │   ├── ExportRenderer.tsx    # Export functionality
│   │   ├── ExportLegend.tsx      # Dynamic legend component
│   │   └── ...
│   ├── ui/                 # Reusable UI components (shadcn/ui)
│   └── ...
├── hooks/                  # Custom React hooks
├── workers/                # Web workers for performance
├── utils/                  # Utility functions
└── pages/                  # Page components
```

## 📊 Available Metrics

- **Median Sale Price** - Middle price point of recently sold homes
- **Median List Price** - Middle asking price of homes for sale
- **Median Days on Market** - Average time homes spend listed before sale
- **Inventory** - Number of homes currently available for sale
- **New Listings** - Recently added properties to the market
- **Homes Sold** - Number of completed transactions
- **Sale to List Ratio** - Percentage of asking price achieved in sales
- **Homes Sold Above List** - Properties selling above asking price
- **Off Market in 2 Weeks** - Quick-selling properties

## 🎨 Technology Stack

### Frontend

- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe development with enhanced IDE support
- **Vite** - Fast build tool with hot module replacement
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality, accessible component library

### Mapping & Visualization

- **MapLibre GL JS** - Open-source vector map rendering with hardware acceleration
- **D3-Scale** - Data-driven color scaling and interpolation
- **Canvas Rendering** - High-performance GPU-accelerated rendering

### Data Processing

- **Pako** - Fast zlib implementation for data decompression
- **Web Workers** - Background processing for better performance
- **CSV Parsing** - Efficient client-side data processing

### Export & Analytics

- **html2canvas** - High-quality screenshot generation
- **jsPDF** - Client-side PDF generation
- **Custom Export Engine** - Professional map export system

## 📈 Performance Features

### Core Web Vitals Optimization

- **LCP (Largest Contentful Paint)** - Optimized with resource preloading
- **FID (First Input Delay)** - Web workers prevent main thread blocking
- **CLS (Cumulative Layout Shift)** - Fixed dimensions and skeleton loading
- **INP (Interaction to Next Paint)** - Hardware acceleration and efficient event handling

### Loading Optimizations

- Resource preconnection to CDN domains
- Critical asset prefetching
- Lazy loading for non-critical components
- Efficient data compression (gzip)

### Runtime Performance

- Hardware-accelerated map rendering with MapLibre GL JS
- Web worker data processing
- Efficient event handling with throttling
- Optimized memory management

## 🔧 Configuration

### Environment Variables

```bash
# Base URL for the application (set in vite.config.ts)
VITE_BASE_URL=/Domapus/

# Data source URLs (configured in components)
VITE_DATA_CDN=https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/
```

### Build Configuration

The project uses Vite with custom configuration for:

- Base path configuration for GitHub Pages
- Asset optimization and chunking
- TypeScript compilation with strict mode
- Tailwind CSS with custom design system

## 📱 Responsive Design

- **Mobile-first approach** with adaptive layouts
- **Touch-optimized interactions** for mobile devices
- **Responsive map controls** that adapt to screen size
- **Mobile-specific UI patterns** for better usability

## 🌐 Data Sources

- **Primary Data**: Redfin real estate market data
- **Geographic Data**: U.S. Census ZIP Code Tabulation Areas (ZCTA)
- **City/County Mapping**: Custom aggregated geographic data
- **Update Frequency**: Data refreshed monthly from Redfin sources

## 🔒 Privacy & Security

- **No user tracking** - All analytics are aggregated and anonymous
- **Client-side processing** - No personal data sent to servers
- **Secure data sources** - All external resources served over HTTPS
- **Content Security Policy** - Strict CSP headers for security

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with proper TypeScript types
4. Test your changes: `npm run build && npm run preview`
5. Run linting: `npm run lint`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to your branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Code Standards

- TypeScript strict mode enabled
- ESLint configuration with React and accessibility rules
- Prettier code formatting
- Component-based architecture with clear separation of concerns

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋 Support

- **Documentation**: Available in this README and inline code comments
- **Issues**: Report bugs and request features via [GitHub Issues](https://github.com/Jasperc2024/Domapus/issues)
- **Discussions**: Join the conversation in [GitHub Discussions](https://github.com/Jasperc2024/Domapus/discussions)
- **Email**: Contact the maintainer at [jasperc.wk@gmail.com](mailto:jasperc.wk@gmail.com)

## ☕ Support the Project

If you find Domapus useful, consider supporting its development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-orange?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/JasperC)

## 🏆 Acknowledgments

- **Redfin** for providing comprehensive real estate data
- **U.S. Census Bureau** for ZIP code boundary data
- **MapLibre GL JS Community** for the excellent mapping library
- **React & Vite Teams** for the modern development experience
- **shadcn** for the beautiful component library

---

<div align="center">
  <strong>Built with ❤️ by <a href="https://github.com/Jasperc2024">Jasper Chen</a></strong>
  <br>
  <sub>Making housing data accessible and actionable for everyone</sub>
</div>
