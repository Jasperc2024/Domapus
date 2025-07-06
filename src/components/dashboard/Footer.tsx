export function Footer() {
  return (
    <footer className="bg-dashboard-panel border-t border-dashboard-border px-6 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-xs text-dashboard-text-secondary space-y-2">
          <p>
            <strong>Data Source:</strong> Housing market data is sourced from{" "}
            <a 
              href="https://www.redfin.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Redfin
            </a>
            . All data is publicly available and provided as-is for informational and educational purposes only.
          </p>
          
        </div>
      </div>
    </footer>
  );
}
