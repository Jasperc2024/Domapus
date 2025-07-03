# U.S. Housing Market Dashboard

A responsive, interactive web dashboard for visualizing U.S. housing market data at the ZIP code level, powered by Redfin's public data.

## Features

- 🗺️ **Interactive Map Visualization**: Color-coded ZIP code regions showing housing metrics
- 📊 **Multiple Data Metrics**: Median prices, days on market, inventory, sales ratios, and more
- 🔍 **ZIP Code Search**: Quick navigation to specific areas
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile
- 🔄 **Automated Data Updates**: Monthly data refresh via GitHub Actions
- 📈 **Detailed Analytics**: Comprehensive breakdowns for each ZIP code

## Data Metrics

- Median Sale Price & List Price
- Median Days on Market (DOM)
- Inventory & New Listings
- Homes Sold & Sale-to-List Ratios
- Percentage of Homes Sold Above List
- Off-Market in 2 Weeks percentage
- Price per Square Foot (PPSF)

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Build Tool**: Vite
- **Data Processing**: Python, Pandas
- **Automation**: GitHub Actions
- **Data Source**: Redfin Public Data

## Data Pipeline

The dashboard uses an automated pipeline to keep data current:

1. **Monthly Schedule**: GitHub Actions runs on the Thursday of each month's third full week
2. **Data Fetch**: Downloads latest ZIP code data from Redfin's S3 bucket
3. **Processing**: Python script cleans, transforms, and formats the data
4. **Deployment**: Updated JSON data is committed to the repository

## Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Data Processing

To manually update the data:

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Run the data processing script:
   ```bash
   python scripts/parse_redfin_zip_data.py
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Data Source & Disclaimer

Housing market data is sourced from [Redfin](https://www.redfin.com). All data is publicly available and provided as-is for informational and educational purposes only.

**Disclaimer**: This website is not affiliated with or endorsed by Redfin Corporation. While efforts are made to keep the data accurate and current, we cannot guarantee completeness or reliability. For official real estate information, consult licensed professionals or Redfin directly.

## Support

If you find this project useful, please consider [sponsoring](https://github.com/sponsors/your-username) to help keep the data flowing and the site improving.

**URL**: https://lovable.dev/projects/d6dcb301-9712-4f2a-9f31-d8b6d509bcb7

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/d6dcb301-9712-4f2a-9f31-d8b6d509bcb7) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/d6dcb301-9712-4f2a-9f31-d8b6d509bcb7) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
