// backend/src/routes/ads.js
import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { trackByAdCode } from "../controllers/trackController.js";
import { listMyAds, getAdsStats, getAdDetail, createAd, updateAd, bulkDeleteAds, } from "../controllers/adsController.js";

const router = Router();

router.get("/track", trackByAdCode);
router.get("/ads/my", authRequired, listMyAds);
router.get("/ads/stats", authRequired, getAdsStats);
router.post("/ads", authRequired, createAd);
router.post("/ads/bulk-delete", authRequired, bulkDeleteAds);
router.get("/ads/:adSeq", authRequired, getAdDetail);
router.put("/ads/:adSeq", authRequired, updateAd);

export default router;
