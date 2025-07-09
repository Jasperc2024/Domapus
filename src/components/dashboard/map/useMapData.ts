
import { useState, useEffect } from 'react';
import { CityData } from './types';

export const useMapData = () => {
  const [zipData, setZipData] = useState<Record<string, any>>({});
  const [citiesData, setCitiesData] = useState<Record<string, CityData>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load ZIP data from CDN
        const zipResponse = await fetch('https://cdn.jsdelivr.net/gh/jaspermayone/Domapus@main/public/data/zip_data.json');
        const zipJson = await zipResponse.json();
        setZipData(zipJson);

        // Load enhanced cities mapping with coordinates and county from CDN
        const citiesResponse = await fetch('https://cdn.jsdelivr.net/gh/jaspermayone/Domapus@main/public/data/zip-city-mapping.csv');
        const citiesText = await citiesResponse.text();
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
