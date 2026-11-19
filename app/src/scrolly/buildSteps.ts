import type { StoryMetrics, StoryStep } from './storyTypes'
import { formatPeople } from './storyTypes'

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

/** Clear the centered ~420px story card (city sits just right of card edge). */
const CARD_CLEAR_PX = 220
/** Extra ~1/8 of a typical desktop viewport further right (Germany/HK/Seoul). */
const EXTRA_EIGHTH_PX = 180

/**
 * Place the city right of the centered story card.
 * Westward center shift → geographic point sits east of viewport center.
 * MapLibre story easeTo has no padding; pixel→lon uses 512px tiles.
 */
function cardClearCenter(
  lon: number,
  lat: number,
  zoom: number,
  pxRight = CARD_CLEAR_PX,
): [number, number] {
  const lonPerPx = 360 / (512 * 2 ** zoom)
  return [lon - pxRight * lonPerPx, lat]
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
  const hsdMillions = (eu.people_highly_sleep_disturbed / 1_000_000).toFixed(1)
  const dePeople = formatPeople(de.high_band_people_germany)
  const berlinPeople = formatPeople(de.high_band_people_berlin)

  return [
    {
      id: 'hero',
      railLabel: 'Facts',
      // A11y / nav only — Facts UI shows fact boxes alone, no title/subtitle prose.
      title: 'Key noise facts',
      questions: [],
      body: [],
      stats: [
        {
          prefix: 'about',
          value: '1 in 5',
          label: 'EU citizens are affected by noise pollution',
        },
        {
          prefix: 'about',
          value: '500,000',
          label:
            'children have reading difficulties due to frequent traffic noise',
        },
        {
          prefix: 'about',
          value: `${hsdMillions}M`,
          label:
            'people are highly sleep disturbed, sleeping with noise as loud as a vacuum cleaner',
        },
        {
          // Lecocq et al., Science 2020 — global hiFSAN up to about 50% lower (Mar–May 2020).
          value: 'Almost 50%',
          label: 'was the reduction of noise pollution during COVID lockdowns',
        },
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
      id: 'birds',
      railLabel: 'Birds',
      title: 'Do you hear the birds singing?',
      questions: [],
      body: [
        `Or are our cities too loud? Explore ${hi('EU data')} on noise pollution to find out.`,
      ],
      map: {
        center: [10, 50],
        zoom: 3.3,
        source: 'road',
        metric: 'Lden',
        highlightId: null,
      },
    },
    {
      id: 'sounds',
      railLabel: 'Sounds',
      title: 'But what does noise feel like?',
      questions: [],
      // First line above SoundScale; remainder below (see ScrollyApp).
      body: [
        `Let's look at a few sound examples.`,
        `According to WHO, people experiencing ${hi('sleep disturbances')} are chronically exposed to more than ${hiLoud('70 dB')} at night.`,
      ],
      map: {
        center: [10, 50],
        zoom: 3.3,
        source: 'road',
        metric: 'Lden',
        highlightId: null,
      },
    },
    {
      id: 'europe',
      railLabel: 'Europe',
      year: eu.year_label,
      title: 'People are quite annoyed by the noise',
      questions: [],
      body: [
        `About ${hi(whoAbove)} people in European cities live in official noise levels that already sit above ${hi('WHO road-traffic guidance')} (about ${hi('53 dB')}). Roughly ${hi(ha)} people are ${hi('highly annoyed')} by road, rail, or aircraft noise.`,
        `As a rule of thumb, each ${hi('+10 dB')} sounds about ${hi('twice')} as loud. Exposure at ${hiLoud('≥75 dB')} is about ${hi('4×')} as loud as ${hi('55dB')}. That is the world those highly annoyed people live in.`,
      ],
      map: {
        center: [10, 50],
        // Closer Europe frame; center unchanged from intro/sounds.
        zoom: 4.1,
        source: 'road',
        metric: 'Lden',
        highlightId: null,
      },
    },
    {
      id: 'germany',
      railLabel: 'Germany',
      year: de.year_label,
      title: `In Germany ${dePeople} people must listen to a vacuum cleaner all day — ${de.berlin_share_of_germany_pct}% are in Berlin`,
      questions: [],
      body: [
        `In German cities, about ${hi(dePeople)} people live with long-term day–evening–night averages above ${hiLoud('75 dB')}. Of them, about ${hi(berlinPeople)} — ${hi(`${de.berlin_share_of_germany_pct}%`)} — are in Berlin.`,
        `${hiLoud('75 dB')} sits between a ${hiLoud('vacuum cleaner (about 70 dB)')} and a ${hiLoud('blender (about 80–90 dB)')}.`,
      ],
      map: {
        center: cardClearCenter(de.lon, de.lat, 7.1, CARD_CLEAR_PX + EXTRA_EIGHTH_PX),
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
        `In ${paris.year}, night noise at the loudest Paris road site in this set — ${hi(paris.loudest_site)} — reaches about ${hiDb(paris.max_db, 1)}, between a ${hiLoud('vacuum cleaner (about 70 dB)')} and a ${hiLoud('blender (about 80–90 dB)')}.`,
        `According to the data for road maps in Paris, about ${hi(formatPeople(paris.road_ha ?? 0))} people are ${hi('highly annoyed')} and about ${hi(formatPeople(paris.road_hsd ?? 0))} are ${hi('highly sleep disturbed')} due to traffic noise.`,
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
        `In ${madrid.year}, night noise at ${hi(`fixed outdoor noise monitoring station ${madrid.loudest_station_id}`)} sits around ${hiDb(madrid.max_db_median)} on a typical night, with peaks near ${hiDb(madrid.max_db_peak)}. Yes, that's ${hi('2 times')} the noise of a ${hiLoud('vacuum cleaner')}.`,
      ],
      map: {
        center: cardClearCenter(madrid.lon, madrid.lat, 9.0),
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
      title: 'In Hong Kong more than 1 million people are exposed to road traffic higher than 70dBs',
      questions: [],
      body: [
        `UNEP Frontiers 2022: at least ${hi('1 million')} Hong Kong residents live with road traffic above ${hiLoud('70 dB')} — past a ${hiLoud('vacuum cleaner')}.`,
        `On the ${hk.year} Hong Kong ${hi('citywide traffic-noise map')} (modelled area levels, not one microphone), about ${hi(`${hk.pct_valid_gt70.toFixed(0)}%`)} of the mapped territory sits above ${hiLoud('70 dB')} — roughly ${hi(`${hk.area_km2_gt70.toFixed(0)} km²`)}.`,
      ],
      map: {
        center: cardClearCenter(hk.lon, hk.lat, 8.7, CARD_CLEAR_PX + EXTRA_EIGHTH_PX),
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
      ],
      map: {
        center: cardClearCenter(seoul.lon, seoul.lat, 8.9, CARD_CLEAR_PX + EXTRA_EIGHTH_PX),
        zoom: 8.9,
        source: 'road',
        metric: 'Lden',
        highlightId: null,
      },
    },
    {
      id: 'calm',
      railLabel: 'Calm',
      title: 'Places where you might hear birds',
      questions: [],
      body: [
        `A Grand Canyon fall night near ${hi('15 dB')} is quieter than a ${hi('whisper (about 25–30 dB)')}; a Berlin park hour near ${hi('49 dB')} is calm for a city, not silent.`,
        `From Berlin’s park hour to mapped traffic at ${hiLoud('about 75 dB')} is about ${hi('+26 dB')} — roughly ${hi('6× as loud')}.`,
        `Distant bird calls sit around ${hi('44–60 dB')}; dawn-chorus ambient often ${hi('about 45–50 dB(A)')} (dense urban choruses higher). Denali (about ${hi('18 dB')}) and Haleakalā (about ${hi('23 dB')}) leave headroom to hear birds; Stockholm parks (about ${hi('55 dB')}) already meet conversation territory — still nowhere near a ${hiLoud('blender (about 80–90 dB)')}.`,
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
      title: 'Look closer',
      questions: [],
      body: [
        `Zoom into ${hi('countries')} or ${hi('cities')} to see who is most exposed — and explore impacts on ${hi('human annoyance')} and potential ${hi('sleep disturbance')}.`,
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
