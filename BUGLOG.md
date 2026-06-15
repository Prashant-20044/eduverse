# EduVerse Bug Log

A running record of every bug found and fixed in this project.
Format: most recent at the top.

---

## [BUG-002] Teacher Slide Broadcast Not Visible to Students in Live Classroom

**Date Fixed:** 2026-06-15
**Severity:** High
**Area:** Frontend (LiveClassRoom UI)

---

### Problem

When a teacher broadcasts a PDF or PowerPoint slide during a live class, students couldn't see the slides—the whiteboard remained visible, and the broadcast was only available as a download link in a separate material panel.

**Expected Behavior:**
- When teacher broadcasts slides, the whiteboard area is replaced with an embedded viewer
- Students can scroll, read, and interact with the slides directly in the main viewing area
- Teacher can click "Stop" to return to the whiteboard
- PDF/PPT files open in an integrated viewer (not a download)

**Actual Behavior (Before):**
- Broadcast showed only a download link in a small materials panel
- Whiteboard remained the primary focus area
- PDF tried to download instead of displaying inline

---

### Root Cause

**File:** `frontend/src/pages/LiveClassRoom.jsx`

1. **Missing conditional render:** The broadcast viewer was only shown to students (`!isTeacher`), not to both roles.
2. **Direct PDF URL:** The broadcast iframe used the raw Cloudinary URL, which triggers a browser download instead of displaying the PDF.
3. **No replacement logic:** The whiteboard was always rendered; the broadcast never replaced it.

---

### Solution Implemented

**File Changes:**
- `frontend/src/pages/LiveClassRoom.jsx`
- `frontend/src/pages/LiveClassRoom.css`

**Key Changes:**

1. **Conditional Render (Teacher & Students):**
   ```jsx
   {broadcastedPpt ? (
     <section className="broadcast-viewer-container">
       {/* Broadcast viewer replaces whiteboard */}
     </section>
   ) : (
     <Whiteboard ... /> {/* Show whiteboard when no broadcast */}
   )}
   ```

2. **PDF Embed Using Google Docs Viewer:**
   ```jsx
   const pdfViewerUrl = broadcastedPpt && isBroadcastPdf
     ? `https://docs.google.com/viewer?url=${encodeURIComponent(broadcastedPpt.url)}&embedded=true`
     : null;
   ```
   - Converts direct PDF URL → Google Docs Viewer URL
   - Displays PDF inline with navigation toolbar, zoom, search
   - No download trigger

3. **Office Online Embed for PPT/PPTX:**
   ```jsx
   const officeViewerUrl = broadcastedPpt && isBroadcastOffice
     ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(broadcastedPpt.url)}`
     : null;
   ```

4. **Stop Broadcast Button (Teacher Only):**
   ```jsx
   {isTeacher && (
     <button className="btn-stop-broadcast" onClick={() => setBroadcastedPpt(null)}>
       ✕ Stop
     </button>
   )}
   ```

5. **CSS Updates:**
   - `.broadcast-viewer-container` — Full-height flex container replacing whiteboard
   - `.broadcast-iframe` — Responsive iframe styling
   - `.btn-stop-broadcast` — Red danger-style button for stopping broadcast
   - `.materials-heading-actions` — Layout for title + filename + stop button

---

### Testing

✅ **Local Verification:**
- Teacher broadcasts PDF → PDF opens in Google Docs Viewer in main area
- Teacher broadcasts PPT → PPT opens via Office Online Viewer
- Teacher clicks "Stop" → Whiteboard returns
- Students see the broadcast without access to stop button
- Scrolling, zoom, page navigation work in viewers

✅ **Build Status:** Clean build, no warnings

**Commits:**
- `60d47f5` — feat: Add broadcast slide viewer with PDF/PPT support and stop broadcast control
- `5ee03df` — fix: Use Google Docs viewer for PDF embed instead of direct download

---

## [BUG-001] PDF Save & PPT Sharing Broken During Live Class

**Date Fixed:** 2026-06-14
**Severity:** Critical
**Area:** Backend (Mongoose Schema) + Upload API + Frontend

---

### Problem

Two features were completely broken in the live classroom:

1. **"Save & Download PDF"** button failed silently — whiteboard snapshots could not be saved to the database, so no PDF could ever be generated.
2. **"Broadcast Slides"** (PPT/PDF upload) also failed to persist materials — uploaded files were not linked to the class in MongoDB.

**Symptoms:**
- Clicking "Save & Download PDF" during a live class produced a `500` error.
- Backend logs showed: `CastError: Cast to string failed for value "[object Object]" at path "materials"`.
- No whiteboard snapshots or uploaded slides were ever saved to the class record in MongoDB.

---

### Root Cause

**File:** `backend/models/Class.js`

The `materials` array used a plain object with a field literally named `type`:

```js
// ❌ BROKEN — Mongoose misinterprets `type` as a schema type keyword
materials: [{
  url: String,
  publicId: String,
  filename: String,
  type: String  // <-- Mongoose treats this as the schema "type" declaration,
                //     not a plain field. The whole subdocument becomes a String.
}]
```

**Why this breaks:** In Mongoose, when you write `{ type: X }` inside a schema object, Mongoose treats it as a type definition, not a field named `type`. Since the object `{ url, publicId, filename, type }` has a `type` key, Mongoose interpreted the entire object as `SchemaString`, and tried to cast the full material object to a string — causing a `CastError` on every `.push()` + `.save()` call.

**Secondary bug:** Cloudinary `resource_type` was set to `'image'` for PDFs, which silently converts the PDF into image pages and returns a non-downloadable URL. PPT/PPTX files were also not handled at all.

---

### Fix

#### 1. `backend/models/Class.js` — Renamed field + proper type syntax

```js
// ✅ FIXED — Wrap each field in { type: ... } and rename `type` → `fileType`
materials: [{
  url:      { type: String },
  publicId: { type: String },
  filename: { type: String },
  fileType: { type: String }  // renamed: 'image' | 'video' | 'pdf' | 'ppt'
                               //          | 'whiteboard-snapshot' | 'whiteboard-notes-pdf'
}]
```

#### 2. `backend/routes/upload.js` — Updated references + Cloudinary resource type

- All `material.type` → `material.fileType`
- Changed `resource_type: 'image'` for PDFs → `resource_type: 'raw'`
- Added PPT/PPTX mime type check:

```js
// ✅ FIXED — Use 'raw' for all document types
const isDocument = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
].includes(file.mimetype);

if (isDocument) resource_type = 'raw';
```

#### 3. `frontend/src/pages/LiveClassRoom.jsx` — Updated references

- All `material.type` → `material.fileType` in filtering and display logic.

---

### Key Mongoose Gotcha (for future reference)

> If you have a field named `type` inside an object in a Mongoose schema, Mongoose will treat the **entire object** as a schema type definition, not as a subdocument with a `type` field.

**Rule:** Never name a plain schema field `type`. Use a descriptive alternative like `fileType`, `category`, `kind`, `variant`, etc. Always wrap fields in `{ type: FieldType }` syntax inside arrays/subdocuments to be explicit.

---

*Add new entries above this line.*

---

## [OPS-001] Enforce BUGLOG updates via pre-commit hook

**Date Fixed:** 2026-06-14
**Severity:** Low
**Area:** Repository tooling / Dev workflow

### Problem

Contributors sometimes forget to add an entry to `BUGLOG.md` when committing bug fixes.

### Fix

- Added `scripts/ensure-buglog.js` — a small git-staged-file checker that fails the commit
  unless `BUGLOG.md` is staged alongside code changes.
- Added `.husky/pre-commit` template and a `prepare` script in `package.json` to help enable
  the hook via Husky (`npm run prepare`).
- Documented the setup and usage in `CONTRIBUTING.md`.

---
