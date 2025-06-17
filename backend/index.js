    require("dotenv").config();
    const express = require("express");
    const cors = require("cors");
    const multer = require("multer");
    const B2 = require('backblaze-b2');
    const sqlite3 = require("sqlite3").verbose();
    const path = require("path");

    const app = express();
    app.use(cors({ origin: "*" }));
    app.use(express.json());

    const session = require("express-session");
    app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    }));

    app.use((req, res, next) => {
        console.log("Session ID:", req.sessionID);
        next();
    });


    // In-memory multer (be careful of RAM if files are huge)
    const upload = multer({ storage: multer.memoryStorage() });
    const b2 = new B2({
    applicationKeyId: process.env.B2_ACCOUNT_ID,
    applicationKey: process.env.B2_APP_KEY
    });


    // Initialize SQLite
    const dbFile = path.join(__dirname, "data.sqlite");
    const db = new sqlite3.Database(dbFile);
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

    // Helper to get B2 upload URL
    async function getB2UploadUrl() {
    await b2.authorize();
    return b2
        .getUploadUrl({ bucketId: process.env.B2_BUCKET_ID })
        .then((r) => r.data);
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
        // 1) Get B2 URL + token
        const { uploadUrl, authorizationToken } = await getB2UploadUrl();

        // 2) Upload video
        const videoFile = req.files.video[0];
        const vidB2 = await b2.uploadFile({
            uploadUrl,
            uploadAuthToken: authorizationToken,
            fileName: `${Date.now()}_${videoFile.originalname}`,
            data: videoFile.buffer,
        });

        // 3) Optionally upload thumbnail
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

        // 4) Persist schedule metadata
        const {
            title,
            description = "",
            tags = "",
            scheduleTime,
            platforms,
            userId = null
        } = req.body;
        if (!title || !scheduleTime || !platforms) {
            return res.status(400).json({ error: "Missing required fields: title, scheduleTime, or platforms." });
        }
        db.run(
            `INSERT INTO scheduled_videos
        (user_id,video_b2_name,thumb_b2_name,title,description,tags,schedule_time,platforms)
        VALUES (?,?,?,?,?,?,?,?)`,
            [
            userId || null,
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
    app.listen(PORT, () => console.log(`🚀 Backend listening on ${PORT}`));
