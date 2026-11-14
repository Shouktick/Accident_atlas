"use client";
import { useEffect, useRef, useState } from "react";
import { convertSpeed } from "@/lib/contracts";
import Speedometer from "./Speedometer";
import { Limitation, PageTitle, Panel } from "./ui";

type Entry = { id: string; at: string; message: string };
export default function DeviceSpeedMonitor() {
  const [mode, setMode] = useState<"gps" | "simulation">("simulation"),
    [active, setActive] = useState(false),
    [kmh, setKmh] = useState(0),
    [simulated, setSimulated] = useState(30),
    [limit, setLimit] = useState(60),
    [unit, setUnit] = useState<"km/h" | "mph">("km/h"),
    [events, setEvents] = useState<Entry[]>([]),
    [error, setError] = useState("");
  const watcher = useRef<number | null>(null),
    previous = useRef<GeolocationPosition | null>(null),
    threshold = useRef(60),
    alerting = useRef(false);
  useEffect(() => {
    const resources = watcher;
    return () => {
      if (resources.current !== null)
        navigator.geolocation.clearWatch(resources.current);
    };
  }, []);
  function log(message: string) {
    setEvents((rows) =>
      [
        { id: crypto.randomUUID(), at: new Date().toISOString(), message },
        ...rows,
      ].slice(0, 50),
    );
  }
  function inspect(value: number) {
    const exceeds = value > threshold.current;
    if (exceeds !== alerting.current) {
      log(
        `${exceeds ? "Above" : "At or below"} selected threshold: ${value.toFixed(1)} km/h (threshold ${threshold.current}).`,
      );
      alerting.current = exceeds;
    }
  }
  function stop() {
    if (watcher.current !== null)
      navigator.geolocation.clearWatch(watcher.current);
    watcher.current = null;
    previous.current = null;
    setActive(false);
    setKmh(0);
    log("Monitoring stopped.");
  }
  function start() {
    setError("");
    alerting.current = false;
    if (mode === "simulation") {
      setActive(true);
      setKmh(simulated);
      log(
        "Manual simulation started. Values are illustrative controls, not measured GPS or model output.",
      );
      inspect(simulated);
      return;
    }
    if (!navigator.geolocation || !window.isSecureContext) {
      setError(
        "GPS requires a secure HTTPS/localhost context and browser geolocation support.",
      );
      return;
    }
    setActive(true);
    log("GPS monitoring requested. Coordinates stay on this device.");
    watcher.current = navigator.geolocation.watchPosition(
      (position) => {
        let speed = position.coords.speed;
        if (speed === null && previous.current) {
          const last = previous.current,
            dt = (position.timestamp - last.timestamp) / 1000;
          if (dt > 0) {
            const rad = Math.PI / 180,
              a = last.coords.latitude * rad,
              b = position.coords.latitude * rad,
              dLat = b - a,
              dLon = (position.coords.longitude - last.coords.longitude) * rad;
            const h =
              Math.sin(dLat / 2) ** 2 +
              Math.cos(a) * Math.cos(b) * Math.sin(dLon / 2) ** 2;
            speed =
              (6371000 *
                2 *
                Math.atan2(
                  Math.sqrt(Math.min(1, h)),
                  Math.sqrt(Math.max(0, 1 - h)),
                )) /
              dt;
          }
        }
        previous.current = position;
        if (speed !== null && Number.isFinite(speed) && speed >= 0) {
          setKmh(speed * 3.6);
          inspect(speed * 3.6);
        }
      },
      (problem) => {
        setError(`GPS unavailable: ${problem.message}`);
        if (watcher.current !== null)
          navigator.geolocation.clearWatch(watcher.current);
        watcher.current = null;
        setActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 },
    );
  }
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="DEVICE TOOL / SPEED MONITOR"
        title="A device reading, separate from the model."
        description="Preserved GPS and manual simulation functionality. It never supplies unverified speed units to the accident model."
      />
      <Limitation>
        GPS readings can be inaccurate. The threshold below is user-selected,
        not a verified legal limit or a declaration that driving is safe. Do not
        operate this interface while driving. Coordinates are not sent to the
        server.
      </Limitation>
      <div className="two-columns">
        <Panel
          title={
            mode === "gps" ? "Device GPS" : "Clearly labelled manual simulation"
          }
        >
          <Speedometer
            value={Math.round(convertSpeed(active ? kmh : 0, "km/h", unit))}
            min={0}
            max={Math.round(convertSpeed(160, "km/h", unit))}
            unit={unit}
            label={mode === "gps" ? "Device speed" : "Simulated speed"}
          />
          <div className="filters">
            <div className="field">
              <label htmlFor="speed-mode">Source</label>
              <select
                id="speed-mode"
                value={mode}
                disabled={active}
                onChange={(e) =>
                  setMode(e.target.value as "gps" | "simulation")
                }
              >
                <option value="simulation">Manual simulation</option>
                <option value="gps">Device GPS</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="speed-unit">Display unit</label>
              <select
                id="speed-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value as typeof unit)}
              >
                <option>km/h</option>
                <option>mph</option>
              </select>
            </div>
          </div>
          {mode === "simulation" && (
            <div className="field" style={{ marginTop: 20 }}>
              <label htmlFor="sim-speed">
                Simulated speed · {simulated} km/h
              </label>
              <input
                id="sim-speed"
                type="range"
                min="0"
                max="160"
                value={simulated}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setSimulated(value);
                  if (active) {
                    setKmh(value);
                    inspect(value);
                  }
                }}
              />
            </div>
          )}
          <div className="field" style={{ marginTop: 20 }}>
            <label htmlFor="threshold">User-selected threshold · km/h</label>
            <input
              id="threshold"
              type="number"
              min="1"
              max="200"
              value={limit}
              onChange={(e) => {
                const value = Math.min(
                  200,
                  Math.max(1, Number(e.target.value)),
                );
                setLimit(value);
                threshold.current = value;
                if (active) inspect(kmh);
              }}
            />
          </div>
          <div className="actions" style={{ marginTop: 20 }}>
            <button className="button primary" onClick={active ? stop : start}>
              {active
                ? "Stop monitoring"
                : mode === "gps"
                  ? "Start GPS monitoring"
                  : "Start manual simulation"}
            </button>
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </Panel>
        <Panel
          title="Device event log"
          subtitle="In-memory events only · not model history"
          action={
            <button className="button small" onClick={() => setEvents([])}>
              Clear events
            </button>
          }
        >
          <div className="doc-content">
            {events.length ? (
              events.map((event) => (
                <p key={event.id}>
                  <span className="mono">
                    {new Date(event.at).toLocaleTimeString()}
                  </span>{" "}
                  · {event.message}
                </p>
              ))
            ) : (
              <p>
                No device events yet. Start a clearly labelled source to record
                events.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
