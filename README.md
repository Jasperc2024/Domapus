# Domapus

A responsive, interactive dashboard that visualizes housing market data across the United States down to the ZIP code level. Built on Redfin's public data, this tool offers detailed metrics, a clean interface, and automated monthly updates — all open-source and ad-free.

> 🌐 **Live Demo**: [https://jasperc2024.github.io/Domapus/](https://jasperc2024.github.io/Domapus/)

---

## 🚀 Features

- 🗺️ Interactive ZIP-level U.S. Map with color-coded housing metrics
- 📊 Real-time metrics including prices, inventory, sales, and more
- 🔎 Search by ZIP code for quick navigation
- 📱 Mobile-friendly responsive design
- 🔄 Automated monthly updates via GitHub Actions
- 📈 Detailed hover and click analytics per ZIP code

---

## 📊 Tracked Metrics

- **🏷 Median Sale Price & Median List Price**
- **📆 Median Days on Market (DOM) & Days to Close**
- **🏘 Inventory, New Listings, Pending Sales**
- **🏡 Homes Sold & % Sold Above List**
- **💰 Sale-to-List Ratio & Price Drops**
- **📦 Off-Market in Two Weeks Percentage**
- **📐 Price per Square Foot (PPSF)**
- **📈 Year-over-Year (YoY) and Month-over-Month (MoM)** changes

---

## ⚙️ Tech Stack

| Layer        | Technology                            |
|--------------|----------------------------------------|
| Frontend     | React, TypeScript, Vite               |
| Styling      | Tailwind CSS, shadcn/ui               |
| Data Parsing | Python, Pandas                        |
| Automation   | GitHub Actions                        |
| Deployment   | GitHub Pages                          |
| Data Source  | [Redfin Public Data](https://www.redfin.com/news/data-center/) |

---

## 🔁 Data Pipeline

The dashboard stays current through an automated monthly pipeline:

1. 🗓 **Schedule**: Third full week of each month, Redfin releases ZIP-level data
2. 📥 **Download**: TSV.gz file retrieved from Redfin’s public S3 bucket
3. 🧹 **Cleanup**: Drops all Type IDs, MOM/YOY fields (or retains if needed), and unused metadata
4. 🔄 **Parse**: Converts data to structured `zip_data.json` for frontend use
5. 🚀 **Deploy**: GitHub Action commits new data and refreshes the site

🛠 Script: `scripts/parse_redfin_zip_data.py`  
🔁 Automation: `.github/workflows/update-data.yml`

---

## 💻 Local Development

To run this project locally:

```bash
git clone https://github.com/Jasperc2024/Domapus.git
cd Domapus
npm install
npm run dev
```

Visit: `http://localhost:5173`

---

## 🐍 Manual Data Update (Python)

To manually reprocess Redfin's data:

```bash
pip install -r requirements.txt
python scripts/parse_redfin_zip_data.py
```

The script:
- Downloads latest `.tsv.gz` from Redfin
- Filters, formats, and simplifies
- Exports to `data/zip_data.json` for frontend usage

---

## 📦 Deployment via GitHub Pages

- Project auto-deploys via GitHub Pages using GitHub Actions
- Hosted at: [https://jasperc2024.github.io/Domapus/](https://jasperc2024.github.io/Domapus/)
- To manually deploy:
  ```bash
  npm run build
  ```

---

## 🧭 Roadmap

- 🕒 Timeline slider to visualize historical changes
- 📈 Animated YoY and MoM visualizations
- 🧭 Multi-region support (City, County, Metro overlays)
- 📍 Marker clustering for high-density ZIPs
- 🔍 Multi-metric layer switching (Price, DOM, PPSF, etc.)
- 🧠 Add AI-based housing trend insights
- 🧮 Predictive analytics for key markets
- 📤 Export or share ZIP-level reports

---

## 🙋 Contributing

We welcome pull requests!

1. Fork the repo
2. Create a feature branch:
   ```bash
   git checkout -b your-feature
   ```
3. Commit changes:
   ```bash
   git commit -m "Add your feature"
   ```
4. Push:
   ```bash
   git push origin your-feature
   ```
5. Open a pull request

---

## 📢 Attribution & License

**📊 Data Source**:  
All housing data is from [Redfin’s Public Data Center](https://www.redfin.com/news/data-center/). Data is publicly available and used for non-commercial, educational, and informational purposes.

> **Disclaimer**: This project is **not affiliated with or endorsed by Redfin Corporation**.  
> Data is presented “as-is” without guarantees of accuracy. Always consult real estate professionals for decisions.

**📝 License**: MIT  
You are free to use, modify, and distribute this project. Give credit where it's due.

---

## ❤️ Support the Project

This site is completely **free**, **open-source**, and **ad-free**.

If you’d like to help improve the dashboard or support the developer:

- 🌟 Star the repo  
- :hearts: [Sponsor on GitHub](https://github.com/sponsors/jasperc2024)
- :coffee: [Buy Me A Coffee](https://buymeacoffee.com/jasperc)
- 💬 Share feedback and ideas!

---

## 🔗 Useful Links

- 🌍 Live Website: [https://jasperc2024.github.io/Domapus/](https://jasperc2024.github.io/Domapus/)
- 🧪 Lovable Builder: [https://lovable.dev/projects/d6dcb301-9712-4f2a-9f31-d8b6d509bcb7](https://lovable.dev/projects/d6dcb301-9712-4f2a-9f31-d8b6d509bcb7)
- 📁 GitHub Repo: [https://github.com/Jasperc2024/Domapus](https://github.com/Jasperc2024/Domapus)
```
