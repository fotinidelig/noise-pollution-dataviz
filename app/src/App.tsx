import { MapStub } from './components/MapStub'
import './App.css'

function App() {
  return (
    <main className="page">
      <header className="header">
        <p className="eyebrow">Noise pollution dataviz</p>
        <h1>Europe environmental noise</h1>
        <p className="lede">
          Interactive exploration of EEA END exposure against WHO / EU
          thresholds, with nature dB as a reference. Map and charts coming
          next.
        </p>
      </header>

      <MapStub />

      <footer className="footer">
        <p>
          Stack: Vite · React · TypeScript · D3 · MapLibre (OSM). Data dirs are
          empty until END / Asia downloads are approved.
        </p>
      </footer>
    </main>
  )
}

export default App
