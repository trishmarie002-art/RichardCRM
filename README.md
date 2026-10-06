# Richard Roof CRM

Private roofing CRM for managing leads, customers, pipeline stages, job values, and roof measurements.

## Current MVP

- Dashboard with lead and revenue KPIs
- New roofing lead intake
- Pipeline stages: New Lead, Inspection, Estimate Sent, Won
- Customer/property records
- Notes, lead source, contact info, and potential job value
- Roof surface calculator using footprint area + roof pitch
- Waste factor and roofing-square calculations
- Local browser persistence for MVP testing
- Responsive desktop/mobile interface

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Planned production upgrades

1. Supabase authentication and persistent database
2. Address autocomplete/geocoding
3. Satellite/aerial map roof tracing
4. Polygon area calculation from map geometry
5. Multiple roof facets, pitch, ridge, hip, valley, eave and rake measurements
6. Photo/document uploads
7. Inspection appointments and calendar
8. Estimate builder and PDF proposals
9. Lead import/export
10. Job activity timeline and follow-up reminders

## Roof measurement note

The current calculator converts known horizontal roof footprint area into estimated sloped roof area using pitch factors. It does not claim to derive an accurate roof measurement from an address alone. Aerial imagery and polygon tracing should be added before using it as a remote measurement workflow.
