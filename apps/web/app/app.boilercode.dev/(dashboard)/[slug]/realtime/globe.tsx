"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

export default function Globe() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

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
      map.setFog({
        color: "white", // sky color
        "high-color": "white", // upper atmosphere
        "horizon-blend": 0.0, // remove glow
        "space-color": "white", // remove black space
        "star-intensity": 0, //  no stars
      });
    });

    return () => map.remove();
  }, []);

  return (
    <div
      ref={mapContainer}
      className="w-full h-[85vh] rounded-xl overflow-hidden"
    />
  );
}
