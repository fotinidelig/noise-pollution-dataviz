import type { StoryMetrics, StoryStep } from './storyTypes'
import { formatPeople, vacuumBlenderCompare } from './storyTypes'

/** Wrap a phrase for colored insight spans (`**…**` → `.scrolly-hi`). */
function hi(s: string) {
  return `**${s}**`
}

export function buildSteps(m: StoryMetrics): StoryStep[] {
  const eu = m.europe
  const de = m.germany
  const paris = m.paris
  const madrid = m.madrid
  const hk = m.hong_kong
  const seoul = m.seoul

  const whoAbove = formatPeople(eu.people_exposed_lden_end_bands)
  const ha = formatPeople(eu.people_highly_annoyed)

  return [
    {
      id: 'hero',
      railLabel: 'Intro',
      title: 'do you hear the birds?',
      questions: [],
      body: [],
      map: {
        center: [10, 50],
        zoom: 3.2,
        source: 'road',
        metric: 'Lden',
        highlightId: null,
      },
    },
    {
      id: 'europe',
      railLabel: 'Europe',
      year: eu.year_label,
      title: 'Above WHO guidance — and highly annoyed',
      questions: [],
      body: [
        `Start with the continent. About ${hi(whoAbove)} people in European cities live in official noise bands that already sit above ${hi('WHO road-traffic guidance')} — the maps only begin counting once levels are past those guidelines.`,
        `From the same maps, roughly ${hi(ha)} people are ${hi('highly annoyed')} by road, rail, or aircraft noise. That is a health burden, not just a count of loud places.`,
        'Next we zoom into Germany’s top high-dB band — and how much of it sits in one city.',
      ],
      map: {
        center: [10, 50],
        zoom: 3.4,
        source: 'road',
        metric: 'Lden',
        highlightId: null,
      },
    },
    {
      id: 'germany',
      railLabel: 'Germany',
      year: de.year_label,
      title: `${formatPeople(de.high_band_people_germany)} people on high dBs — ${de.berlin_share_of_germany_pct}% in Berlin`,
      questions: [],
      body: [
        `Leave the WHO count for a moment and look only at the top high-dB band (above ${hi('75 dB')}, day–evening–night long-term). In German agglomerations that is about ${hi(formatPeople(de.high_band_people_germany))} people — Berlin alone accounts for ${hi(formatPeople(de.high_band_people_berlin))}, or ${hi(`${de.berlin_share_of_germany_pct}%`)} of Germany’s high-band total.`,
        `${hi('Seventy-five dB')} sits between a ${hi('vacuum cleaner (~70 dB)')} and a ${hi('blender (~80–90 dB)')}. Louder places lean toward the blender.`,
        'Those Europe-wide maps are yearly averages. To hear what a single night can feel like, we drop into measured road sites — first Paris.',
      ],
      map: {
        center: [de.lon, de.lat],
        zoom: 7.1,
        source: 'road',
        metric: 'Lden',
        highlightId: de.id,
      },
    },
    {
      id: 'paris',
      railLabel: 'Paris',
      year: paris.year,
      title: `Paris night: ${paris.max_db.toFixed(0)} dB at ${paris.loudest_site}`,
      questions: [],
      body: [
        `In ${paris.year}, night noise at the loudest Paris road site in this set — ${hi(paris.loudest_site)} — reaches about ${hi(`${paris.max_db.toFixed(1)} dB`)}.`,
        `For scale: ${hi(vacuumBlenderCompare(paris.max_db))}.`,
        'Paris gives one night snapshot on a ring road. Madrid’s network shows how a typical night and a peak night can diverge at the same station.',
      ],
      map: {
        center: [paris.lon, paris.lat],
        zoom: 9.2,
        source: 'road',
        metric: 'Lden',
        highlightId: null,
      },
    },
    {
      id: 'madrid',
      railLabel: 'Madrid',
      year: madrid.year,
      title: `Madrid night: station ${madrid.loudest_station_id} peaks near ${madrid.max_db_peak.toFixed(0)} dB`,
      questions: [],
      body: [
        `In ${madrid.year}, night noise at monitoring station ${hi(String(madrid.loudest_station_id))} sits around ${hi(`${madrid.max_db_median.toFixed(0)} dB`)} on a typical night, with peaks near ${hi(`${madrid.max_db_peak.toFixed(0)} dB`)}.`,
        `Typical: ${hi(vacuumBlenderCompare(madrid.max_db_median))}. Peak: ${hi(vacuumBlenderCompare(madrid.max_db_peak))}.`,
        'Point monitors tell one address. Hong Kong instead maps peak traffic noise across the territory — how much ground sits above vacuum-cleaner levels?',
      ],
      map: {
        center: [madrid.lon, madrid.lat],
        zoom: 9.0,
        source: 'road',
        metric: 'Lden',
        highlightId: null,
      },
    },
    {
      id: 'hongkong',
      railLabel: 'Hong Kong',
      year: hk.year,
      title: `Hong Kong: ${hk.pct_valid_gt70.toFixed(0)}% of mapped area above 70 dB`,
      questions: [],
      body: [
        `On the ${hk.year} Hong Kong traffic-noise map, about ${hi(`${hk.pct_valid_gt70.toFixed(1)}%`)} of valid cells exceed ${hi('70 dB')} (~${hi(`${hk.area_km2_gt70.toFixed(0)} km²`)}) — peak traffic noise past a vacuum cleaner, painted across the city rather than at a single mic.`,
        `The loudest cells reach ~${hi(`${hk.max_db.toFixed(0)} dB`)} — ${hi(vacuumBlenderCompare(hk.max_db))}.`,
        'From a continuous surface we go back to a handful of road sites — this time in Seoul — with bubble size showing each place’s mean level.',
      ],
      map: {
        center: [hk.lon, hk.lat],
        zoom: 8.7,
        source: 'road',
        metric: 'Lden',
        highlightId: null,
      },
    },
    {
      id: 'seoul',
      railLabel: 'Seoul',
      year: seoul.year,
      title: `Seoul road sites: ${seoul.loudest_site} leads`,
      questions: [],
      body: [
        `In ${seoul.year}, ${hi(seoul.loudest_site)} leads this Seoul road set (mean ~${hi(`${seoul.max_db_median.toFixed(0)} dB`)}). The highest single reading is about ${hi(`${seoul.max_db_peak.toFixed(0)} dB`)}${seoul.peak_site ? ` at ${hi(seoul.peak_site)}` : ''} — daily road noise at these places.`,
        `Mean at the lead site: ${hi(vacuumBlenderCompare(seoul.max_db_median))}. Peak reading: ${hi(vacuumBlenderCompare(seoul.max_db_peak))}. Bubbles use Latin names; positions are approximate neighborhood geocodes.`,
        'That closes the path from Europe’s burden maps to city measurements. Dismiss any card with ×, or open explore, to pan the map freely.',
      ],
      map: {
        center: [seoul.lon, seoul.lat],
        zoom: 8.9,
        source: 'road',
        metric: 'Lden',
        highlightId: null,
      },
    },
    {
      id: 'explore',
      railLabel: 'Explore',
      title: 'Explore the map',
      questions: [],
      body: [
        'Pan, zoom, and switch noise source freely. Story flying is paused here — use the rail if you want a beat again.',
      ],
      map: {
        center: [10, 48],
        zoom: 3.6,
        source: 'road',
        metric: 'Lden',
        highlightId: null,
      },
      explore: true,
    },
  ]
}
