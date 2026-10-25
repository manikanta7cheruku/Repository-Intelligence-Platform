import type { Metadata } from "next";
import { SettingsView } from "@/components/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1 className="h1">Settings</h1>
          <p className="lede">Stored only in this browser.</p>
        </div>
      </header>
      <SettingsView />
    </div>
  );
}
