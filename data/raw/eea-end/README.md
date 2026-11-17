# EEA END raw downloads

Hub: https://www.eea.europa.eu/en/datahub/datahubitem-view/c952f520-8d71-42c9-b74c-b7eb002f939b

Downloaded via Nextcloud public WebDAV (`sdi.eea.europa.eu/datashare`) share token `sptXqwkQr5g7Bp5` (public datastore).

## Exposure (tabular)

- Remote folder: `eea_t_noise-exposure-2022_p_2021_v02_r00`
- Local folder: `/Users/luminosa/Documents/ecal/noise-pollution-dataviz/data/raw/eea-end/exposure`

| File | Bytes | URL | Status |
| --- | ---: | --- | --- |

## Contours (vector GeoPackage / 7z)

- Remote folder: `eea_v_3035_1_k_noise-contours-end2022_p_2026_v01_r00`
- Local folder: `/Users/luminosa/Documents/ecal/noise-pollution-dataviz/data/raw/eea-end/contours`
- CRS expected: EPSG:3035 (EEA LAEA) — confirm per layer in analysis.
- Full Europe download is multi‑tens of GB; files are gitignored.

| File | Bytes | URL | Status |
| --- | ---: | --- | --- |
| `README.md` | 1671 | https://sdi.eea.europa.eu/datashare/public.php/webdav/eea_v_3035_1_k_noise-contours-end2022_p_2026_v01_r00/README.md | already_complete |
| `Noise_contours_data_reported_under_Environmental_Noise_Directive_END_2_metadata_853e72e4-4642-47d1-8556-2cc231bd43e0.xml` | 56002 | https://sdi.eea.europa.eu/datashare/public.php/webdav/eea_v_3035_1_k_noise-contours-end2022_p_2026_v01_r00/Noise_contours_data_reported_under_Environmental_Noise_Directive_END_2_metadata_853e72e4-4642-47d1-8556-2cc231bd43e0.xml | already_complete |
| `noise-map.jpg` | 79210 | https://sdi.eea.europa.eu/datashare/public.php/webdav/eea_v_3035_1_k_noise-contours-end2022_p_2026_v01_r00/noise-map.jpg | already_complete |
| `PL.gpkg` | 9299005440 | https://sdi.eea.europa.eu/datashare/public.php/webdav/eea_v_3035_1_k_noise-contours-end2022_p_2026_v01_r00/PL.gpkg | complete |

## Notes

- Use `analysis/scripts/download_eea_end.py` to resume incomplete transfers.
- Contour packages for some EEA countries may be absent from this release folder;
  the file list above is authoritative for what EEA published in this datastore path.
