<p align="center" style="margin: 0;">
    <img src="https://github.com/Jasperc2024/Domapus/blob/main/public/Banner.svg" width=400>
</p>

[![Live Website](https://img.shields.io/badge/Live-Website-2596BE)](https://jasperc2024.github.io/Domapus/)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white&style=flat)
[![License](https://img.shields.io/badge/License-MIT-green)](https://github.com/Jasperc2024/Domapus/blob/main/LICENSE.md)
[![build](https://github.com/Jasperc2024/Domapus/actions/workflows/pages/pages-build-deployment/badge.svg)](https://github.com/Jasperc2024/Domapus/actions/workflows/pages/pages-build-deployment)
![GitHub Stars](https://img.shields.io/github/stars/Jasperc2024/Domapus?style=flat)
![Contributors](https://img.shields.io/github/contributors/Jasperc2024/Domapus?style=flat)
[![](https://data.jsdelivr.com/v1/package/gh/Jasperc2024/Domapus/badge)](https://www.jsdelivr.com/package/gh/Jasperc2024/Domapus)


**Domapus** visualizes U.S. housing market data at the ZIP-code level.  
Built with **React**, **TypeScript**, and **MapLibre GL JS**, it makes nationwide housing trends interactive and accessible.

![Preview](https://jasperc2024.github.io/Domapus/preview.png)

---

## ✨ Features

### 🗺️ Map & Data Visualization
- Interactive **ZIP-level map** updated monthly  
- Metrics: *median price, inventory, DOM, listings, sales, and more*  
- **Hover tooltips**, **ZIP search**, and **region filters**  

### 📊 Analytics & Export
- Dynamic color scaling with **D3-Scale**  
- Quintile-based legend for data distribution  
- **Export maps** to PNG or PDF with title and legend options  

### ⚡ Performance
- **Web Workers** for data offloading  
- **GPU-accelerated rendering** via MapLibre GL  
- Lazy-loaded components and gzip compression

---

## 🚀 Quick Start

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
npm run build && npm run preview
```

---

## 🏗️ Project Structure

```
src/
├── components/
│   ├── dashboard/        # Map and analytics components
│   ├── ui/               # Reusable UI (shadcn/ui)
├── hooks/                # Custom React hooks
├── utils/                # Helper functions
├── workers/              # Web workers
└── pages/                # Page components

```

---

## 📈 Metrics Overview

| Metric                    | Description                 |
| ------------------------- | --------------------------- |
| **Median Sale Price**     | Typical price of sold homes |
| **Median List Price**     | Typical asking price        |
| **Days on Market**        | Average listing duration    |
| **Inventory**             | Homes available for sale    |
| **New Listings**          | Homes newly added           |
| **Homes Sold**            | Closed transactions         |
| **Sale-to-List Ratio**    | Sale price ÷ asking price   |
| **Homes Sold Above List** | % of homes sold above ask   |
| **Off Market in 2 Weeks** | % of homes selling rapidly  |

---

## 🧠 Tech Stack
**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui

**Visualization:** MapLibre GL JS, D3-Scale

**Data:** Redfin (market), U.S. Census (ZCTA)

**Data Processing:** Github Action, Python

**Export Tools:** html2canvas, jsPDF

**Optimization:** Pako, Web Workers

---

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

---

## 🌐 Data Sources

-  Redfin real estate market data
-  U.S. Census ZIP Code Tabulation Areas (ZCTA)
-  Custom aggregated geographic data for city/County Mapping
-  Data refreshed monthly from Redfin sources

---

## 🔒 Privacy & Security

* 100% client-side processing
* All assets served securely over HTTPS

---

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

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙋 Support

- **Documentation**: Available in this README and inline code comments
- **Issues**: Report bugs and request features via [GitHub Issues](https://github.com/Jasperc2024/Domapus/issues)
- **Discussions**: Join the conversation in [GitHub Discussions](https://github.com/Jasperc2024/Domapus/discussions)
- **Email**: Contact the maintainer at [jasperc.wk@gmail.com](mailto:jasperc.wk@gmail.com)

---

## ☕ Support the Project

If you find Domapus useful, consider supporting its development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-orange?style=flat&logo=buy-me-a-coffee)](https://buymeacoffee.com/JasperC)

---

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
