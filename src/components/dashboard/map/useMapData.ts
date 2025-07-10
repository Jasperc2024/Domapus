import pako from 'pako';
import { useState, useEffect } from 'react';
import { CityData } from './types';

export const useMapData = () => {
  const [zipData, setZipData] = useState<Record<string, any>>({});
  const [citiesData, setCitiesData] = useState<Record<string, CityData>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Helper function to decompress .gz files
  const fetchGzipData = async (url: string, isJson: boolean = true) => {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), { to: 'string' });
    return isJson ? JSON.parse(decompressed) : decompressed;
  };


  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load ZIP data (compressed JSON)
        const zipJson = await fetchGzipData(
          'https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/zip-data.json.gz',
          true
        );
        setZipData(zipJson);

        // Load cities CSV (compressed text)
        const citiesText = await fetchGzipData(
          'https://cdn.jsdelivr.net/gh/Jasperc2024/Domapus@main/public/data/zip-city-mapping.csv.gz',
          false
        );

        const citiesMap: Record<string, CityData> = {};

        citiesText.split('\n').slice(1).forEach(line => {
          const parts = line.split(',');
          if (parts.length >= 10) {
            const zip = parts[0]?.trim();
            const stateName = parts[3]?.trim();
            const countyName = parts[5]?.trim();
            const city = parts[6]?.trim();
            const lat = parts[8] ? parseFloat(parts[8].trim()) : undefined;
            const lng = parts[9] ? parseFloat(parts[9].trim()) : undefined;

            if (zip && city) {
              citiesMap[zip] = {
                city,
                county: countyName || undefined,
                latitude: lat,
                longitude: lng
              };
            }
          }
        });
        setCitiesData(citiesMap);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  return { zipData, citiesData, isLoading };
};
