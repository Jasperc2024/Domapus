import { useEffect, useState } from "react";
import { getMetricValue, getMetricDisplay } from "./map/utils";
import pako from "pako";

interface ExportLegendProps {
  selectedMetric: string;
  exportOptions: {
    regionScope: "national" | "state" | "metro";
    selectedState?: string;
    selectedMetro?: string;
  };
  className?: string;
}

export function ExportLegend({
  selectedMetric,
  exportOptions,
  className = "",
}: ExportLegendProps) {
  const [metricValues, setMetricValues] = useState<number[]>([]);
  const [zipCount, setZipCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          "https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/zip-data.json.gz",
        );
        const arrayBuffer = await response.arrayBuffer();
        const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), {
          to: "string",
        });
        const data = JSON.parse(decompressed);

        // Filter data based on export options
        let filteredData = data;
        if (
          exportOptions.regionScope === "state" &&
          exportOptions.selectedState
        ) {
          filteredData = Object.fromEntries(
            Object.entries(data).filter(
              ([, zipData]: [string, unknown]) =>
                (zipData as Record<string, unknown>).state ===
                exportOptions.selectedState,
            ),
          );
        } else if (
          exportOptions.regionScope === "metro" &&
          exportOptions.selectedMetro
        ) {
          filteredData = Object.fromEntries(
            Object.entries(data).filter(
              ([, zipData]: [string, unknown]) =>
                (zipData as Record<string, unknown>).parent_metro ===
                exportOptions.selectedMetro,
            ),
          );
        }

        setZipCount(Object.keys(filteredData).length);

        // Get all values for the selected metric from filtered data
        const values = Object.values(filteredData)
          .map((zipData: unknown) =>
            getMetricValue(zipData as Record<string, unknown>, selectedMetric),
          )
          .filter((v) => v > 0)
          .sort((a, b) => a - b);

        setMetricValues(values);
      } catch (error) {
        console.error("Error loading legend data:", error);
        setZipCount(0);
        setMetricValues([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedMetric, exportOptions]);

  const getLegendValues = () => {
    if (metricValues.length === 0) {
      return { min: "No data", max: "No data", quintiles: [] };
    }

    const min = metricValues[0];
    const max = metricValues[metricValues.length - 1];

    // Calculate quintiles (5 equal parts)
    const quintiles = [];
    for (let i = 0; i <= 4; i++) {
      const index = Math.floor((metricValues.length - 1) * (i / 4));
      quintiles.push(metricValues[index]);
    }

    return {
      min: getMetricDisplay(
        { [selectedMetric.replace("-", "_")]: min },
        selectedMetric,
      ),
      max: getMetricDisplay(
        { [selectedMetric.replace("-", "_")]: max },
        selectedMetric,
      ),
      quintiles: quintiles.map((val) =>
        getMetricDisplay(
          { [selectedMetric.replace("-", "_")]: val },
          selectedMetric,
        ),
      ),
    };
  };

  const { min, max, quintiles } = getLegendValues();

  if (isLoading) {
    return (
      <div
        className={`bg-white border border-gray-300 rounded p-4 inline-block ${className}`}
      >
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2 w-20"></div>
          <div className="h-4 bg-gray-200 rounded mb-2 w-32"></div>
          <div className="flex space-x-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-12 h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white border border-gray-300 rounded p-4 inline-block ${className}`}
    >
      <h3 className="text-sm font-semibold mb-3 text-gray-900">Legend</h3>

      {/* Color gradient bar */}
      <div className="mb-3">
        <div
          className="h-4 rounded-lg"
          style={{
            background:
              "linear-gradient(to right, #497eaf, #5fa4ca, #b4d4ec, #ffecd4, #fac790, #e97000)",
          }}
        />
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>

      {/* Quintile indicators */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        {quintiles.map((value, index) => {
          const colors = [
            "#497eaf",
            "#5fa4ca",
            "#b4d4ec",
            "#fac790",
            "#e97000",
          ];
          return (
            <div key={index} className="text-center">
              <div
                className="w-4 h-4 rounded mx-auto mb-1"
                style={{ backgroundColor: colors[index] }}
              />
              <span className="text-[10px] text-gray-600 leading-tight block">
                {value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Data count */}
      <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-200">
        {zipCount.toLocaleString()} ZIP codes
      </div>
    </div>
  );
}
