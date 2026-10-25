"use client";

import { useEffect, useState } from "react";
import { dateText } from "@/lib/format";
import { DEFAULT_SETTINGS, readSettings, type Settings, writeSettings } from "@/lib/settings";
import { clearReports, deleteReport, listReports, type StoredMeta } from "@/lib/store";
import { Segmented } from "./ui";

export function SettingsView() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [reports, setReports] = useState<StoredMeta[] | null>(null);

  useEffect(() => {
    setS(readSettings());
    listReports()
      .then(setReports)
      .catch(() => setReports([]));
  }, []);
  const update = (patch: Partial<Settings>) => {
    const next = { ...s, ...patch };
    setS(next);
    writeSettings(next);
  };

  return (
    <div className="settings">
      <section className="setting">
        <div>
          <h2 className="h4">Theme</h2>
          <p className="small muted">System follows your device.</p>
        </div>
        <Segmented
          label="Theme"
          value={s.theme}
          onChange={(theme) => update({ theme })}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </section>
      <section className="setting">
        <div>
          <h2 className="h4">Density</h2>
          <p className="small muted">Compact fits more rows on a screen.</p>
        </div>
        <Segmented
          label="Density"
          value={s.density}
          onChange={(density) => update({ density })}
          options={[
            { value: "comfortable", label: "Comfortable" },
            { value: "compact", label: "Compact" },
          ]}
        />
      </section>
      <section className="setting">
        <div>
          <h2 className="h4">Reduce motion</h2>
          <p className="small muted">Also follows your device setting automatically.</p>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={s.reduceMotion}
            onChange={(e) => update({ reduceMotion: e.target.checked })}
          />
          Turn off transitions
        </label>
      </section>
      <section className="setting setting-col">
        <div>
          <h2 className="h4">Reports in this browser</h2>
          <p className="small muted">Saved only here. Removing them cannot be undone.</p>
        </div>
        {reports === null ? (
          <p className="muted small">Loading</p>
        ) : reports.length === 0 ? (
          <p className="muted small">No saved reports.</p>
        ) : (
          <ul className="plain-list">
            {reports.map((r) => (
              <li key={r.id} className="rel-row">
                <span>
                  <a className="textlink" href={`/r/${r.id}/briefing`}>
                    {r.name}
                  </a>{" "}
                  <span className="muted small">{dateText(r.savedAt)}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={async () => {
                    await deleteReport(r.id);
                    setReports(await listReports());
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        {reports && reports.length > 1 ? (
          <button
            type="button"
            className="btn"
            onClick={async () => {
              await clearReports();
              setReports([]);
            }}
          >
            Delete all reports
          </button>
        ) : null}
      </section>
    </div>
  );
}
