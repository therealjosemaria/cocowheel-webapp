"use client";
import Image from "next/image";
import { createElement, useEffect, useState } from "react";
import { requestJson } from "@/lib/api-transport";
import { TRIPO_MODELS, type Comparison } from "@/lib/tripo-comparison";
export default function TripoComparison() {
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [viewer, setViewer] = useState(false);
  useEffect(() => {
    let active = true;
    requestJson<{ comparison: Comparison | null }>("/api/admin/tripo", {
      cache: "no-store",
    })
      .then((result) => {
        if (active) {
          setComparison(result.comparison);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Couldn’t load comparisons. Check your admin sign-in, then reload this page.",
          );
      });
    import("@google/model-viewer")
      .then(() => {
        if (active) setViewer(true);
      })
      .catch(() => {
        if (active)
          setError(
            "The 3D viewer couldn’t load. Reload this page or download a model to inspect it.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const rows =
    comparison?.rows ??
    TRIPO_MODELS.map((m) => ({ ...m, status: "Waiting for reference photo" }));
  return (
    <section className="activity-page">
      <div className="activity-panel">
        <h1 className="page-title">Avatar comparison</h1>
        <div className="activity-panel-content tripo-comparison">
          <a className="help-email" href="/admin">
            Back
          </a>
          {error && <p role="alert">{error}</p>}
          <p>
            Five models, one reference photo. Rotate each result to compare
            likeness and shape.
          </p>
          {loaded && !comparison && (
            <p>
              Send the reference photo and fund the Tripo API balance to begin.
              No generations have run.
            </p>
          )}
          {comparison && (
            <figure>
              <Image
                unoptimized
                width={200}
                height={260}
                src="/api/admin/tripo/reference.png"
                alt="Shared reference for this comparison"
                className="tripo-reference"
              />
              <figcaption>Same reference used for all five models</figcaption>
            </figure>
          )}
          <div className="tripo-table">
            <table>
              <caption>Generation results — costs in USD</caption>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Time¹</th>
                  <th>List estimate</th>
                  <th>Verified charge</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.name}</th>
                    <td>{row.status}</td>
                    <td>
                      {"elapsedSeconds" in row && row.elapsedSeconds != null
                        ? `${row.elapsedSeconds}s`
                        : "—"}
                    </td>
                    <td>
                      {row.estimatedCredits == null
                        ? "Unverified"
                        : `$${(row.estimatedCredits / 100).toFixed(2)}`}
                    </td>
                    <td>
                      {"chargedCredits" in row &&
                      typeof row.chargedCredits === "number"
                        ? `$${(row.chargedCredits / 100).toFixed(2)}`
                        : "Unverified"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            ¹Time includes submission and provider waiting, measured until
            completion is observed. Estimates are separate from actual charges.
          </p>
          <div className="tripo-grid">
            {rows.map((row) => (
              <section className="help-section" key={row.id}>
                <h2>{row.name}</h2>
                <p>{row.id}</p>
                {"modelReady" in row && row.modelReady && viewer ? (
                  createElement("model-viewer", {
                    src: `/api/admin/tripo/${row.id}.glb`,
                    alt: `${row.name} generated avatar`,
                    "camera-controls": true,
                    "touch-action": "pan-y",
                    class: "tripo-model",
                  })
                ) : (
                  <p>{row.status}</p>
                )}
                {"modelReady" in row && row.modelReady && (
                  <a
                    className="help-email"
                    href={`/api/admin/tripo/${row.id}.glb`}
                    download={`${row.name}.glb`}
                  >
                    Download model
                  </a>
                )}
              </section>
            ))}
          </div>
          <section className="help-section">
            <h2>Before choosing a model</h2>
            <p>
              A single photo cannot establish hidden body details. This test
              checks likeness; it does not guarantee an accurate full body or an
              animated character.
            </p>
            <p>
              Tripo’s published default pools allow 10 H-series or 5 P-series
              generations concurrently per account. A hundred simultaneous
              requests would need a queue; waiting increases completion time.
              These are published limits, not a capacity test of our account.
            </p>
            <p>
              No concurrency surcharge or first-ten-free API allowance has been
              verified. Generation options affect price; API and Studio balances
              are separate. Confirm account pricing before larger batches.
            </p>
            <p>
              <a
                className="help-email"
                href="https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard"
              >
                Tripo documentation
              </a>
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
