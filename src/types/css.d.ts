// Side-effect CSS imports (e.g. `import 'leaflet/dist/leaflet.css'`) carry no types.
// Next handles them at build time, but TypeScript raises TS2882 without a declaration.
declare module '*.css';
