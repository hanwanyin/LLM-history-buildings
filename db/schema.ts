import { integer, real, sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const sites = sqliteTable("heritage_sites", {
  id: text("id").primaryKey(), name: text("name").notNull(), district: text("district").notNull(),
  address: text("address"), level: text("level"), type: text("type"), age: text("age"),
  material: text("material"), structure: text("structure"), condition: text("condition"),
  opening: text("opening"), tourism: text("tourism"), coreArea: text("core_area"),
  longitude: real("longitude"), latitude: real("latitude"), raw: text("raw").notNull(),
  revision: integer("revision").notNull().default(1), updatedAt: text("updated_at").notNull(),
}, t => [index("site_district_idx").on(t.district), index("site_name_idx").on(t.name)]);
export const indicators = sqliteTable("indicators", {
  id: text("id").primaryKey(), dimension: text("dimension").notNull(),
  category: text("category").notNull(), name: text("name").notNull(), position: integer("position").notNull(),
});
export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(), filename: text("filename").notNull(), sha256: text("sha256").notNull(),
  rows: integer("rows").notNull(), importedRows: integer("imported_rows").notNull(),
  kind: text("kind").notNull(), size: integer("size").notNull(), objectKey: text("object_key"),
  importedAt: text("imported_at").notNull(),
});
export const scores = sqliteTable("scores", {
  id: text("id").primaryKey(), siteId: text("site_id").notNull().references(() => sites.id),
  indicatorId: text("indicator_id").notNull().references(() => indicators.id),
  score: real("score"), confidence: text("confidence"), evidence: text("evidence"),
  reasoning: text("reasoning"), missing: text("missing"), sourceId: text("source_id").notNull().references(() => sources.id),
  sheet: text("sheet").notNull(), rowNumber: integer("row_number").notNull(), raw: text("raw").notNull(),
}, t => [uniqueIndex("site_indicator_unique").on(t.siteId, t.indicatorId), index("score_site_idx").on(t.siteId)]);
export const dimensionScores = sqliteTable("dimension_scores", {
  id: text("id").primaryKey(), siteId: text("site_id").notNull().references(() => sites.id),
  dimension: text("dimension").notNull(), score: real("score"), confidence: text("confidence"),
  evidence: text("evidence"), reasoning: text("reasoning"), missing: text("missing"),
  sourceId: text("source_id").notNull().references(() => sources.id), rowNumber: integer("row_number").notNull(), raw: text("raw").notNull(),
}, t => [uniqueIndex("site_dimension_unique").on(t.siteId, t.dimension)]);
export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(), scoreId: text("score_id").notNull().references(() => scores.id),
  score: real("score").notNull(), note: text("note").notNull(), reviewer: text("reviewer").notNull(),
  createdAt: text("created_at").notNull(),
}, t => [index("review_score_idx").on(t.scoreId)]);
export const currentReviews = sqliteTable("current_reviews", {
  scoreId: text("score_id").primaryKey().references(() => scores.id),
  reviewId: text("review_id").notNull().references(() => reviews.id), revision: integer("revision").notNull(),
});
export const assessmentRuns = sqliteTable("assessment_runs", {
  id: text("id").primaryKey(), siteId: text("site_id").notNull().references(() => sites.id),
  snapshot: text("snapshot").notNull(), createdAt: text("created_at").notNull(), createdBy: text("created_by").notNull(),
}, t => [index("runs_site_idx").on(t.siteId)]);
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(), action: text("action").notNull(), siteId: text("site_id"),
  actor: text("actor").notNull(), details: text("details").notNull(), createdAt: text("created_at").notNull(),
});
export const issues = sqliteTable("data_issues", {
  id: text("id").primaryKey(), siteId: text("site_id"), sourceId: text("source_id"),
  rowNumber: integer("row_number"), kind: text("kind").notNull(), description: text("description").notNull(), raw: text("raw"),
});
export const importChunks = sqliteTable("import_chunks", {
  id: text("id").primaryKey(), digest: text("digest").notNull(), rows: integer("rows").notNull(), createdAt: text("created_at").notNull(),
});
export const spatialMatches = sqliteTable('spatial_matches', {
  siteId: text('site_id').primaryKey().references(()=>sites.id), buildingId: text('building_id'), status: text('status').notNull(),
  originalLon: real('original_lon').notNull(), originalLat: real('original_lat').notNull(),
  longitude: real('longitude').notNull(), latitude: real('latitude').notNull(), distanceM: real('distance_m'),
  height: real('height'), geometry: text('geometry'), candidates: text('candidates').notNull(),
  revision: integer('revision').notNull().default(1), updatedAt: text('updated_at').notNull(),
});

// Unreviewed material is isolated from the original public source tables.
export const knowledgeDocuments=sqliteTable('knowledge_documents',{
  id:text('id').primaryKey(),siteId:text('site_id').references(()=>sites.id),title:text('title').notNull(),kind:text('kind').notNull(),
  filename:text('filename'),mime:text('mime'),size:integer('size'),sha256:text('sha256'),objectKey:text('object_key'),
  sourceUrl:text('source_url'),publisher:text('publisher'),publishedAt:text('published_at'),locator:text('locator').notNull(),
  content:text('content').notNull(),extractionNote:text('extraction_note').notNull(),fingerprint:text('fingerprint').notNull(),
  status:text('status').notNull().default('pending'),createdBy:text('created_by').notNull(),createdAt:text('created_at').notNull(),
  reviewedBy:text('reviewed_by'),reviewedAt:text('reviewed_at'),reviewNote:text('review_note'),revision:integer('revision').notNull().default(1),
},t=>[uniqueIndex('knowledge_fingerprint_unique').on(t.fingerprint),index('knowledge_site_status_idx').on(t.siteId,t.status)]);
export const researchJobs=sqliteTable('research_jobs',{
  id:text('id').primaryKey(),siteId:text('site_id').references(()=>sites.id),query:text('query').notNull(),providers:text('providers').notNull(),
  status:text('status').notNull(),steps:text('steps').notNull(),resultIds:text('result_ids').notNull(),actor:text('actor').notNull(),
  createdAt:text('created_at').notNull(),finishedAt:text('finished_at'),
});
