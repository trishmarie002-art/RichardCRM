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

The private customer-files bucket accepts JPG, PNG, WebP, PDF, MP4, MOV, WebM and M4V up to 50 MB per file. Customer Workspace retains its 10 MB photo/PDF picker; Lead Files provides the full media upload workflow. Each file is stored under owner UUID / lead UUID / unique filename. Viewing generates a URL valid for 60 seconds. The workspace shows the latest 100 files. Remove uploaded files before deleting their customer.

Database setup for this workspace is in supabase/customer-workspace.sql and has been applied to RichardCRM. Cloud end-to-end testing still requires a confirmed owner login.

Roof edges and facet geometry save with the customer measurement and reload on selection. The customer roof report shows the current workspace, facet areas, net roof squares, separate waste quantities, and edge totals by type. Save Measurement before printing to persist that version. Print / Save PDF uses the browser print dialog; satellite imagery is not included in the report. Live Google Maps tracing remains unverified until a restricted Maps key is configured.

Saved estimates now have owner-recorded Draft, Sent, Accepted and Declined statuses with the last status update time. These are bookkeeping labels, not electronic signatures or delivery confirmations; the lead pipeline stays separate. Create revision copies pricing and notes into the builder, then Save estimate creates a new Draft snapshot. The database grants updates only to the two status columns so saved customer details and pricing remain immutable.

## Personal Daily Schedule

Daily Schedule is a private personal task list with a day picker, optional local time and notes, add/edit/delete, and a clickable completion circle that also reopens a task. It has no customer or job links, and customer deletion does not affect it. Tasks persist in the personal_tasks table with owner-only access; local demo tasks use separate browser storage. Dates and times are wall-clock schedule entries without time-zone conversion. No external reminders are sent. Database setup is supabase/personal-tasks.sql.

## Jobs and material templates

Jobs tracks customer-linked roofing work through Planning, Scheduled, In progress, Completed and Cancelled. Each job has an optional installation date, crew, materials, notes and a five-step checklist. Creating or completing jobs does not change the lead pipeline or an estimate status. Customer deletion cascades to jobs; personal schedule tasks remain separate. Jobs are created manually after confirming the scope.

In Estimates, save valid line items as a named material template and append template items to a new quote. Stored quantities and rates are copied literally, not scaled from roof geometry. Review quantities, units in descriptions, prices and waste before saving. Templates persist separately from customers and saved estimates; deleting a template does not change existing quotes. To change a template, save a new package and delete the old one. Database setup is supabase/jobs-and-templates.sql, applied to the dedicated RichardCRM project.

## Star Roofing proposals

New estimates snapshot Star Roofing LLC contact details from starroofingtx.com: (210) 264-5707, starroofing10@gmail.com, and San Antonio Texas & surrounding areas. The builder has separate scope, warranty, exclusions and payment terms; no warranty promises or payment requirements are prefilled. Terms persist with each quote and copy into revisions. Existing quotes without proposal data print the current company details with unspecified terms. Print / Save PDF uses a branded header and attempts to load the website logo; if it fails, company text still prints. The remote logo could not be downloaded in this environment due to the website’s challenge page; live printing and logo loading remain unverified.

## Invoices and payments

Invoices supports one invoice per job, owner-unique invoice numbers, total, requested deposit, optional due date and notes. Record each actual receipt as Payment or Deposit with date, method and reference. Deposits are included once in all payments received; requested deposits never count as receipts. Integer cents avoid rounding drift. Balance is total minus receipts, with excess receipts displayed as an overpayment. This is manual bookkeeping, not payment processing, refunds or a tax/accounting system. Corrections remove an incorrect payment entry after confirmation; this is not a permanent audit trail. Invoices cannot be deleted in the UI, and database foreign keys protect invoiced jobs/customers from deletion. Invoice printing uses current customer/job details and Star Roofing contact details. Database setup is supabase/invoices-and-payments.sql.

## Lead Files

Choose a lead in Lead Files to upload multiple roof photos, inspection videos and PDFs. Files use the same private customer-files bucket and owner/lead folders as Customer Workspace, so existing uploads appear without duplication. View photos and browser-supported video formats, open PDFs, download and confirm deletion. Filter the loaded list by Photos, Videos or Documents; Load more retrieves another 50 files. Uploads are sequential with batch status and individual errors; interrupted uploads must be retried and are not resumable. Max 50 MB per file, subject to the project global storage limit. Video playback depends on codec support. View links expire after one hour and download links after 60 seconds. Storage configuration and the explicitly qualified owner/lead policies are in supabase/lead-media.sql. Actual authenticated browser upload/playback still requires verification.
