-- ──────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) MIGRATION FOR ALL 22 TABLES
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Helper Functions for Authentication Context
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS text AS $$
BEGIN
  -- Check session setting (e.g. SET LOCAL app.current_user_id = '...')
  -- or fallback to JWT / claim variables if available
  RETURN COALESCE(
    NULLIF(current_setting('app.current_user_id', true), ''),
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', NULL)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION app_is_admin() RETURNS boolean AS $$
DECLARE
  v_role text;
  v_uid text;
BEGIN
  v_uid := app_current_user_id();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT role::text INTO v_role FROM "User" WHERE id = v_uid;
  RETURN (v_role = 'ADMIN');
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Enable Row Level Security on all 22 tables
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Submission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductMaker" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommentFlag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RankSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevenueConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductRevenue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevenueSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeaturedSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeaturedPurchase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AutomationRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebIndexingLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DirectoryLead" ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Drop existing policies to ensure clean idempotency
-- ──────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_select_public" ON "User";
DROP POLICY IF EXISTS "user_select_self" ON "User";
DROP POLICY IF EXISTS "user_update_self" ON "User";
DROP POLICY IF EXISTS "user_admin_all" ON "User";
DROP POLICY IF EXISTS "user_server_bypass" ON "User";

DROP POLICY IF EXISTS "session_self_all" ON "Session";
DROP POLICY IF EXISTS "session_admin_all" ON "Session";
DROP POLICY IF EXISTS "session_server_bypass" ON "Session";

DROP POLICY IF EXISTS "account_self_all" ON "Account";
DROP POLICY IF EXISTS "account_admin_all" ON "Account";
DROP POLICY IF EXISTS "account_server_bypass" ON "Account";

DROP POLICY IF EXISTS "verification_admin_all" ON "Verification";
DROP POLICY IF EXISTS "verification_server_bypass" ON "Verification";

DROP POLICY IF EXISTS "submission_owner_select" ON "Submission";
DROP POLICY IF EXISTS "submission_owner_insert" ON "Submission";
DROP POLICY IF EXISTS "submission_owner_update" ON "Submission";
DROP POLICY IF EXISTS "submission_admin_all" ON "Submission";
DROP POLICY IF EXISTS "submission_server_bypass" ON "Submission";

DROP POLICY IF EXISTS "product_public_select" ON "Product";
DROP POLICY IF EXISTS "product_maker_select" ON "Product";
DROP POLICY IF EXISTS "product_maker_modify" ON "Product";
DROP POLICY IF EXISTS "product_admin_all" ON "Product";
DROP POLICY IF EXISTS "product_server_bypass" ON "Product";

DROP POLICY IF EXISTS "productmaker_public_select" ON "ProductMaker";
DROP POLICY IF EXISTS "productmaker_modify" ON "ProductMaker";
DROP POLICY IF EXISTS "productmaker_admin_all" ON "ProductMaker";
DROP POLICY IF EXISTS "productmaker_server_bypass" ON "ProductMaker";

DROP POLICY IF EXISTS "category_public_select" ON "Category";
DROP POLICY IF EXISTS "category_admin_all" ON "Category";
DROP POLICY IF EXISTS "category_server_bypass" ON "Category";

DROP POLICY IF EXISTS "vote_public_select" ON "Vote";
DROP POLICY IF EXISTS "vote_user_modify" ON "Vote";
DROP POLICY IF EXISTS "vote_admin_all" ON "Vote";
DROP POLICY IF EXISTS "vote_server_bypass" ON "Vote";

DROP POLICY IF EXISTS "comment_public_select" ON "Comment";
DROP POLICY IF EXISTS "comment_user_insert" ON "Comment";
DROP POLICY IF EXISTS "comment_user_modify" ON "Comment";
DROP POLICY IF EXISTS "comment_admin_all" ON "Comment";
DROP POLICY IF EXISTS "comment_server_bypass" ON "Comment";

DROP POLICY IF EXISTS "commentflag_user_insert" ON "CommentFlag";
DROP POLICY IF EXISTS "commentflag_admin_all" ON "CommentFlag";
DROP POLICY IF EXISTS "commentflag_server_bypass" ON "CommentFlag";

DROP POLICY IF EXISTS "ranksnapshot_public_select" ON "RankSnapshot";
DROP POLICY IF EXISTS "ranksnapshot_admin_all" ON "RankSnapshot";
DROP POLICY IF EXISTS "ranksnapshot_server_bypass" ON "RankSnapshot";

DROP POLICY IF EXISTS "revenueconnection_owner_all" ON "RevenueConnection";
DROP POLICY IF EXISTS "revenueconnection_admin_all" ON "RevenueConnection";
DROP POLICY IF EXISTS "revenueconnection_server_bypass" ON "RevenueConnection";

DROP POLICY IF EXISTS "productrevenue_public_select" ON "ProductRevenue";
DROP POLICY IF EXISTS "productrevenue_owner_modify" ON "ProductRevenue";
DROP POLICY IF EXISTS "productrevenue_admin_all" ON "ProductRevenue";
DROP POLICY IF EXISTS "productrevenue_server_bypass" ON "ProductRevenue";

DROP POLICY IF EXISTS "revenuesnapshot_owner_select" ON "RevenueSnapshot";
DROP POLICY IF EXISTS "revenuesnapshot_admin_all" ON "RevenueSnapshot";
DROP POLICY IF EXISTS "revenuesnapshot_server_bypass" ON "RevenueSnapshot";

DROP POLICY IF EXISTS "featuredslot_public_select" ON "FeaturedSlot";
DROP POLICY IF EXISTS "featuredslot_admin_all" ON "FeaturedSlot";
DROP POLICY IF EXISTS "featuredslot_server_bypass" ON "FeaturedSlot";

DROP POLICY IF EXISTS "featuredpurchase_owner_all" ON "FeaturedPurchase";
DROP POLICY IF EXISTS "featuredpurchase_admin_all" ON "FeaturedPurchase";
DROP POLICY IF EXISTS "featuredpurchase_server_bypass" ON "FeaturedPurchase";

DROP POLICY IF EXISTS "emaillog_recipient_select" ON "EmailLog";
DROP POLICY IF EXISTS "emaillog_admin_all" ON "EmailLog";
DROP POLICY IF EXISTS "emaillog_server_bypass" ON "EmailLog";

DROP POLICY IF EXISTS "automationrule_admin_all" ON "AutomationRule";
DROP POLICY IF EXISTS "automationrule_server_bypass" ON "AutomationRule";

DROP POLICY IF EXISTS "appsetting_public_select" ON "AppSetting";
DROP POLICY IF EXISTS "appsetting_admin_all" ON "AppSetting";
DROP POLICY IF EXISTS "appsetting_server_bypass" ON "AppSetting";

DROP POLICY IF EXISTS "webindexinglog_admin_all" ON "WebIndexingLog";
DROP POLICY IF EXISTS "webindexinglog_server_bypass" ON "WebIndexingLog";

DROP POLICY IF EXISTS "directorylead_admin_all" ON "DirectoryLead";
DROP POLICY IF EXISTS "directorylead_server_bypass" ON "DirectoryLead";

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Define Policies
-- ──────────────────────────────────────────────────────────────────────────────

-- TABLE 1: User
CREATE POLICY "user_select_public" ON "User"
  FOR SELECT USING ("isProfilePublic" = true);

CREATE POLICY "user_select_self" ON "User"
  FOR SELECT USING (id = app_current_user_id());

CREATE POLICY "user_update_self" ON "User"
  FOR UPDATE USING (id = app_current_user_id())
  WITH CHECK (id = app_current_user_id());

CREATE POLICY "user_admin_all" ON "User"
  FOR ALL USING (app_is_admin());

CREATE POLICY "user_server_bypass" ON "User"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 2: Session
CREATE POLICY "session_self_all" ON "Session"
  FOR ALL USING ("userId" = app_current_user_id());

CREATE POLICY "session_admin_all" ON "Session"
  FOR ALL USING (app_is_admin());

CREATE POLICY "session_server_bypass" ON "Session"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 3: Account
CREATE POLICY "account_self_all" ON "Account"
  FOR ALL USING ("userId" = app_current_user_id());

CREATE POLICY "account_admin_all" ON "Account"
  FOR ALL USING (app_is_admin());

CREATE POLICY "account_server_bypass" ON "Account"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 4: Verification
CREATE POLICY "verification_admin_all" ON "Verification"
  FOR ALL USING (app_is_admin());

CREATE POLICY "verification_server_bypass" ON "Verification"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 5: Submission
CREATE POLICY "submission_owner_select" ON "Submission"
  FOR SELECT USING ("ownerId" = app_current_user_id());

CREATE POLICY "submission_owner_insert" ON "Submission"
  FOR INSERT WITH CHECK ("ownerId" = app_current_user_id());

CREATE POLICY "submission_owner_update" ON "Submission"
  FOR UPDATE USING ("ownerId" = app_current_user_id())
  WITH CHECK ("ownerId" = app_current_user_id());

CREATE POLICY "submission_admin_all" ON "Submission"
  FOR ALL USING (app_is_admin());

CREATE POLICY "submission_server_bypass" ON "Submission"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 6: Product
CREATE POLICY "product_public_select" ON "Product"
  FOR SELECT USING (status = 'LIVE');

CREATE POLICY "product_maker_select" ON "Product"
  FOR SELECT USING (
    "ownerId" = app_current_user_id() OR
    EXISTS (SELECT 1 FROM "ProductMaker" WHERE "productId" = "Product".id AND "userId" = app_current_user_id())
  );

CREATE POLICY "product_maker_modify" ON "Product"
  FOR ALL USING (
    "ownerId" = app_current_user_id() OR
    EXISTS (SELECT 1 FROM "ProductMaker" WHERE "productId" = "Product".id AND "userId" = app_current_user_id())
  );

CREATE POLICY "product_admin_all" ON "Product"
  FOR ALL USING (app_is_admin());

CREATE POLICY "product_server_bypass" ON "Product"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 7: ProductMaker
CREATE POLICY "productmaker_public_select" ON "ProductMaker"
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM "Product" WHERE id = "ProductMaker"."productId" AND status = 'LIVE')
  );

CREATE POLICY "productmaker_modify" ON "ProductMaker"
  FOR ALL USING (
    "userId" = app_current_user_id() OR
    EXISTS (SELECT 1 FROM "Product" WHERE id = "ProductMaker"."productId" AND "ownerId" = app_current_user_id())
  );

CREATE POLICY "productmaker_admin_all" ON "ProductMaker"
  FOR ALL USING (app_is_admin());

CREATE POLICY "productmaker_server_bypass" ON "ProductMaker"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 8: Category
CREATE POLICY "category_public_select" ON "Category"
  FOR SELECT USING (true);

CREATE POLICY "category_admin_all" ON "Category"
  FOR ALL USING (app_is_admin());

CREATE POLICY "category_server_bypass" ON "Category"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 9: Vote
CREATE POLICY "vote_public_select" ON "Vote"
  FOR SELECT USING ("isFlagged" = false);

CREATE POLICY "vote_user_modify" ON "Vote"
  FOR ALL USING ("userId" = app_current_user_id());

CREATE POLICY "vote_admin_all" ON "Vote"
  FOR ALL USING (app_is_admin());

CREATE POLICY "vote_server_bypass" ON "Vote"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 10: Comment
CREATE POLICY "comment_public_select" ON "Comment"
  FOR SELECT USING ("isDeleted" = false AND "isFlagged" = false);

CREATE POLICY "comment_user_insert" ON "Comment"
  FOR INSERT WITH CHECK ("userId" = app_current_user_id());

CREATE POLICY "comment_user_modify" ON "Comment"
  FOR UPDATE USING ("userId" = app_current_user_id());

CREATE POLICY "comment_admin_all" ON "Comment"
  FOR ALL USING (app_is_admin());

CREATE POLICY "comment_server_bypass" ON "Comment"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 11: CommentFlag
CREATE POLICY "commentflag_user_insert" ON "CommentFlag"
  FOR INSERT WITH CHECK ("raisedById" = app_current_user_id());

CREATE POLICY "commentflag_admin_all" ON "CommentFlag"
  FOR ALL USING (app_is_admin());

CREATE POLICY "commentflag_server_bypass" ON "CommentFlag"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 12: RankSnapshot
CREATE POLICY "ranksnapshot_public_select" ON "RankSnapshot"
  FOR SELECT USING (true);

CREATE POLICY "ranksnapshot_admin_all" ON "RankSnapshot"
  FOR ALL USING (app_is_admin());

CREATE POLICY "ranksnapshot_server_bypass" ON "RankSnapshot"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 13: RevenueConnection
CREATE POLICY "revenueconnection_owner_all" ON "RevenueConnection"
  FOR ALL USING ("userId" = app_current_user_id());

CREATE POLICY "revenueconnection_admin_all" ON "RevenueConnection"
  FOR ALL USING (app_is_admin());

CREATE POLICY "revenueconnection_server_bypass" ON "RevenueConnection"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 14: ProductRevenue
CREATE POLICY "productrevenue_public_select" ON "ProductRevenue"
  FOR SELECT USING (
    "displayMode" != 'HIDDEN' AND
    EXISTS (SELECT 1 FROM "Product" p JOIN "User" u ON p."ownerId" = u.id WHERE p.id = "ProductRevenue"."productId" AND u."showRevenuePublic" = true)
  );

CREATE POLICY "productrevenue_owner_modify" ON "ProductRevenue"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM "RevenueConnection" rc WHERE rc.id = "ProductRevenue"."connectionId" AND rc."userId" = app_current_user_id())
  );

CREATE POLICY "productrevenue_admin_all" ON "ProductRevenue"
  FOR ALL USING (app_is_admin());

CREATE POLICY "productrevenue_server_bypass" ON "ProductRevenue"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 15: RevenueSnapshot
CREATE POLICY "revenuesnapshot_owner_select" ON "RevenueSnapshot"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "ProductRevenue" pr
      JOIN "RevenueConnection" rc ON pr."connectionId" = rc.id
      WHERE pr.id = "RevenueSnapshot"."revenueId" AND rc."userId" = app_current_user_id()
    )
  );

CREATE POLICY "revenuesnapshot_admin_all" ON "RevenueSnapshot"
  FOR ALL USING (app_is_admin());

CREATE POLICY "revenuesnapshot_server_bypass" ON "RevenueSnapshot"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 16: FeaturedSlot
CREATE POLICY "featuredslot_public_select" ON "FeaturedSlot"
  FOR SELECT USING (true);

CREATE POLICY "featuredslot_admin_all" ON "FeaturedSlot"
  FOR ALL USING (app_is_admin());

CREATE POLICY "featuredslot_server_bypass" ON "FeaturedSlot"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 17: FeaturedPurchase
CREATE POLICY "featuredpurchase_owner_all" ON "FeaturedPurchase"
  FOR ALL USING ("userId" = app_current_user_id());

CREATE POLICY "featuredpurchase_admin_all" ON "FeaturedPurchase"
  FOR ALL USING (app_is_admin());

CREATE POLICY "featuredpurchase_server_bypass" ON "FeaturedPurchase"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 18: EmailLog
CREATE POLICY "emaillog_recipient_select" ON "EmailLog"
  FOR SELECT USING ("toUserId" = app_current_user_id());

CREATE POLICY "emaillog_admin_all" ON "EmailLog"
  FOR ALL USING (app_is_admin());

CREATE POLICY "emaillog_server_bypass" ON "EmailLog"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 19: AutomationRule
CREATE POLICY "automationrule_admin_all" ON "AutomationRule"
  FOR ALL USING (app_is_admin());

CREATE POLICY "automationrule_server_bypass" ON "AutomationRule"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 20: AppSetting
CREATE POLICY "appsetting_public_select" ON "AppSetting"
  FOR SELECT USING (
    key IN ('site_config', 'submission_guidelines', 'launch_rules', 'featured_pricing', 'public_metrics')
  );

CREATE POLICY "appsetting_admin_all" ON "AppSetting"
  FOR ALL USING (app_is_admin());

CREATE POLICY "appsetting_server_bypass" ON "AppSetting"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 21: WebIndexingLog
CREATE POLICY "webindexinglog_admin_all" ON "WebIndexingLog"
  FOR ALL USING (app_is_admin());

CREATE POLICY "webindexinglog_server_bypass" ON "WebIndexingLog"
  FOR ALL USING (app_current_user_id() IS NULL);

-- TABLE 22: DirectoryLead
CREATE POLICY "directorylead_admin_all" ON "DirectoryLead"
  FOR ALL USING (app_is_admin());

CREATE POLICY "directorylead_server_bypass" ON "DirectoryLead"
  FOR ALL USING (app_current_user_id() IS NULL);
