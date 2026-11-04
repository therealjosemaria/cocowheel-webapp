export default function MapCredits({ roadPathAttribution = false }: { roadPathAttribution?: boolean }) {
  return <p className="map-attribution">
    {roadPathAttribution && <>Road path by <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a><span aria-hidden="true"> · </span></>}
    <a href="https://leafletjs.com/" target="_blank" rel="noreferrer">Leaflet</a>
    <span aria-hidden="true"> · </span>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
  </p>;
}
