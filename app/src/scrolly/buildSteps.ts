import type { StoryMetrics, StoryStep } from './storyTypes'
import { formatPeople, vacuumBlenderCompare } from './storyTypes'

/** Cyan body highlight (`**…**` → `.scrolly-hi`). */
function hi(s: string) {
  return `**${s}**`
}

/** Magenta — vacuum / blender / ≥70 dB loudness (`***…***` → `.scrolly-hi--loud`). */
function hiLoud(s: string) {
  return `***${s}***`
}

/** dB figure: magenta from vacuum territory (~70+) upward. */
function hiDb(db: number, digits = 0) {
  const label = `${db.toFixed(digits)} dB`
  return db >= 70 ? hiLoud(label) : hi(label)
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
  const dePeople = formatPeople(de.high_band_people_germany)
  const berlinPeople = formatPeople(de.high_band_people_berlin)

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
        `About ${hi(whoAbove)} people in European cities live in official noise bands that already sit above ${hi('WHO road-traffic guidance')}. From the same maps, roughly ${hi(ha)} people are ${hi('highly annoyed')} by road, rail, or aircraft noise.`,
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
      title: `${dePeople} people on high dBs — ${de.berlin_share_of_germany_pct}% in Berlin`,
      questions: [],
      body: [
        `In German cities, about ${hi(dePeople)} people live with long-term day–evening–night averages above ${hiLoud('75 dB')}. Of them, about ${hi(berlinPeople)} — ${hi(`${de.berlin_share_of_germany_pct}%`)} — are in Berlin.`,
        `${hiLoud('75 dB')} sits between a ${hiLoud('vacuum cleaner (~70 dB)')} and a ${hiLoud('blender (~80–90 dB)')}. Louder places lean toward the blender.`,
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
        `In ${paris.year}, night noise at the loudest Paris road site in this set — ${hi(paris.loudest_site)} — reaches about ${hiDb(paris.max_db, 1)}.`,
        `For scale: ${hiLoud(vacuumBlenderCompare(paris.max_db))}.`,
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
      title: `Madrid night: outdoor station ${madrid.loudest_station_id} peaks near ${madrid.max_db_peak.toFixed(0)} dB`,
      questions: [],
      body: [
        `In ${madrid.year}, night noise at ${hi(`fixed outdoor noise monitoring station ${madrid.loudest_station_id}`)} sits around ${hiDb(madrid.max_db_median)} on a typical night, with peaks near ${hiDb(madrid.max_db_peak)}.`,
        `Typical: ${hiLoud(vacuumBlenderCompare(madrid.max_db_median))}. Peak: ${hiLoud(vacuumBlenderCompare(madrid.max_db_peak))}.`,
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
        `On the ${hk.year} Hong Kong traffic-noise map, about ${hi(`${hk.pct_valid_gt70.toFixed(0)}%`)} of the mapped territory sits above ${hiLoud('70 dB')} — roughly ${hi(`${hk.area_km2_gt70.toFixed(0)} km²`)} — peak traffic noise past a vacuum cleaner, painted across the city rather than at a single mic.`,
        `The loudest places on the map reach about ${hiDb(hk.max_db)} — ${hiLoud(vacuumBlenderCompare(hk.max_db))}.`,
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
      title: `Seoul: highest mean at ${seoul.loudest_site}`,
      questions: [],
      body: [
        `Among eight Seoul road sites in ${seoul.year}, ${hi(seoul.loudest_site)} has the ${hi('highest mean')} — about ${hiDb(seoul.max_db_median)}. The ${hi('highest single reading')} is about ${hiDb(seoul.max_db_peak)}${seoul.peak_site ? ` at ${hi(seoul.peak_site)}` : ''}.`,
        `Mean at ${seoul.loudest_site}: ${hiLoud(vacuumBlenderCompare(seoul.max_db_median))}. Peak reading: ${hiLoud(vacuumBlenderCompare(seoul.max_db_peak))}. Bubble size shows each site’s mean; positions are approximate.`,
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
      id: 'calm',
      railLabel: 'Calm',
      title: 'Toward quieter places',
      questions: [],
      body: [
        `A Grand Canyon fall night near ${hi('15 dB')} sits far below a vacuum cleaner; a Berlin park hour near ${hi('49 dB')} is calm for a city, not silent.`,
        `Denali Birch Creek (~${hi('18 dB')}) and Haleakalā Nuʻu (~${hi('23 dB')}) sit near a ${hi('whisper (~20–30 dB)')}; a quiet-forest sample (~${hi('29 dB')}) and Poland’s Silent Route (~${hi('33 dB')}) land around a ${hi('quiet room (~30–40 dB)')}.`,
        `Hoh River Trail (~${hi('34–38 dB')}) still undercuts casual ${hi('conversation (~60 dB)')}; Stockholm city parks (~${hi('55 dB')}) creep closer — still nowhere near a ${hiLoud('blender (~80–90 dB)')}.`,
      ],
      map: {
        center: [-40, 45],
        zoom: 2.4,
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
        'Pan, zoom, and switch noise source freely. Story flying is paused here — use the rail if you want a beat again. Toggle Calm spaces to revisit quiet anchors.',
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
