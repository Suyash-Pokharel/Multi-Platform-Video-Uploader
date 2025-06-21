    // backend/auth/passport.js
    const passport = require("passport");
    const GoogleStrategy = require("passport-google-oauth20").Strategy;
    const sqlite3 = require("sqlite3").verbose();
    const db = new sqlite3.Database("data.sqlite");

    // Serialize only user ID into the session
    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser((id, done) => {
    db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
        if (err) return done(err);
        return done(null, row);
    });
    });

    // Use Google OAuth strategy
    passport.use(
    new GoogleStrategy(
        {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
        },
        (accessToken, refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value || "";
        const name = profile.displayName;

        // Check if user exists
        db.get(
            "SELECT * FROM users WHERE google_id = ?",
            [profile.id],
            (err, user) => {
            if (err) return done(err);

            if (user) {
                return done(null, user); // User already exists
            } else {
                // Create new user
                db.run(
                "INSERT INTO users (google_id, name, email) VALUES (?, ?, ?)",
                [profile.id, name, email],
                function (err) {
                    if (err) return done(err);
                    db.get(
                    "SELECT * FROM users WHERE id = ?",
                    [this.lastID],
                    (err, newUser) => {
                        if (err) return done(err);
                        return done(null, newUser);
                    }
                    );
                }
                );
            }
            }
        );
        }
    )
    );
