import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import adsRoutes from "./routes/ads.js";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors()); // 필요시 도메인 제한

// API
app.use("/api/auth", authRoutes);
app.use("/api", adsRoutes);
app.get('/health', (_,res)=>res.send('ok'));

// 정적 프론트(빌드) 서빙
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontBuild = path.join(__dirname, "../frontend/dist"); // Vite 빌드 디렉터리
app.use(express.static(frontBuild));

// SPA 라우팅 지원
app.get("*", (req, res) => {
  res.sendFile(path.join(frontBuild, "index.html"));
});

const PORT = Number(process.env.PORT || 80);
app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
