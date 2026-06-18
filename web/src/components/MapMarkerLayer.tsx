import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { useEffect, useRef, useState } from "react";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

import { mapEntryKey } from "../lib/mapEntryKey";
import { mapPinFill } from "../lib/mapPin";
import type { RestaurantMapEntry } from "../types";

import { MapPin } from "./RestaurantMapPins";

const CLUSTER_MAX_ZOOM = 13;

function useMapZoom(): number {
  const map = useMap();
  const [zoom, setZoom] = useState(13);

  useEffect(() => {
    if (!map) return;
    const update = () => setZoom(map.getZoom() ?? 13);
    const listener = map.addListener("zoom_changed", update);
    update();
    return () => listener.remove();
  }, [map]);

  return zoom;
}

function ClusteredMarkerLayer({
  restaurants,
  selectedId,
  onSelect,
}: {
  restaurants: RestaurantMapEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const map = useMap();
  const markerLib = useMapsLibrary("marker");
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!map || !markerLib) return;

    for (const marker of markersRef.current) marker.map = null;
    markersRef.current = [];

    const markers = restaurants.map((restaurant) => {
      const key = mapEntryKey(restaurant);
      const dot = document.createElement("div");
      dot.className = "map-pin-cluster-dot";
      dot.style.background = mapPinFill(restaurant);
      if (key === selectedId) {
        dot.classList.add("map-pin-cluster-dot--selected");
      }

      const marker = new markerLib.AdvancedMarkerElement({
        position: { lat: restaurant.lat, lng: restaurant.lng },
        content: dot,
        title: restaurant.name,
      });
      marker.addListener("click", () => onSelectRef.current(key));
      return marker;
    });

    markersRef.current = markers;
    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({
        map,
        markers,
        onClusterClick: (_event, cluster, mapInstance) => {
          const targetZoom = Math.min((mapInstance.getZoom() ?? CLUSTER_MAX_ZOOM) + 2, 16);
          mapInstance.panTo(cluster.position);
          mapInstance.setZoom(targetZoom);
        },
      });
    } else {
      clustererRef.current.clearMarkers();
      clustererRef.current.addMarkers(markers);
    }

    return () => {
      clustererRef.current?.clearMarkers();
      for (const marker of markersRef.current) marker.map = null;
      markersRef.current = [];
    };
  }, [map, markerLib, restaurants, selectedId]);

  return null;
}

export function MapMarkerLayer({
  restaurants,
  selectedId,
  onSelect,
}: {
  restaurants: RestaurantMapEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const zoom = useMapZoom();
  const useClustering = zoom <= CLUSTER_MAX_ZOOM && restaurants.length > 12;

  if (useClustering) {
    return (
      <ClusteredMarkerLayer
        restaurants={restaurants}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    );
  }

  return (
    <>
      {restaurants.map((r) => {
        const key = mapEntryKey(r);
        return (
          <MapPin key={key} restaurant={r} selected={selectedId === key} onSelect={() => onSelect(key)} />
        );
      })}
    </>
  );
}

/** Re-export MapPin for tests or direct use. */
export { MapPin };
