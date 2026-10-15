-- REVIEW / ISOLATED DATABASE ONLY. Not applied by this feature build.
-- Preview + production currently share Neon. Never execute from a browser/deploy.
-- No orders, invoices, emails, triggers for external execution, or legacy design access.
CREATE TABLE IF NOT EXISTS olb_shared_projects (
  id UUID PRIMARY KEY,
  owner_user_id VARCHAR(128) NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  document JSONB NOT NULL CHECK (jsonb_typeof(document) = 'object' AND octet_length(document::text) <= 1000000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS olb_shared_projects_owner_idx ON olb_shared_projects(owner_user_id);
CREATE TABLE IF NOT EXISTS olb_shared_spec_revisions (
  project_id UUID NOT NULL REFERENCES olb_shared_projects(id),
  revision INTEGER NOT NULL CHECK (revision > 0),
  actor_user_id VARCHAR(128) NOT NULL,
  request_id UUID NOT NULL,
  request_hash VARCHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  operation VARCHAR(32) NOT NULL,
  component_id VARCHAR(180),
  document JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, revision),
  UNIQUE (project_id, request_id)
);

CREATE OR REPLACE FUNCTION olb_shared_revision_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Shared specification history is immutable'; END $$;
DROP TRIGGER IF EXISTS olb_shared_revision_no_mutation ON olb_shared_spec_revisions;
CREATE TRIGGER olb_shared_revision_no_mutation BEFORE UPDATE OR DELETE ON olb_shared_spec_revisions
FOR EACH ROW EXECUTE FUNCTION olb_shared_revision_immutable();

-- One invocation is one DB transaction. The project row (and first-create advisory
-- key) serializes membership changes, revisions and lost-response retries.
-- SECURITY INVOKER: this function does not grant callers elevated DB privileges.
CREATE OR REPLACE FUNCTION olb_shared_spec_save(
  p_actor TEXT, p_id UUID, p_expected INTEGER, p_request UUID, p_hash TEXT,
  p_document JSONB, p_operation TEXT, p_component_id TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  current_project olb_shared_projects%ROWTYPE;
  prior olb_shared_spec_revisions%ROWTYPE;
  actor_role TEXT;
  next_revision INTEGER;
  changed_at TIMESTAMPTZ := clock_timestamp();
  old_component JSONB;
  new_component JSONB;
  permitted TEXT[];
  changed_key TEXT;
  current_stage TEXT;
  stage_role TEXT;
BEGIN
  IF p_actor !~ '^user_[a-zA-Z0-9]{1,120}$' OR p_hash !~ '^[0-9a-f]{64}$'
    OR p_document->>'id' IS DISTINCT FROM p_id::text OR p_expected < 0
    OR octet_length(p_document::text) > 1000000
    OR jsonb_array_length(p_document->'components') > 500
    OR jsonb_array_length(p_document->'members') > 100 THEN
    RETURN jsonb_build_object('code','forbidden');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  SELECT * INTO current_project FROM olb_shared_projects WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN
    IF p_expected <> 0 OR p_operation <> 'create'
      OR p_document->'members' <> jsonb_build_array(jsonb_build_object('userId',p_actor,'role','owner','active',true))
      OR (p_document->>'specRevision')::integer <> 1 OR p_document->'pilotReviews' <> '[]'::jsonb THEN
      RETURN jsonb_build_object('code','forbidden');
    END IF;
    actor_role := 'owner'; next_revision := 1;
    INSERT INTO olb_shared_projects(id,owner_user_id,revision,document,created_at,updated_at)
      VALUES(p_id,p_actor,1,p_document,changed_at,changed_at);
  ELSE
    SELECT m->>'role' INTO actor_role FROM jsonb_array_elements(current_project.document->'members') m
      WHERE m->>'userId'=p_actor AND m->>'active'='true';
    IF actor_role IS NULL THEN RETURN jsonb_build_object('code','forbidden'); END IF;
    SELECT * INTO prior FROM olb_shared_spec_revisions WHERE project_id=p_id AND request_id=p_request;
    IF FOUND THEN
      IF prior.actor_user_id<>p_actor OR prior.request_hash<>p_hash THEN RETURN jsonb_build_object('code','request-reused'); END IF;
      RETURN jsonb_build_object('code','replayed','record',jsonb_build_object('project',prior.document,'revision',prior.revision,'updatedAt',prior.created_at,'role',actor_role,'replayed',true,'latestRevision',current_project.revision));
    END IF;
    IF current_project.revision <> p_expected OR current_project.revision >= 2147483646 THEN
      RETURN jsonb_build_object('code','conflict','currentRevision',current_project.revision);
    END IF;
    IF p_document->>'sourceBuildId' IS DISTINCT FROM current_project.document->>'sourceBuildId'
      OR p_document->>'name' IS DISTINCT FROM current_project.document->>'name'
      OR (SELECT jsonb_agg(m) FROM jsonb_array_elements(p_document->'members') m WHERE m->>'role'='owner')
          IS DISTINCT FROM (SELECT jsonb_agg(m) FROM jsonb_array_elements(current_project.document->'members') m WHERE m->>'role'='owner') THEN
      RETURN jsonb_build_object('code','forbidden');
    END IF;
    IF p_operation <> 'set-member' AND p_document->'members' IS DISTINCT FROM current_project.document->'members' THEN RETURN jsonb_build_object('code','forbidden'); END IF;
    IF p_operation <> 'review-stage' AND p_document->'pilotReviews' IS DISTINCT FROM current_project.document->'pilotReviews' THEN RETURN jsonb_build_object('code','forbidden'); END IF;
    IF p_operation NOT IN ('patch-component','sync-components') AND p_document->'components' IS DISTINCT FROM current_project.document->'components' THEN RETURN jsonb_build_object('code','forbidden'); END IF;
    IF (p_document->>'specRevision')::integer <> (current_project.document->>'specRevision')::integer + (CASE WHEN p_document->'components' IS DISTINCT FROM current_project.document->'components' THEN 1 ELSE 0 END) THEN RETURN jsonb_build_object('code','forbidden'); END IF;

    IF p_operation='set-member' THEN
      IF actor_role<>'owner' THEN RETURN jsonb_build_object('code','forbidden'); END IF;
    ELSIF p_operation='sync-components' THEN
      IF actor_role NOT IN ('owner','architect','engineer') THEN RETURN jsonb_build_object('code','forbidden'); END IF;
      -- Synchronization is additive. A removed source is marked, never hard-deleted.
      FOR old_component IN SELECT value FROM jsonb_array_elements(current_project.document->'components') LOOP
        SELECT value INTO new_component FROM jsonb_array_elements(p_document->'components') WHERE value->>'id'=old_component->>'id';
        IF new_component IS NULL THEN RETURN jsonb_build_object('code','forbidden'); END IF;
        permitted := ARRAY['name','category','quantity','unit','sourceKey','sourceFingerprint','sourceRemoved'];
        IF new_component->>'unit' IS DISTINCT FROM old_component->>'unit' THEN
          IF NOT (new_component ? 'carbon') THEN permitted := permitted || 'carbon'::text; END IF;
          IF NOT (new_component ? 'cost') AND old_component->'cost'->>'basis' IS DISTINCT FROM 'total' THEN permitted := permitted || 'cost'::text; END IF;
        END IF;
        FOR changed_key IN SELECT key FROM (SELECT jsonb_object_keys(old_component) AS key UNION SELECT jsonb_object_keys(new_component)) keys LOOP
          IF old_component->changed_key IS DISTINCT FROM new_component->changed_key AND NOT changed_key=ANY(permitted) THEN RETURN jsonb_build_object('code','forbidden'); END IF;
        END LOOP;
      END LOOP;
    ELSIF p_operation='patch-component' THEN
      SELECT value INTO old_component FROM jsonb_array_elements(current_project.document->'components') WHERE value->>'id'=p_component_id;
      SELECT value INTO new_component FROM jsonb_array_elements(p_document->'components') WHERE value->>'id'=p_component_id;
      IF old_component IS NULL OR new_component IS NULL OR old_component->>'id'<>new_component->>'id'
        OR (SELECT COALESCE(jsonb_agg(value),'[]'::jsonb) FROM jsonb_array_elements(p_document->'components') WHERE value->>'id'<>p_component_id)
           IS DISTINCT FROM (SELECT COALESCE(jsonb_agg(value),'[]'::jsonb) FROM jsonb_array_elements(current_project.document->'components') WHERE value->>'id'<>p_component_id) THEN RETURN jsonb_build_object('code','forbidden'); END IF;
      IF actor_role='supplier' AND old_component->>'assigneeUserId' IS DISTINCT FROM p_actor THEN RETURN jsonb_build_object('code','forbidden'); END IF;
      permitted := CASE actor_role
        WHEN 'client' THEN ARRAY['notes']
        WHEN 'contractor' THEN ARRAY['deliveryDate','responsibleParty','status','notes']
        WHEN 'supplier' THEN ARRAY['material','cost','carbon','deliveryDate','status','sources','notes','origin']
        WHEN 'architect' THEN ARRAY['name','material','quantity','unit','category','sourceKey','sourceFingerprint','sourceRemoved','cost','carbon','deliveryDate','responsibleParty','assigneeUserId','status','sources','notes','origin']
        ELSE ARRAY['name','material','quantity','unit','category','sourceKey','sourceFingerprint','sourceRemoved','cost','carbon','deliveryDate','responsibleParty','assigneeUserId','status','sources','notes','origin','analysis'] END;
      IF trim(new_component->>'material') IS DISTINCT FROM trim(old_component->>'material') THEN
        IF NOT (new_component ? 'analysis') THEN permitted := permitted || 'analysis'::text;
        ELSIF actor_role NOT IN ('owner','engineer') THEN RETURN jsonb_build_object('code','forbidden'); END IF;
      END IF;
      FOR changed_key IN SELECT key FROM (SELECT jsonb_object_keys(old_component) AS key UNION SELECT jsonb_object_keys(new_component)) keys LOOP
        IF old_component->changed_key IS DISTINCT FROM new_component->changed_key AND NOT changed_key=ANY(permitted) THEN RETURN jsonb_build_object('code','forbidden'); END IF;
      END LOOP;
    ELSIF p_operation='review-stage' THEN
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(current_project.document->'pilotReviews') old_review WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_document->'pilotReviews') new_review WHERE new_review->>'stageId'=old_review->>'stageId')) THEN RETURN jsonb_build_object('code','forbidden'); END IF;
      FOR new_component IN SELECT value FROM jsonb_array_elements(p_document->'pilotReviews') LOOP
        SELECT value INTO old_component FROM jsonb_array_elements(current_project.document->'pilotReviews') WHERE value->>'stageId'=new_component->>'stageId';
        IF old_component IS DISTINCT FROM new_component THEN
          current_stage := new_component->>'stageId';
          stage_role := CASE current_stage WHEN 'engineering' THEN 'engineer' WHEN 'supplier' THEN 'supplier' WHEN 'logistics' THEN 'contractor' WHEN 'client' THEN 'client' WHEN 'release' THEN 'owner' ELSE NULL END;
          IF (stage_role IS NOT NULL AND actor_role<>stage_role)
            OR (current_stage IN ('geometry','materials') AND actor_role NOT IN ('architect','engineer'))
            OR (current_stage='brief' AND actor_role NOT IN ('owner','architect'))
            OR new_component->>'actorUserId'<>p_actor
            OR (new_component->>'basisRevision')::integer<>(current_project.document->>'specRevision')::integer THEN RETURN jsonb_build_object('code','forbidden'); END IF;
          IF new_component->>'decision'='accepted' THEN
            IF current_stage IN ('geometry','materials','supplier','logistics','release') AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_document->'components') c WHERE c->>'sourceRemoved'='false') THEN RETURN jsonb_build_object('code','forbidden'); END IF;
            IF current_stage IN ('materials','release') AND EXISTS (SELECT 1 FROM jsonb_array_elements(p_document->'components') c WHERE c->>'sourceRemoved'='false' AND (length(trim(COALESCE(c->>'material','')))=0 OR jsonb_array_length(c->'sources')=0)) THEN RETURN jsonb_build_object('code','forbidden'); END IF;
            IF current_stage IN ('logistics','release') AND EXISTS (SELECT 1 FROM jsonb_array_elements(p_document->'components') c WHERE c->>'sourceRemoved'='false' AND (length(trim(COALESCE(c->>'responsibleParty','')))=0 OR COALESCE(c->>'deliveryDate','')='')) THEN RETURN jsonb_build_object('code','forbidden'); END IF;
            IF current_stage IN ('supplier','release') AND EXISTS (SELECT 1 FROM jsonb_array_elements(p_document->'components') c WHERE c->>'sourceRemoved'='false' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_document->'members') m WHERE m->>'active'='true' AND m->>'role'='supplier' AND m->>'userId'=c->>'assigneeUserId')) THEN RETURN jsonb_build_object('code','forbidden'); END IF;
          END IF;
          IF current_stage='release' AND new_component->>'decision'='accepted' AND EXISTS (
            SELECT 1 FROM unnest(ARRAY['brief','geometry','materials','engineering','supplier','logistics','client']) required_stage
            WHERE NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements(p_document->'pilotReviews') review
              JOIN jsonb_array_elements(p_document->'members') member ON member->>'userId'=review->>'actorUserId' AND member->>'active'='true'
              WHERE review->>'stageId'=required_stage AND review->>'decision'='accepted'
                AND (review->>'basisRevision')::integer=(p_document->>'specRevision')::integer
                AND member->>'role'=ANY(CASE required_stage WHEN 'brief' THEN ARRAY['owner','architect'] WHEN 'geometry' THEN ARRAY['architect','engineer'] WHEN 'materials' THEN ARRAY['architect','engineer'] WHEN 'engineering' THEN ARRAY['engineer'] WHEN 'supplier' THEN ARRAY['supplier'] WHEN 'logistics' THEN ARRAY['contractor'] ELSE ARRAY['client'] END)
            )
          ) THEN RETURN jsonb_build_object('code','forbidden'); END IF;
        END IF;
      END LOOP;
    ELSE RETURN jsonb_build_object('code','forbidden');
    END IF;
    next_revision := current_project.revision+1;
    UPDATE olb_shared_projects SET document=p_document,revision=next_revision,updated_at=changed_at WHERE id=p_id;
  END IF;
  INSERT INTO olb_shared_spec_revisions(project_id,revision,actor_user_id,request_id,request_hash,operation,component_id,document,created_at)
    VALUES(p_id,next_revision,p_actor,p_request,p_hash,p_operation,p_component_id,p_document,changed_at);
  RETURN jsonb_build_object('code','saved','record',jsonb_build_object('project',p_document,'revision',next_revision,'updatedAt',changed_at,'role',actor_role));
END $$;

-- Database credentials stay server-only. Never expose this schema/function to an
-- unauthenticated SQL gateway or execute grants to public browser users.
