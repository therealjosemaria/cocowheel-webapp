import { vehicleArtwork } from "@/lib/vehicle-catalogue";
import type { Vehicle } from "@/lib/vehicle";

/** Vehicle images are illustrations; the accompanying plate/text remains authoritative. */
export default function VehicleArtwork({ vehicle }: { vehicle?: Vehicle }) {
  const src = vehicleArtwork(vehicle);
  return src ? (
    // Static local WebP, already sized and compressed by the asset-preparation script.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="vehicle-artwork-preview"
      src={src}
      width={192}
      height={144}
      alt="Vehicle illustration"
    />
  ) : (
    <span
      className="vehicle-artwork-preview vehicle-artwork-generic"
      aria-label="Standard vehicle illustration"
      role="img"
    >
      <i
        className="journey-role-art journey-role-art-driver"
        aria-hidden="true"
      />
    </span>
  );
}
