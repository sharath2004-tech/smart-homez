# Deep Cleaning Template Blueprint

## Goal

Build a **full deep-cleaning template system** that:
- supports multiple deep-cleaning service types
- supports mini services and add-ons
- allows **admins to request changes**
- allows **super admins to approve / reject / publish** template changes
- keeps customer experience structured and scalable

---

## 1. Product structure

### Parent category
- `deep_cleaning`

### Service groups under deep cleaning
1. Full Home Deep Cleaning
2. Move In / Move Out Cleaning
3. Kitchen Deep Cleaning
4. Bathroom Deep Cleaning
5. Furniture & Fabric Cleaning
6. Utility / Surface Cleaning
7. Commercial Deep Cleaning
8. Mini Services / Spot Deep Cleaning

### Sample services

#### Full home
- 1 BHK Deep Cleaning
- 2 BHK Deep Cleaning
- 3 BHK Deep Cleaning
- 4+ BHK Deep Cleaning
- Villa Deep Cleaning
- Duplex Deep Cleaning
- Post Renovation Deep Cleaning
- Move In / Move Out Cleaning

#### Kitchen
- Kitchen Deep Cleaning
- Heavy Grease Kitchen Cleaning
- Chimney + Hob Cleaning
- Cabinet Interior Cleaning
- Fridge + Microwave Cleaning

#### Bathroom
- Bathroom Deep Cleaning
- Hard Water Stain Removal
- Shower Glass Restoration
- Toilet Descaling
- Tile & Grout Scrubbing

#### Furniture & fabric
- Sofa Shampooing
- Mattress Deep Cleaning
- Carpet Cleaning
- Curtain Steam Cleaning
- Dining Chair Cleaning

#### Utility & surfaces
- Window Deep Cleaning
- Fan Cleaning
- Balcony Deep Cleaning
- Utility Area Cleaning
- Floor Scrubbing & Polishing
- Wall Spot Cleaning

#### Commercial
- Office Deep Cleaning
- Restaurant Deep Cleaning
- Clinic Cleaning
- Retail Store Cleaning
- Salon / Spa Cleaning

#### Mini services
- Chimney Cleaning
- Hob Cleaning
- Fridge Cleaning
- Microwave Cleaning
- Fan Cleaning
- Single Bathroom Deep Clean
- Single Room Deep Clean
- Balcony Wash
- Single Sofa Seat Cleaning
- Single Mattress Cleaning

---

## 2. Core template engine

Instead of building one page per service, create a **template engine**.

### Reusable page blocks
1. `ServiceHero`
2. `ServiceHighlights`
3. `PropertyScopeSelector`
4. `RoomCounterSelector`
5. `ConditionSelector`
6. `PackageSelector`
7. `AddonSelector`
8. `IncludedChecklist`
9. `ExclusionsBlock`
10. `PricingSummary`
11. `RecommendedServices`
12. `FAQBlock`
13. `BookingCTA`
14. `QuoteCTA`

### Customer flows supported
- `instant_book`
- `package_book`
- `quote_required`
- `addon_only`

---

## 3. Recommended template schema

## DeepCleaningTemplate

```ts
{
  _id,
  slug,
  name,
  category: 'deep_cleaning',
  subCategory,
  serviceMode, // instant_book | package_book | quote_required | addon_only
  isActive,
  visibility,

  hero: {
    title,
    subtitle,
    badge,
    image,
    icon
  },

  pricing: {
    pricingType, // fixed | tier | formula | quote
    basePrice,
    currency,
    tiers: [],
    formulaRules: [],
    quoteRequiredAbove
  },

  scopeConfig: {
    propertyTypes: [],
    bhkOptions: [],
    roomCounters: [],
    conditionLevels: [],
    occupancyOptions: [],
    durationOptions: []
  },

  packages: [
    {
      id,
      name,
      description,
      durationMinutes,
      workerCount,
      price,
      includedItems: []
    }
  ],

  addons: [
    {
      id,
      name,
      type, // fixed | per_unit | per_room
      price,
      unit,
      isMiniService,
      isActive
    }
  ],

  includedChecklist: [],
  exclusions: [],
  faqs: [],
  upsells: [],
  seo: {
    title,
    description
  },

  workflow: {
    bookingFormType,
    requiresInspection,
    allowsSlotSelection,
    allowsPhotoUpload,
    requiresAdminApproval
  },

  audit: {
    publishedVersion,
    draftVersion,
    lastPublishedAt,
    updatedBy
  }
}
```

---

## 4. Admin + Super Admin governance workflow

This is the important part you asked for.

### Roles
- **Admin**
  - can view templates
  - can create a draft change request
  - can request updates to content, pricing, add-ons, display order, inclusions/exclusions
  - cannot directly publish if governance is enabled

- **Super Admin**
  - can create templates
  - can edit drafts directly
  - can approve / reject admin change requests
  - can publish template versions live
  - can roll back to older versions

---

## 5. Change request model

Create a separate model:

## TemplateChangeRequest

```ts
{
  _id,
  templateId,
  requestedBy,
  requesterRole, // admin | super_admin
  requestType,   // create | update | deactivate | reorder | pricing_change
  summary,
  reason,
  status,        // pending | approved | rejected | published

  proposedChanges: {
    hero,
    pricing,
    scopeConfig,
    packages,
    addons,
    includedChecklist,
    exclusions,
    faqs,
    upsells,
    workflow
  },

  review: {
    reviewedBy,
    reviewedAt,
    reviewNotes
  },

  publishInfo: {
    publishedBy,
    publishedAt,
    version
  },

  createdAt,
  updatedAt
}
```

---

## 6. Workflow states

### Admin submits change
1. Admin opens template editor
2. Admin edits a draft
3. Admin clicks **Submit for Approval**
4. Change request status becomes `pending`

### Super admin reviews
5. Super admin compares current vs proposed
6. Super admin can:
   - approve
   - reject
   - request revision
   - publish immediately

### Publish flow
7. Once approved, template draft becomes a new version
8. Production template updates for customers
9. Older version remains available for rollback

---

## 7. Recommended admin UI

### Admin side
- Template list
- Search by category / subcategory
- Draft editor
- Save draft
- Submit request
- Request history

### Super admin side
- All templates dashboard
- Pending requests queue
- Side-by-side diff viewer
- Approve / reject / publish controls
- Version history
- Rollback action

---

## 8. Template editor sections

The editor should have tabs like:

1. Basic Info
2. Hero Section
3. Pricing
4. Packages
5. Scope Rules
6. Add-ons / Mini Services
7. Included / Excluded
8. FAQs
9. Recommended Services
10. Workflow Rules
11. Preview
12. Publish / Submit for Approval

---

## 9. Customer experience

### Deep cleaning landing page
Show major cards:
- Full Home Deep Cleaning
- Move In / Move Out
- Kitchen Deep Cleaning
- Bathroom Deep Cleaning
- Sofa / Mattress / Carpet
- Commercial Deep Cleaning

### Mini services strip
Horizontal or grid section:
- Chimney
- Hob
- Fridge
- Microwave
- Fan
- Balcony
- Window
- Shower glass
- Hard water removal

### Each template page shows
- service hero
- package/scope selector
- add-ons
- included items
- exclusions
- duration and price summary
- CTA: Book now / Request quote

---

## 10. Pricing strategy

### Fixed pricing
Use for mini services
- chimney cleaning
- mattress cleaning
- balcony wash
- fan cleaning

### Tier pricing
Use for home-size packages
- 1 BHK / 2 BHK / 3 BHK / villa

### Formula pricing
Use when price depends on inputs
- room counts
- dirt level
- furnished/unfurnished
- extra bathrooms
- balcony count

### Quote pricing
Use for complex jobs
- move in / move out
- commercial
- post-renovation
- heavy condition cleaning

---

## 11. Versioning rules

Each published template should have:
- `versionNumber`
- `publishedAt`
- `publishedBy`
- `changeSummary`

### Example
- v1 = base template
- v2 = add chimney cleaning add-on
- v3 = update pricing for villa package

This prevents direct risky edits on live data.

---

## 12. Suggested backend APIs

### Customer APIs
- `GET /api/deep-cleaning/templates`
- `GET /api/deep-cleaning/templates/:slug`
- `POST /api/deep-cleaning/book`
- `POST /api/deep-cleaning/quote`

### Admin APIs
- `GET /api/admin/deep-cleaning/templates`
- `POST /api/admin/deep-cleaning/templates/:id/draft`
- `POST /api/admin/deep-cleaning/change-requests`
- `GET /api/admin/deep-cleaning/change-requests/mine`

### Super admin APIs
- `GET /api/super-admin/deep-cleaning/change-requests`
- `PATCH /api/super-admin/deep-cleaning/change-requests/:id/approve`
- `PATCH /api/super-admin/deep-cleaning/change-requests/:id/reject`
- `POST /api/super-admin/deep-cleaning/templates/:id/publish`
- `POST /api/super-admin/deep-cleaning/templates/:id/rollback`

---

## 13. Suggested frontend files

### Customer
- `src/pages/customer/DeepCleaningLandingPage.tsx`
- `src/pages/customer/templates/DeepCleaningTemplateRenderer.tsx`
- `src/pages/customer/templates/config/`

### Admin
- `src/pages/admin/AdminDeepCleaningTemplates.tsx`
- `src/pages/admin/AdminDeepCleaningTemplateEditor.tsx`
- `src/pages/admin/AdminTemplateRequests.tsx`

### Super admin
- `src/pages/superadmin/SuperAdminDeepCleaningTemplates.tsx`
- `src/pages/superadmin/SuperAdminTemplateReview.tsx`
- `src/pages/superadmin/SuperAdminTemplateVersions.tsx`

### Shared components
- `src/components/deep-cleaning/ServiceHero.tsx`
- `src/components/deep-cleaning/PackageSelector.tsx`
- `src/components/deep-cleaning/AddonSelector.tsx`
- `src/components/deep-cleaning/PricingSummary.tsx`
- `src/components/deep-cleaning/TemplatePreview.tsx`

---

## 14. Rollout plan

### Phase 1
Build landing page + 3 template types
- Full Home
- Kitchen
- Bathroom

### Phase 2
Add mini services
- chimney
- mattress
- fan
- balcony
- window

### Phase 3
Add admin template editor + request flow

### Phase 4
Add super admin approval + publish + versioning

### Phase 5
Add formula pricing + preview mode

---

## 15. Best final recommendation

For your app, the cleanest model is:

- **Admin can propose changes**
- **Super admin controls publishing**
- **Templates are versioned**
- **One renderer serves many deep-cleaning services**
- **Mini services are just smaller templates or add-on-enabled templates**

This gives you:
- fast expansion of new services
- safe governance
- reusable UI
- scalable pricing logic
- fewer hardcoded pages

---

## 16. MVP to build first

If building now, start with:
1. Deep cleaning landing page
2. Template renderer
3. Three configs:
   - full-home
   - kitchen
   - bathroom
4. Add-ons system
5. Admin request model
6. Super admin publish flow
