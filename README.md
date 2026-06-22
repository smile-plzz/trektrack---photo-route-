# Expedition Director

A professional-grade expedition analysis platform that transforms photo metadata into a comprehensive tactical mission report.

## Core Features

-   **Telemetry HUD**: Extracts high-precision GPS, altitude, and timestamp data from photo EXIF metadata to reconstruct your route.
-   **AI Tactical Log (Gemini)**: Generates a world-class Expedition Narrative, Tactical Advisories, and key technical milestones using the Gemini 1.5 Flash model.
-   **Physiological Monitoring**: Estimates oxygen saturation (SpO2) and caloric expenditure based on altitude and terrain metrics.
-   **Interactive Cartography**: Dynamic Leaflet maps with real-time photo-to-location mapping and an interactive elevation scrubber.
-   **Anomaly Detection**: Automatically flags GPS "teleportation" or timestamp inconsistencies that suggest data corruption or high-speed displacement.
-   **Mission Intel Sidebar**: Collapsible sidebar for streamlined data density and map-first visualization.

## Technical Stack

-   **Frontend**: React + Vite + Tailwind CSS
-   **Mapping**: Leaflet + React-Leaflet
-   **AI Integration**: @google/genai (Gemini 1.5 Flash) via Express backend
-   **Persistence**: Local state with support for bulk photo uploads
-   **Icons**: Lucide React

## Getting Started

1.  Upload photos from your expedition (files must contain EXIF GPS metadata).
2.  Review the **Telemetry HUD** for live distance, altitude, and pace metrics.
3.  Click **Generate AI Report** to receive the Chief's Log and Tactical Insights.
4.  Navigate the elevation profile to scrub through specific trail segments.

---

*Note: Physiological estimates are algorithmic approximations based on altitude and movement data and should not be used for medical purposes.*
