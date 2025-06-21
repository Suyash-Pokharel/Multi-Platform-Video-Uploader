    // Load environment variables first
    require("dotenv").config();

    const { b2, authorizeB2 } = require("./services");
    require("./cron");

    const passport = require("passport");
    require("./auth/passport");

    const express = require("express");
    const cors = require("cors");
    const multer = require("multer");
    const sqlite3 = require("sqlite3").verbose();
    const path = require("path");
    const session = require("express-session");

    const app = express();

    // Middleware
    app.use(cors({
    origin: ["http://localhost:5500", "https://suyash-pokharel.github.io"],
    credentials: true
    }));

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

    app.use(passport.initialize());
    app.use(passport.session());

    // === Google OAuth Routes ===

    // Step 1: Redirect user to Google for authentication
    app.get("/auth/google",
    passport.authenticate("google", {
        scope: ["openid", "profile", "email"],
    })
    );

    // Step 2: Google redirects back here after login
    app.get("/auth/google/callback",
    passport.authenticate("google", {
        failureRedirect: "/login.html",
    }),
    (req, res) => {
        res.redirect("/"); // On success, go to homepage or dashboard
    }
    );

    // Step 3: Logout route
    app.get("/auth/logout", (req, res) => {
    req.logout(err => {
    if (err) {
        console.error("Logout error:", err);
        return res.status(500).send("Logout failed.");
    }
    res.redirect("/login.html"); // or "/"
    });
    });

    // Step 4: Check if user is authenticated (frontend uses this)
    app.get("/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ user: req.user });
    } else {
        res.status(401).json({ message: "Not authenticated" });
    }
    });


    app.use((req, res, next) => {
    console.log("Session ID:", req.sessionID);
    next();
    });

    // File upload
    const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // Max 100MB
    });

    // SQLite setup
    const dbFile = path.join(__dirname, "data.sqlite");
    const db = new sqlite3.Database(dbFile, (err) => {
    if (err) console.error("DB connection failed:", err);
    else console.log("✅ SQLite DB connected");
    });

    db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    name TEXT,
    email TEXT
    )`);
    
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
    await authorizeB2();
    const response = await b2.getUploadUrl({
        bucketId: process.env.B2_BUCKET_ID
    });
    return response.data;
}

    app.post(
    "/api/upload",
    upload.fields([
        { name: "video", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 },
    ]),
    async (req, res) => {
        try {
        // ✅ 1. Validate that a video file exists
        if (!req.files || !req.files.video || req.files.video.length === 0) {
            return res.status(400).json({ error: "Missing required video file." });
        }

        // ✅ 2. Authorize with Backblaze B2 and get upload URL
        const { uploadUrl, authorizationToken } = await getB2UploadUrl();

        // ✅ 3. Upload video to B2
        const videoFile = req.files.video[0];
        const videoFileName = `${Date.now()}_${videoFile.originalname}`;
        const vidB2 = await b2.uploadFile({
            uploadUrl,
            uploadAuthToken: authorizationToken,
            fileName: videoFileName,
            data: videoFile.buffer,
        });

        // ✅ 4. Optionally upload thumbnail
        let thumbName = null;
        if (req.files.thumbnail && req.files.thumbnail.length > 0) {
            const thumbFile = req.files.thumbnail[0];
            const thumbFileName = `${Date.now()}_thumb_${thumbFile.originalname}`;
            const thumbB2 = await b2.uploadFile({
            uploadUrl,
            uploadAuthToken: authorizationToken,
            fileName: thumbFileName,
            data: thumbFile.buffer,
            });
            thumbName = thumbB2.data.fileName;
        }

        // ✅ 5. Destructure and set defaults
        const {
            title,
            description = "",
            tags = "",
            scheduleTime,
            platforms,
            userId = null,
        } = req.body;

        // ✅ 6. Validate required fields
        if (!title || !scheduleTime || !platforms) {
            return res.status(400).json({
            error: "Missing required fields: title, scheduleTime, or platforms.",
            });
        }

        // ✅ 7. Save metadata to SQLite
        db.run(
            `INSERT INTO scheduled_videos
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
                console.error("Database insert error:", err);
                return res.status(500).json({ error: "Database insert failed." });
            }
            // ✅ 8. Return success
            res.json({ success: true, id: this.lastID });
            }
        );
        } catch (err) {
        // ✅ 9. Catch-all error handler
        console.error("Upload error:", err);
        res.status(500).json({ error: "Upload failed." });
        }
    }
    );


    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => console.log(`🚀 Backend listening on port ${PORT}`));
