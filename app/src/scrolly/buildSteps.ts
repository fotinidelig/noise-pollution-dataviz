import type { StoryMetrics, StoryStep } from './storyTypes'
import { formatPeople, soundRange } from './storyTypes'

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
      title: 'How loud is the city?',
      questions: [
        'Where is noise high enough to matter for health?',
        'How do European maps compare with city monitors elsewhere?',
      ],
      body: [
        'Scroll through a short path: Europe-wide health burden, Germany’s high-noise share, then absolute readings from Paris, Madrid, Hong Kong, and Seoul.',
        'Years on each beat label the measurement or reporting year. Explore mode unlocks free map pan/zoom at the end.',
      ],
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
      questions: [
        'How many people live above WHO noise guidance?',
        'How many are highly annoyed by transport noise?',
      ],
      body: [
        `About ${whoAbove} people in European agglomerations live in noise bands that sit above WHO road-traffic guidance (the official maps only start counting from levels already past those guidelines).`,
        `From the same maps, roughly ${ha} people are highly annoyed by road, rail, or aircraft noise — a health burden estimate, not just a count of loud places.`,
        'A later beat looks at the top high-dB band separately. This step stays on WHO exceedance and annoyance.',
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
      questions: [
        'Of everyone in Germany’s top high-noise band, how many live in Berlin?',
        'What everyday sound sits near that level?',
      ],
      body: [
        `In German agglomerations, about ${formatPeople(de.high_band_people_germany)} people fall in the top high-dB band (above 75 dB, day–evening–night long-term). Berlin accounts for ${formatPeople(de.high_band_people_berlin)} of them — ${de.berlin_share_of_germany_pct}% of Germany’s high-band total (about ${de.berlin_share_of_europe_pct}% of Europe’s).`,
        `For scale: ${soundRange(de.common_sound)} (placeholder until Fotini picks a ~75 dB common sound).`,
        'Road-only numbers are smaller; the share above uses road, rail, and aircraft together in that top band.',
      ],
      map: {
        center: [de.lon, de.lat],
        zoom: 9.2,
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
      questions: ['Which Paris road site is loudest at night?', 'How does that compare with a vacuum cleaner?'],
      body: [
        `In ${paris.year}, the loudest night reading among these Paris road sites is about ${paris.max_db.toFixed(1)} dB — night noise at this road site.`,
        `Nearby on the common-sounds scale: ${soundRange(paris.common_sound)}.`,
      ],
      map: {
        center: [paris.lon, paris.lat],
        zoom: 11.5,
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
      questions: ['Where is Madrid’s loudest night station?', 'How extreme is the peak versus a typical night?'],
      body: [
        `In ${madrid.year}, the noisiest night station (id ${madrid.loudest_station_id}) has a median around ${madrid.max_db_median.toFixed(0)} dB and a peak near ${madrid.max_db_peak.toFixed(0)} dB — night noise at this monitoring station.`,
        `For comparison: ${soundRange(madrid.common_sound)}.`,
      ],
      map: {
        center: [madrid.lon, madrid.lat],
        zoom: 11.2,
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
      questions: [
        'How much of the Hong Kong traffic-noise map is very loud?',
        'What area sits above 70 dB peak traffic noise?',
      ],
      body: [
        `On the ${hk.year} Hong Kong traffic-noise map, about ${hk.pct_valid_gt70.toFixed(1)}% of valid cells exceed 70 dB (~${hk.area_km2_gt70.toFixed(0)} km²) — peak traffic noise on that map, not a yearly average.`,
        `Ceiling on the grid: ~${hk.max_db.toFixed(0)} dB. Everyday parallel: ${soundRange(hk.common_sound)}.`,
      ],
      map: {
        center: [hk.lon, hk.lat],
        zoom: 10.8,
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
      questions: ['Which Seoul road site is loudest?', 'How does a daily reading sit against a hair dryer?'],
      body: [
        `In ${seoul.year}, ${seoul.loudest_site} is the loudest Seoul road site in this set (median ~${seoul.max_db_median.toFixed(0)} dB, peak ~${seoul.max_db_peak.toFixed(0)} dB) — daily road noise at this site.`,
        `Common-sound anchor: ${soundRange(seoul.common_sound)}.`,
      ],
      map: {
        center: [seoul.lon, seoul.lat],
        zoom: 11,
        source: 'road',
        metric: 'Lden',
        highlightId: null,
      },
    },
    {
      id: 'explore',
      railLabel: 'Explore',
      title: 'Explore the map',
      questions: ['Which agglomerations stand out near you?', 'How does source choice change the picture?'],
      body: [
        'Pan, zoom, and switch noise source freely. Story flying is paused in this mode.',
        'European agglomeration circles use official long-term maps; city beats used absolute monitors or a traffic-noise surface where noted.',
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
