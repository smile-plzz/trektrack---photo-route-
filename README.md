<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# TrekTrack

TrekTrack maps a route from geotagged photos. Upload JPEG, HEIC, or other browser-supported image files and the app extracts EXIF GPS metadata, draws the route on a Leaflet map, shows elevation stats, opens a photo gallery, and exports GPX.

## What It Does

- Upload photos by click or drag and drop
- Convert HEIC/HEIF images for browser display
- Extract GPS, time, and camera metadata from EXIF
- Plot mapped photos on an interactive Leaflet map
- Review a thumbnail list, stats panel, and elevation profile
- Open a full-screen gallery with keyboard navigation
- Export the mapped route as GPX

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Notes

- The app is client-side only; there is no backend or persistence layer.
- Photos without GPS data still import, but they are marked as `No GPS` and are excluded from map and GPX output.
- Dark and light themes are supported in the UI.
