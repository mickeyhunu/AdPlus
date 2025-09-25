// backend/src/routes/auth.js
import { Router } from "express";
import { login, me, updatePassword, updateExcludedIps } from "../controllers/authController.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

router.post("/login", login);
router.get("/me", authRequired, me);
router.patch("/password", authRequired, updatePassword);
router.put("/excluded-ips", authRequired, updateExcludedIps);

export default router;
