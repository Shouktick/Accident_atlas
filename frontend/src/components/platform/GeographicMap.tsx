"use client";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
export default function GeographicMap({
  points,
}: {
  points: { lat: number; lng: number; severity: string; city: string }[];
}) {
  return (
    <MapContainer
      center={[22.5, 79]}
      zoom={4}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {points.map((p, i) => (
        <CircleMarker
          key={`${p.lat}-${p.lng}-${i}`}
          center={[p.lat, p.lng]}
          radius={5}
          pathOptions={{
            color:
              p.severity === "Fatal"
                ? "#b73a35"
                : p.severity === "Serious"
                  ? "#966413"
                  : "#247966",
            fillOpacity: 0.55,
            weight: 1,
          }}
        >
          <Popup>
            <strong>{p.city}</strong>
            <br />
            Source severity: {p.severity}
            <br />
            Verified source coordinates
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
