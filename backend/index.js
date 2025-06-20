    require("dotenv").config();
    const express = require("express");
    const cors = require("cors");
    const multer = require("multer");
    const B2 = require("backblaze-b2");
    const sqlite3 = require("sqlite3").verbose();
    const path = require("path");
    const session = require("express-session");

    const app = express();

    // Middleware
    app.use(cors({ origin: "*" }));
    app.use(express.json());

    app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        },
    })
    );

    app.use((req, res, next) => {
    console.log("Session ID:", req.sessionID);
    next();
    });

    // File upload
    const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // Max 100MB
    });

    // Backblaze B2
    const b2 = new B2({
    applicationKeyId: process.env.B2_ACCOUNT_ID,
    applicationKey: process.env.B2_APP_KEY,
    });

    // SQLite setup
    const dbFile = path.join(__dirname, "data.sqlite");
    const db = new sqlite3.Database(dbFile, (err) => {
    if (err) console.error("DB connection failed:", err);
    else console.log("✅ SQLite DB connected");
    });

    db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS scheduled_videos (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            video_b2_name TEXT NOT NULL,
            thumb_b2_name TEXT,
            title TEXT NOT NULL,
            description TEXT,
            tags TEXT,
            schedule_time DATETIME NOT NULL,
            platforms TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    });

    // B2 upload helper
    async function getB2UploadUrl() {
    await b2.authorize();
    const { uploadUrl, authorizationToken } = await b2
        .getUploadUrl({
        bucketId: process.env.B2_BUCKET_ID,
        })
        .then((r) => r.data);
    return { uploadUrl, authorizationToken };
    }

    // Upload endpoint
    app.post(
    "/api/upload",
    upload.fields([
        { name: "video", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 },
    ]),
    async (req, res) => {
        try {
        if (!req.files || !req.files.video || !req.files.video[0]) {
            return res.status(400).json({ error: "Video file is required" });
        }

        const { uploadUrl, authorizationToken } = await getB2UploadUrl();

        // Upload video
        const videoFile = req.files.video[0];
        const vidB2 = await b2.uploadFile({
            uploadUrl,
            uploadAuthToken: authorizationToken,
            fileName: `${Date.now()}_${videoFile.originalname}`,
            data: videoFile.buffer,
        });

        // Upload thumbnail
        let thumbName = null;
        if (req.files.thumbnail) {
            const thumbFile = req.files.thumbnail[0];
            const thumbB2 = await b2.uploadFile({
            uploadUrl,
            uploadAuthToken: authorizationToken,
            fileName: `${Date.now()}_thumb_${thumbFile.originalname}`,
            data: thumbFile.buffer,
            });
            thumbName = thumbB2.data.fileName;
        }

        // Form fields
        const {
            title,
            description = "",
            tags = "",
            scheduleTime,
            platforms,
            userId = null,
        } = req.body;

        if (!title || !scheduleTime || !platforms) {
            return res
            .status(400)
            .json({
                error:
                "Missing required fields: title, scheduleTime, or platforms.",
            });
        }

        db.run(
            `
            INSERT INTO scheduled_videos
            (user_id, video_b2_name, thumb_b2_name, title, description, tags, schedule_time, platforms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
            userId,
            vidB2.data.fileName,
            thumbName,
            title,
            description,
            tags,
            scheduleTime,
            platforms,
            ],
            function (err) {
            if (err) {
                console.error("DB error:", err);
                return res.status(500).json({ error: "Database insert failed" });
            }
            res.json({ success: true, id: this.lastID });
            }
        );
        } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ error: "Upload failed" });
        }
    }
    );

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => console.log(`🚀 Backend listening on port ${PORT}`));
