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
      title: 'Do you hear the birds?',
      questions: [],
      body: [
        'Or are our cities too loud? We’ll look at noise levels around Europe and the world to find out.',
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
      title: 'People are quite annoyed by the noise',
      questions: [],
      body: [
        `About ${hi(whoAbove)} people in European cities live in official noise levels that already sit above ${hi('WHO road-traffic guidance')} (~${hi('53 dB')}). Roughly ${hi(ha)} people are ${hi('highly annoyed')} by road, rail, or aircraft noise.`,
        `As a rule of thumb, each ${hi('+10 dB')} sounds about ${hi('twice')} as loud. Exposure at ${hiLoud('≥75 dB')} is about ${hi('4×')} as loud as ${hi('55dB')}. That is the world those highly annoyed people live in.`,
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
      title: `${dePeople} people must listen to a vacuum cleaner all day — ${de.berlin_share_of_germany_pct}% in Berlin`,
      questions: [],
      body: [
        `In German cities, about ${hi(dePeople)} people live with long-term day–evening–night averages above ${hiLoud('75 dB')}. Of them, about ${hi(berlinPeople)} — ${hi(`${de.berlin_share_of_germany_pct}%`)} — are in Berlin.`,
        `${hiLoud('75 dB')} sits between a ${hiLoud('vacuum cleaner (~70 dB)')} and a ${hiLoud('blender (~80–90 dB)')}.`,
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
        `In ${paris.year}, night noise at the loudest Paris road site in this set — ${hi(paris.loudest_site)} — reaches about ${hiDb(paris.max_db, 1)}, between a ${hiLoud('vacuum cleaner (~70 dB)')} and a ${hiLoud('blender (~80–90 dB)')}.`,
        `On the ${paris.end_year ?? 2021} END road maps for the ${hi(paris.agglomeration ?? 'Paris')} agglomeration, about ${hi(formatPeople(paris.road_ha ?? 0))} people are ${hi('highly annoyed')} and about ${hi(formatPeople(paris.road_hsd ?? 0))} are ${hi('highly sleep disturbed')}.`,
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
        `On the ${hk.year} Hong Kong ${hi('citywide traffic-noise map')} (modelled area levels, not one microphone), about ${hi(`${hk.pct_valid_gt70.toFixed(0)}%`)} of the mapped territory sits above ${hiLoud('70 dB')} — roughly ${hi(`${hk.area_km2_gt70.toFixed(0)} km²`)} — past a ${hiLoud('vacuum cleaner')}.`,
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
      title: 'Places where you might hear birds',
      questions: [],
      body: [
        `A Grand Canyon fall night near ${hi('15 dB')} sits far below a vacuum cleaner; a Berlin park hour near ${hi('49 dB')} is calm for a city, not silent.`,
        `From canyon night to a ${hiLoud('vacuum (~70 dB)')} is about ${hi('+55 dB')} — roughly ${hi('five to six doublings')} (~${hi('30–60× as loud')}). From Berlin’s park hour to mapped traffic at ${hiLoud('~75 dB')} is about ${hi('+26 dB')} — roughly ${hi('6× as loud')}.`,
        `Distant bird calls sit around ${hi('44–60 dB')}; dawn-chorus ambient often ${hi('~45–50 dB(A)')} (dense urban choruses higher). Denali (~${hi('18 dB')}) and Haleakalā (~${hi('23 dB')}) leave headroom to hear birds; Stockholm parks (~${hi('55 dB')}) already meet conversation territory — still nowhere near a ${hiLoud('blender (~80–90 dB)')}.`,
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
