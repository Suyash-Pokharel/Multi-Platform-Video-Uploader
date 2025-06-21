    // cron.js
    const cron = require("node-cron");
    const sqlite3 = require("sqlite3").verbose();
    const path = require("path");

    // Connect to SQLite database
    const dbFile = path.join(__dirname, "data.sqlite");
    const db = new sqlite3.Database(dbFile);

    // Run every minute
    cron.schedule("* * * * *", () => {
    const now = new Date().toISOString();

    db.all(
        `SELECT * FROM scheduled_videos WHERE status='pending' AND schedule_time <= ?`,
        [now],
        async (err, rows) => {
        if (err) {
            console.error("❌ Cron DB error:", err);
            return;
        }

        for (const video of rows) {
            try {
            console.log(
                `⏰ Scheduled publish triggered: ${video.id} - ${video.title}`
            );

            let platforms = [];
            try {
                platforms = JSON.parse(video.platforms);
            } catch (jsonErr) {
                console.error(
                `⚠️ Failed to parse platforms for video ${video.id}:`,
                jsonErr
                );
                continue;
            }

            for (const platform of platforms) {
                switch (platform) {
                case "youtube":
                    // await publishToYouTube(video);
                    console.log(
                    `📤 [YouTube] Simulated publish for: ${video.title}`
                    );
                    break;
                case "tiktok":
                    // await publishToTikTok(video);
                    console.log(
                    `📤 [TikTok] Simulated publish for: ${video.title}`
                    );
                    break;
                case "instagram":
                    // await publishToInstagram(video);
                    console.log(
                    `📤 [Instagram] Simulated publish for: ${video.title}`
                    );
                    break;
                case "linkedin":
                    console.log(
                    `📤 [LinkedIn] Simulated publish for: ${video.title}`
                    );
                    break;
                case "x":
                    console.log(
                    `📤 [X (Twitter)] Simulated publish for: ${video.title}`
                    );
                    break;
                default:
                    console.warn(`⚠️ Unknown platform: ${platform}`);
                }
            }

            // Update status to published
            db.run(
                `UPDATE scheduled_videos SET status = 'published' WHERE id = ?`,
                [video.id],
                (updateErr) => {
                if (updateErr) {
                    console.error(
                    `❌ Failed to update status for video ${video.id}:`,
                    updateErr
                    );
                } else {
                    console.log(
                    `✅ Status updated to 'published' for video ${video.id}`
                    );
                }
                }
            );
            } catch (e) {
            console.error(`❌ Error processing video ${video.id}:`, e);
            }
        }
        }
    );
    });
