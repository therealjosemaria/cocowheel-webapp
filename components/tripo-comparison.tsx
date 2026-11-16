"use client";
import Image from "next/image";
import { createElement, useEffect, useState } from "react";
import { requestJson } from "@/lib/api-transport";
import { TRIPO_MODELS, type Comparison, type ComparisonRow } from "@/lib/tripo-comparison";
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
  const rows: ComparisonRow[] =
    comparison?.rows ??
    TRIPO_MODELS.map((m) => ({ ...m, status: "Waiting for reference photo" }));
  const images = rows.filter(row => row.kind === "image");
  const imageComparison = images.length ? [rows.find(row => row.id === "P2-20260801"), ...images].filter((row): row is ComparisonRow => !!row) : [];
  const tableRows = imageComparison.length ? [...imageComparison, ...rows.filter(row => !imageComparison.some(image => image.id === row.id))] : rows;
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
            One reference photo. Compare the avatar images, then rotate the 3D
            results below to inspect likeness and shape.
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
              <figcaption>Same reference used for every result</figcaption>
            </figure>
          )}
          {imageComparison.length > 0 && <>
            <section className="help-section"><h2>Avatar images</h2>
              <p>P2’s existing render beside the new 2D results. These tests haven’t changed your map avatar.</p>
            </section>
            <div className="tripo-grid tripo-image-grid">
              {imageComparison.map(row => <section className="help-section" key={row.id}>
                <h3>{row.name}{row.id === "P2-20260801" ? " · current avatar" : ""}</h3>
                {row.previewReady ? <Image unoptimized width={512} height={768} src={`/api/admin/tripo/${row.id}.png`}
                  alt={`${row.name} avatar image`} className="tripo-model tripo-image" /> : <p>{row.status}</p>}
                {row.kind === "image" && row.previewReady && <p>{row.transparent ? "Transparency present" : "Opaque background"}</p>}
                {row.previewReady && <a className="help-email" href={`/api/admin/tripo/${row.id}.png`} download={`${row.name}.png`}>Download image</a>}
              </section>)}
            </div>
          </>}
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
                {tableRows.map((row) => (
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
            {images.length > 0 && " P2 was reused; its charge and time are from the original test."}
          </p>
          <div className="tripo-grid">
            {rows.filter(row => row.kind !== "image").map((row) => (
              <section className="help-section" key={row.id}>
                <h2>{row.name}</h2>
                <p>{row.id}</p>
                {"modelReady" in row && row.modelReady && viewer ? (
                  createElement("model-viewer", {
                    src: `/api/admin/tripo/${row.id}.glb`,
                    alt: `${row.name} generated avatar`,
                    "camera-controls": true,
                    "camera-orbit": "90deg 75deg 105%",
                    "interaction-prompt": "none",
                    loading: "lazy",
                    poster:
                      "previewReady" in row && row.previewReady
                        ? `/api/admin/tripo/${row.id}.png`
                        : undefined,
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
              For 3D generation, Tripo’s published default pools allow 10 H-series or 5 P-series
              generations concurrently per account. A hundred simultaneous
              requests would need a queue; waiting increases completion time.
              These are published limits, not a capacity test of our account or the image models.
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
