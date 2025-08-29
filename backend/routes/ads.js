// backend/src/routes/ads.js
import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { trackByAdCode } from "../controllers/trackController.js";
import { listMyAds, getAdsStats } from "../controllers/adsController.js";

const router = Router();

router.get("/track", trackByAdCode);
router.get("/ads/list", authRequired, listMyAds);
router.get("/ads/stats", authRequired, getAdsStats);

export default router;
