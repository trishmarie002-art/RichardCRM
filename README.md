# Richard Roof CRM

Private roofing lead and measurement workspace.

## Run

npm ci
npm run dev

## Connections

Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for a dedicated RichardCRM project. Run supabase/schema.sql there. The app includes the dedicated project’s public connection settings in lib/supabase/project.json; environment variables override them. Only public URL and publishable key belong in browser code.

For satellite tracing set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Enable Maps JavaScript API and Geocoding API, activate Google billing, and restrict the browser key to your website domains and those APIs. Do not commit credentials. The key is intentionally public in the browser and must have website restrictions.

## Roof workflow

Choose a customer in Roof Measure. Find the property address, confirm the correct roof, click Trace facet, click corners in order, enter the inspected pitch, and Add facet. Repeat for each facet without overlapping. Alternatively enter known horizontal footprint areas manually. Save Measurement attaches the snapshot to that customer. Selecting that customer again loads the latest saved snapshot, from Supabase when configured or from this browser in demo mode.

Roof surface uses footprint × sqrt(1 + (pitch/12)^2). Waste increases material quantities only. Squares shown include waste; bundles assume three per square and must be checked against the chosen product.

Satellite-derived results are estimates, not certified measurement reports. Pitch is entered manually. Ridge, hip, valley, eave and rake edges can be traced between two map endpoints or entered manually. Edge length uses sqrt(horizontal distance² + endpoint height difference²), assuming a straight edge; pitch alone does not determine hip or valley length. A zero height difference reports horizontal length. Avoid counting shared edges twice. Facets do not automatically detect overlap or roof geometry. Field verification is required before ordering materials.

## Privacy

Cloud access uses Supabase authentication and ownership policies. Measurements can only reference a lead owned by the same user. Keep open registration disabled if this workspace should be limited to your own account. Demo data stays in browser storage and can be lost when browser data is cleared.

## Validation

Production build and TypeScript checks can be run with npm run build. Live satellite and cloud integration checks require configured service credentials.

## Customer and estimate workflows

Customers supports search and editing contact information, property addresses, notes, sources and job value. Pipeline updates and deletions only change the visible records after a successful cloud operation. Deletion requests confirmation and removes related measurements and estimates.

Estimates supports priced line items, loading the latest saved roof squares, customer-specific estimate history, and printing / saving as PDF through the browser print dialog. Each saved estimate includes a snapshot of customer details and pricing. It does not send emails, process payments or change pipeline status. Save each revision as a new estimate.

The estimates table added to supabase/schema.sql must be installed before cloud estimate saving is available. The private login screen has no public sign-up button. Provision the owner's login through Supabase Authentication and disable sign-ups there before deployment. Removing a sign-up button alone does not disable the Auth API.

## Customer workspace

Customer Workspace attaches inspection appointments, follow-up tasks, and activity notes to a chosen lead. Upcoming tasks can be marked complete or reopened, and appointment records can be downloaded as one-hour calendar events (.ics). Dates use the device time zone on input, are stored in UTC, and display in the viewing device time zone. Reminders are visible inside the CRM; no email, SMS, push notification or external calendar synchronization is implemented.

The private customer-files bucket accepts JPG, PNG, WebP and PDF up to 10 MB. Each file is stored under owner UUID / lead UUID / unique filename. Viewing generates a URL valid for 60 seconds. The workspace shows the latest 100 files. Remove uploaded files before deleting their customer.

Database setup for this workspace is in supabase/customer-workspace.sql and has been applied to RichardCRM. Cloud end-to-end testing still requires a confirmed owner login.

Roof edges and facet geometry save with the customer measurement and reload on selection. The customer roof report shows the current workspace, facet areas, net roof squares, separate waste quantities, and edge totals by type. Save Measurement before printing to persist that version. Print / Save PDF uses the browser print dialog; satellite imagery is not included in the report. Live Google Maps tracing remains unverified until a restricted Maps key is configured.
