import {
  formatPeople,
  soundRange,
  type StoryMetrics,
  type StoryStep,
} from './storyTypes'

export function buildSteps(m: StoryMetrics): StoryStep[] {
  const g = m.germany
  const p = m.paris
  const md = m.madrid
  const hk = m.hong_kong
  const s = m.seoul

  return [
    {
      id: 'hero',
      railLabel: 'Hear',
      title: 'do you hear the birds?',
      questions: [],
      body: [
        'A scroll through Europe’s reported noise — and a few cities where monitors and maps still speak in decibels.',
      ],
      map: { center: [10, 50], zoom: 3.2, source: 'road', metric: 'Lden' },
    },
    {
      id: 'europe',
      railLabel: 'Europe',
      year: m.europe.year_label,
      title: 'Europe · END exposure',
      questions: [
        'How many people in Europe are highly annoyed (HA) by environmental noise?',
        'How many people experience sound louder than the WHO suggestions?',
      ],
      body: [
        `In the END 2022 reporting framed for **${m.europe.year_label}**, about **${formatPeople(m.europe.people_highly_annoyed)}** people are modelled as **highly annoyed** (HA) from road, rail and aircraft noise in agglomerations — and about **${formatPeople(m.europe.people_highly_sleep_disturbed)}** as **highly sleep disturbed** (HSD).`,
        `About **${formatPeople(m.europe.people_exposed_lden_end_bands)}** people are counted in END Lden bands (from 55 dB up). WHO road guidance starts near **53 dB Lden** — so these END bands are a practical “louder than WHO” proxy on the map.`,
      ],
      map: { center: [10, 50], zoom: 3.4, source: 'road', metric: 'Lden' },
    },
    {
      id: 'germany',
      railLabel: 'Cologne',
      year: g.year_label,
      title: `${g.agglomeration} · louder than 75 dB`,
      questions: [
        'How many people are exposed to louder than 75 dB sound?',
        'What does a 75 dB sound compare to?',
      ],
      body: [
        `Among German agglomerations, **${g.agglomeration}** has the most people in the top END road band (**>75 dB Lden**, year **${g.year_label}**): about **${formatPeople(g.people_gt75)}** people.`,
        `Around **75 dB**, everyday anchors include **${soundRange(g.common_sound)}** — a roadside snapshot, not a year-long façade average. Treat it as a perceptual compare.`,
      ],
      map: {
        center: [g.lon, g.lat],
        zoom: 9.5,
        source: 'road',
        metric: 'Lden',
        highlightId: g.id,
      },
    },
    {
      id: 'paris',
      railLabel: 'Paris',
      year: p.year,
      title: 'Paris · loudest night monitor',
      questions: [
        `In ${p.year}, which Bruitparif road site had the highest night level (Ln)?`,
        'What everyday sound sits near that level?',
      ],
      body: [
        `**${p.loudest_site}** reaches **${p.max_db.toFixed(1)} dB Ln** in **${p.year}** — the loudest recent permanent road monitor in this Paris open extract.`,
        `Near **${p.max_db.toFixed(0)} dB**: **${soundRange(p.common_sound)}**. Monitor Ln at the kerb is not the same as END modelled Lden for the whole city.`,
      ],
      map: {
        center: [p.lon, p.lat],
        zoom: 11.2,
        source: 'road',
        metric: 'Lnight',
      },
    },
    {
      id: 'madrid',
      railLabel: 'Madrid',
      year: md.year,
      title: 'Madrid · loudest night station',
      questions: [
        `Among focus stations, which is loudest at night in ${md.year}?`,
        'What does that night LAeq feel like?',
      ],
      body: [
        `Station **${md.loudest_station_id}** leads the focus set in **${md.year}** with median night **LAeq ${md.max_db_median.toFixed(1)} dB** (peak reading **${md.max_db_peak.toFixed(1)} dB**).`,
        `Near **${md.max_db_median.toFixed(0)} dB**: **${soundRange(md.common_sound)}**. Madrid figures are measured LAeq by period — not END Lden.`,
      ],
      map: {
        center: [md.lon, md.lat],
        zoom: 10.5,
        source: 'road',
        metric: 'Lnight',
      },
    },
    {
      id: 'hongkong',
      railLabel: 'Hong Kong',
      year: hk.year,
      title: 'Hong Kong · L₁₀ map',
      questions: [
        'How loud does the 2020 traffic L₁₀ map get?',
        'How much of the mapped surface is very loud (>70 dB)?',
      ],
      body: [
        `Peak-hour **L₁₀ (1 h @ 4 m)** in **${hk.year}** reaches about **${hk.max_db.toFixed(0)} dB** on the territory raster — near **${soundRange(hk.common_sound)}**.`,
        `About **${hk.pct_valid_gt70.toFixed(1)}%** of valid cells exceed **70 dB**, covering roughly **${hk.area_km2_gt70.toFixed(0)} km²** (each cell 10×10 m). This is mapped L₁₀ area, not road centreline kilometres.`,
      ],
      map: {
        center: [hk.lon, hk.lat],
        zoom: 10.2,
        source: 'road',
        metric: 'Lden',
      },
    },
    {
      id: 'seoul',
      railLabel: 'Seoul',
      year: s.year,
      title: 'Seoul · loudest road Leq',
      questions: [
        `Which Seoul road site is loudest in ${s.year}?`,
        'What common sound sits nearby?',
      ],
      body: [
        `**${s.loudest_site}** has the highest median daily road **Leq** in **${s.year}**: **${s.max_db_median.toFixed(1)} dB** (daily peak in the file **${s.max_db_peak.toFixed(1)} dB**).`,
        `Near **${s.max_db_median.toFixed(0)} dB**: **${soundRange(s.common_sound)}**. Seoul-only road network extract — not a citywide END map.`,
      ],
      map: {
        center: [s.lon, s.lat],
        zoom: 10.8,
        source: 'road',
        metric: 'Lden',
      },
    },
    {
      id: 'explore',
      railLabel: 'Explore',
      title: 'Explore the map',
      questions: [],
      body: [
        'Full interactive mode: switch sources and metrics, hover cities, pin a place, read the ThemeRiver.',
      ],
      map: { center: [10, 50], zoom: 3.6, source: 'road', metric: 'Lden' },
      explore: true,
    },
  ]
}
