/**
 * Light MapLibre stub — dependency is installed; full OSM basemap + END
 * contours come later. Do not load tiles or create a Map instance yet.
 */
import 'maplibre-gl/dist/maplibre-gl.css'
import './MapStub.css'

export function MapStub() {
  return (
    <section className="map-stub" aria-label="Map placeholder">
      <div className="map-stub__frame">
        <p className="map-stub__label">MapLibre + OpenStreetMap</p>
        <p className="map-stub__hint">
          Basemap and EEA noise contours will mount here.
        </p>
      </div>
    </section>
  )
}
