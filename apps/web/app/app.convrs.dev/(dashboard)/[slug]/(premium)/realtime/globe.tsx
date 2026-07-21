"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useTheme } from "next-themes";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const DATA_SOURCE_ID = "realtime-datapoints-source";
const DATA_LAYER_ID = "realtime-datapoints-layer";

export type GlobeDataPoint = {
  id?: string;
  latitude: number;
  longitude: number;
  value?: number;
  color?: string;
};

function upsertDataPointsLayer(
  map: mapboxgl.Map,
  dataPoints: GlobeDataPoint[]
) {
  const featureCollection = {
    type: "FeatureCollection" as const,
    features: dataPoints.map((point, index) => ({
      type: "Feature" as const,
      id: point.id ?? `${point.longitude}-${point.latitude}-${index}`,
      properties: {
        value: point.value ?? 1,
        color: point.color ?? "#2563eb",
      },
      geometry: {
        type: "Point" as const,
        coordinates: [point.longitude, point.latitude] as [number, number],
      },
    })),
  };

  const existingSource = map.getSource(DATA_SOURCE_ID) as
    | mapboxgl.GeoJSONSource
    | undefined;

  if (existingSource) {
    existingSource.setData(featureCollection);
    return;
  }

  map.addSource(DATA_SOURCE_ID, {
    type: "geojson",
    data: featureCollection,
  });

  map.addLayer({
    id: DATA_LAYER_ID,
    type: "circle",
    source: DATA_SOURCE_ID,
    paint: {
      "circle-radius": 14,
      "circle-color": ["coalesce", ["get", "color"], "#2563eb"],
      "circle-opacity": 0.95,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
}

export default function Globe({
  dataPoints = [],
}: {
  dataPoints?: GlobeDataPoint[];
}) {
  const { resolvedTheme } = useTheme();

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const pointsRef = useRef<GlobeDataPoint[]>(dataPoints);

  useEffect(() => {
    pointsRef.current = dataPoints;
  }, [dataPoints]);

  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current!,
      style: "mapbox://styles/jaskaransingh2613/cmng345iw001201qu61j2d8ao",
      projection: "globe",
      zoom: 1.5,
      center: [0, 20],
    });

    mapRef.current = map;

    map.on("style.load", () => {
      map.setFog(
        resolvedTheme === "dark"
          ? {
              color: "#171717",
              "high-color": "#171717",
              "space-color": "#000000",
              "horizon-blend": 0,
              "star-intensity": 0,
            }
          : {
              color: "#ffffff",
              "high-color": "#ffffff",
              "space-color": "#ffffff",
              "horizon-blend": 0,
              "star-intensity": 0,
            }
      );

      upsertDataPointsLayer(map, pointsRef.current);
    });

    return () => map.remove();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    map.setFog(
      resolvedTheme === "dark"
        ? {
            color: "#171717",
            "high-color": "#171717",
            "space-color": "#000000",
            "horizon-blend": 0,
            "star-intensity": 0,
          }
        : {
            color: "#ffffff",
            "high-color": "#ffffff",
            "space-color": "#ffffff",
            "horizon-blend": 0,
            "star-intensity": 0,
          }
    );
  }, [resolvedTheme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    upsertDataPointsLayer(map, dataPoints);
  }, [dataPoints]);

  return (
    <div ref={mapContainer} className="fixed inset-0 z-0 overflow-hidden" />
  );
}