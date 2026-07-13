/**
 * One-time offline geocoder. Produces the bundled lookup tables the app ships with,
 * so nothing geocodes at runtime.
 *
 *   node scripts/geocode-camps.mjs            (dev server must be running)
 *   node scripts/geocode-camps.mjs --api=http://localhost:3210
 *
 * Writes:
 *   src/data/camp-coords.json    campId -> { lat, lng, address }
 *   src/data/richmond-zips.json  zip    -> { lat, lng }
 *
 * Nominatim's usage policy requires <=1 req/sec, hence the 1.1s spacing. Re-run only
 * when camp addresses change; results are committed to the repo.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../src/data');

const API = (process.argv.find((arg) => arg.startsWith('--api=')) || '--api=http://localhost:3210').split('=')[1];

// US Census geocoder for street addresses, Zippopotam for zip centroids. Both are
// keyless and US-specific. Nominatim is not used: it 429s this workload outright.
const DELAY_MS = 250;

/** Zips a Richmond-area parent might plausibly type: city, Henrico, Chesterfield, Hanover. */
const RICHMOND_ZIPS = [
  '23005', '23059', '23060', '23063', '23069', '23075', '23103', '23111', '23112', '23113',
  '23114', '23116', '23120', '23124', '23139', '23146', '23150', '23153', '23173', '23192',
  '23219', '23220', '23221', '23222', '23223', '23224', '23225', '23226', '23227', '23228',
  '23229', '23230', '23231', '23233', '23234', '23235', '23236', '23237', '23238', '23250',
  '23284', '23294', '23831', '23832', '23834', '23836', '23838',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A bare "Richmond, VA" or "Multiple Richmond locations" would geocode to the city
 * centroid — a precise-looking pin that is a lie. Those camps get no coordinate.
 */
function isGeocodable(location) {
  if (!location) return false;
  const value = location.replace(/\s+/g, ' ').trim();
  if (!value) return false;

  if (/multiple|various|several|locations across|different locations|club locations/i.test(value)) return false;

  const parts = value
    .replace(/\b\d{5}(-\d{4})?\b/, '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const hasStreetNumber = /\d/.test(value);
  // "Richmond, VA" => 2 parts, no digits => city centroid only.
  return hasStreetNumber || parts.length > 2;
}

async function geocode(query) {
  const url =
    'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress' +
    `?address=${encodeURIComponent(query)}&benchmark=Public_AR_Current&format=json`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const match = data?.result?.addressMatches?.[0];
  if (!match?.coordinates) return null;

  const lat = Number(match.coordinates.y);
  const lng = Number(match.coordinates.x);
  return Number.isNaN(lat) || Number.isNaN(lng) ? null : { lat, lng };
}

async function geocodeZip(zip) {
  const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const place = data?.places?.[0];
  if (!place) return null;

  const lat = Number(place.latitude);
  const lng = Number(place.longitude);
  return Number.isNaN(lat) || Number.isNaN(lng) ? null : { lat, lng };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Fetching camps from ${API}/api/camps …`);
  const response = await fetch(`${API}/api/camps`);
  const { camps } = await response.json();
  if (!Array.isArray(camps)) throw new Error('No camps returned — is the dev server running?');

  const targets = camps.filter((camp) => isGeocodable(camp.location));
  const skipped = camps.length - targets.length;
  console.log(`${camps.length} camps · ${targets.length} geocodable · ${skipped} too vague to place\n`);

  const zipTable = {};
  console.log(`Geocoding ${RICHMOND_ZIPS.length} zips …`);
  for (const zip of RICHMOND_ZIPS) {
    try {
      const result = await geocodeZip(zip);
      if (result) zipTable[zip] = result;
      process.stdout.write(result ? '.' : 'x');
    } catch {
      process.stdout.write('!');
    }
    await sleep(DELAY_MS);
  }
  console.log(`\n  ${Object.keys(zipTable).length}/${RICHMOND_ZIPS.length} zips resolved\n`);

  const campTable = {};
  let hit = 0;
  console.log(`Geocoding ${targets.length} camp addresses …`);
  for (const camp of targets) {
    const address = camp.location.replace(/\s+/g, ' ').trim();
    try {
      const result = await geocode(address);
      if (result) {
        campTable[camp.id] = { ...result, address };
        hit += 1;
        process.stdout.write('.');
      } else {
        process.stdout.write('x');
      }
    } catch {
      process.stdout.write('!');
    }
    await sleep(DELAY_MS);
  }
  console.log(`\n  ${hit}/${targets.length} camps resolved\n`);

  await writeFile(resolve(OUT_DIR, 'richmond-zips.json'), `${JSON.stringify(zipTable, null, 2)}\n`);
  await writeFile(resolve(OUT_DIR, 'camp-coords.json'), `${JSON.stringify(campTable, null, 2)}\n`);

  console.log('Wrote src/data/richmond-zips.json and src/data/camp-coords.json');
  console.log(`Coverage: ${hit}/${camps.length} camps have coordinates.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
