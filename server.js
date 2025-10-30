// server.js
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch"; // Ensure fetch works across Node versions
import messageBuilderRouter from "./routes/messageBuilder.js"; // 👈 API routes for builder

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// === Setup ===
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === Session ===
app.use(
  session({
    secret: process.env.SESSION_SECRET || "modly_secret",
    resave: false,
    saveUninitialized: false,
  })
);

// === Passport ===
passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: process.env.DISCORD_REDIRECT_URI,
      scope: ["identify", "guilds"],
    },
    (accessToken, refreshToken, profile, done) =>
      done(null, { ...profile, accessToken })
  )
);
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.use(passport.initialize());
app.use(passport.session());

// === Helpers ===
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/auth/discord");
}
function hasAdminPerms(g) {
  return g?.owner || ((g?.permissions ?? 0) & 0x8) === 0x8;
}
function filterGuilds(guilds) {
  return (guilds || []).filter(hasAdminPerms);
}

// === Auth Routes ===
app.get("/", (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/auth/discord");
  res.redirect("/guilds");
});

app.get("/auth/discord", passport.authenticate("discord"));
app.get(
  "/auth/discord/callback",
  passport.authenticate("discord", { failureRedirect: "/auth/discord" }),
  async (req, res) => {
    const guilds = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${req.user.accessToken}` },
    }).then((r) => r.json());
    req.session.guilds = filterGuilds(guilds);
    res.redirect("/guilds");
  }
);

app.get("/logout", (req, res) => {
  req.logout(() => req.session.destroy(() => res.redirect("/")));
});

// === Guild Selection ===
app.get("/guilds", ensureAuth, (req, res) => {
  res.render("guilds", { user: req.user, guilds: req.session.guilds || [] });
});

// === Dashboard ===
app.get("/dashboard/:guildId", ensureAuth, (req, res) => {
  const { guildId } = req.params;
  const guild = (req.session.guilds || []).find((g) => g.id === guildId);
  if (!hasAdminPerms(guild)) {
    return res.status(403).render("restricted", {
      user: req.user,
      guild: guild || { id: guildId },
    });
  }
  res.render("dashboard", {
    user: req.user,
    guild,
    guilds: req.session.guilds || [],
  });
});

app.get("/dashboard/:guildId/modules/:module", ensureAuth, (req, res) => {
  const { guildId, module } = req.params;
  const guild = (req.session.guilds || []).find((g) => g.id === guildId);
  if (!hasAdminPerms(guild)) {
    return res.status(403).render("restricted", {
      user: req.user,
      guild: guild || { id: guildId },
    });
  }

  const allowed = ["welcome", "sticky", "builder", "automod"];
  if (!allowed.includes(module)) return res.status(404).send("Module not found");

  res.render(`modules/${module}`, { user: req.user, guild });
});

// === Mount Message Builder API Routes ===
app.use("/api", ensureAuth, messageBuilderRouter);

// === Fallback ===
app.use((req, res) => res.status(404).send("Not found"));

// === Export for Vercel ===
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () =>
    console.log(`✅ Modly Dashboard running locally on http://localhost:${PORT}`)
  );
}

export default app;










