// Web Worker for heavy data processing operations
// This runs in a separate thread to avoid blocking the main UI

import pako from "pako";

// Cache for processed data
const dataCache = new Map();

// Helper function to get metric value
function getMetricValue(data, metric) {
  const metricMap = {
    "median-sale-price": "median_sale_price",
    "median-list-price": "median_list_price",
    "median-dom": "median_dom",
    inventory: "inventory",
    "new-listings": "new_listings",
    "homes-sold": "homes_sold",
    "sale-to-list-ratio": "sale_to_list_ratio",
    "homes-sold-above-list": "homes_sold_above_list",
    "off-market-2-weeks": "off_market_in_2_weeks",
  };

  const key = metricMap[metric] || metric;
  return data[key] || 0;
}

// Process zip data for map visualization
function processZipData(zipData, selectedMetric, bounds = null) {
  const cacheKey = `${selectedMetric}-${bounds ? JSON.stringify(bounds) : "all"}`;

  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }

  const processedData = {};
  const metricValues = [];
  let processed = 0;
  const total = Object.keys(zipData).length;

  for (const [zipCode, zipInfo] of Object.entries(zipData)) {
    // Yield control every 1000 items
    if (processed % 1000 === 0) {
      self.postMessage({
        type: "PROGRESS",
        data: { processed, total, phase: "processing" },
      });
    }

    // Check bounds if provided
    if (bounds && zipInfo.latitude && zipInfo.longitude) {
      const { north, south, east, west } = bounds;
      if (
        zipInfo.latitude < south ||
        zipInfo.latitude > north ||
        zipInfo.longitude < west ||
        zipInfo.longitude > east
      ) {
        processed++;
        continue;
      }
    }

    const value = getMetricValue(zipInfo, selectedMetric);
    if (value > 0) {
      processedData[zipCode] = {
        ...zipInfo,
        metricValue: value,
      };
      metricValues.push(value);
    }
    processed++;
  }

  // Sort values for quantile calculations
  metricValues.sort((a, b) => a - b);

  const result = {
    processedData,
    metricValues,
    bounds: {
      min: metricValues[0] || 0,
      max: metricValues[metricValues.length - 1] || 0,
    },
    count: Object.keys(processedData).length,
  };

  // Cache the result
  dataCache.set(cacheKey, result);

  return result;
}

// Process GeoJSON for map rendering
function processGeoJSON(geojsonData, zipData, selectedMetric) {
  const features = [];
  let processed = 0;
  const total = geojsonData.features.length;

  for (const feature of geojsonData.features) {
    if (processed % 1000 === 0) {
      self.postMessage({
        type: "PROGRESS",
        data: { processed, total, phase: "geojson" },
      });
    }

    const zipCode =
      feature.properties?.ZCTA5CE20 || feature.properties?.GEOID20;
    if (zipCode && zipData[zipCode]) {
      const value = getMetricValue(zipData[zipCode], selectedMetric);
      if (value > 0) {
        features.push({
          ...feature,
          properties: {
            ...feature.properties,
            zipCode,
            metricValue: value,
            zipData: zipData[zipCode],
          },
        });
      }
    }
    processed++;
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

// Message handler
self.onmessage = async function (e) {
  const { type, data, id } = e.data;

  try {
    switch (type) {
      case "LOAD_AND_PROCESS_DATA":
        {
          const { urls, selectedMetric } = data;

          // Load ZIP data
          self.postMessage({
            type: "PROGRESS",
            data: { phase: "loading_zip_data" },
          });
          const zipResponse = await fetch(urls.zipData);
          const zipArrayBuffer = await zipResponse.arrayBuffer();
          const zipDecompressed = pako.ungzip(new Uint8Array(zipArrayBuffer), {
            to: "string",
          });
          const zipData = JSON.parse(zipDecompressed);

          // Load cities data
          self.postMessage({
            type: "PROGRESS",
            data: { phase: "loading_cities_data" },
          });
          const citiesResponse = await fetch(urls.citiesData);
          const citiesArrayBuffer = await citiesResponse.arrayBuffer();
          const citiesDecompressed = pako.ungzip(
            new Uint8Array(citiesArrayBuffer),
            { to: "string" },
          );

          // Parse cities CSV
          const citiesMap = {};
          citiesDecompressed
            .split("\n")
            .slice(1)
            .forEach((line) => {
              const parts = line.split(",");
              if (parts.length >= 10) {
                const zip = parts[0]?.trim();
                const city = parts[6]?.trim();
                const lat = parts[8] ? parseFloat(parts[8].trim()) : undefined;
                const lng = parts[9] ? parseFloat(parts[9].trim()) : undefined;

                if (zip && city) {
                  citiesMap[zip] = { city, latitude: lat, longitude: lng };
                }
              }
            });

          // Process the data
          self.postMessage({
            type: "PROGRESS",
            data: { phase: "processing_data" },
          });
          const processedResult = processZipData(zipData, selectedMetric);

          self.postMessage({
            type: "DATA_PROCESSED",
            data: {
              zipData,
              citiesData: citiesMap,
              ...processedResult,
            },
            id,
          });
        }
        break;

      case "PROCESS_GEOJSON":
        {
          const { geojsonData, zipData, selectedMetric } = data;
          const processedGeoJSON = processGeoJSON(
            geojsonData,
            zipData,
            selectedMetric,
          );

          self.postMessage({
            type: "GEOJSON_PROCESSED",
            data: processedGeoJSON,
            id,
          });
        }
        break;

      case "REPROCESS_DATA":
        {
          const { zipData, selectedMetric, bounds } = data;
          const result = processZipData(zipData, selectedMetric, bounds);

          self.postMessage({
            type: "DATA_REPROCESSED",
            data: result,
            id,
          });
        }
        break;

      case "CLEAR_CACHE":
        dataCache.clear();
        self.postMessage({ type: "CACHE_CLEARED", id });
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: "ERROR",
      error: error.message,
      id,
    });
  }
};

// Handle errors
self.onerror = function (error) {
  self.postMessage({
    type: "ERROR",
    error: error.message,
  });
};
