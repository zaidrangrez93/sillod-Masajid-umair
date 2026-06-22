// server.js
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Simple username/password for admin (Basic Auth) ---
const ADMIN_USER = "admin";
const ADMIN_PASS = "masjid123";

function basicAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [type, value] = authHeader.split(" ");

  if (type !== "Basic" || !value) {
    res.set("WWW-Authenticate", 'Basic realm="SALAAH TIME SILLOD"');
    return res.status(401).send("Authentication required");
  }

  const [user, pass] = Buffer.from(value, "base64").toString().split(":");

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    return next();
  }

  res.set("WWW-Authenticate", 'Basic realm="Al Masjid Admin"');
  return res.status(401).send("Invalid credentials");
}

// ---- Load data from JSON file (permanent storage) ----
const dataFile = path.join(__dirname, "data.json");

// If data.json missing, create it with defaults
if (!fs.existsSync(dataFile)) {
  const defaultStore = {
    todayData: {
      dateReadable: "09 December 2025",
      hijri: "27 Jumada al-Akhirah 1447H",
      city: "Sillod, Maharashtra",
      prayers: [
        { name: "Fajr", adhan: "06:20 AM", iqamah: "06:40 AM" },
        { name: "Sunrise", adhan: "-", iqamah: "06:50 AM" },
        { name: "Dhuhr", adhan: "02:30 PM", iqamah: "02:45 PM" },
        { name: "Asr", adhan: "04:30 PM", iqamah: "04:45 PM" },
        { name: "Maghrib", adhan: "Sunset", iqamah: "06:05 PM" },
        { name: "Isha", adhan: "07:45 PM", iqamah: "08:00 PM" },
      ],
    },
    weekTimetable: [
      { day: "Tuesday", fajr: "06:30", dhuhr: "02:30", asr: "16:45", maghrib: "18:05", isha: "20:00", jumuah: "—" },
      { day: "Wednesday", fajr: "06:30", dhuhr: "13:30", asr: "16:45", maghrib: "18:05", isha: "20:00", jumuah: "—" },
      { day: "Thursday", fajr: "06:30", dhuhr: "13:30", asr: "16:46", maghrib: "18:06", isha: "20:01", jumuah: "—" },
      { day: "Friday", fajr: "06:30", dhuhr: "13:30", asr: "16:46", maghrib: "18:06", isha: "20:01", jumuah: "13:45" },
      { day: "Saturday", fajr: "06:30", dhuhr: "13:31", asr: "16:47", maghrib: "18:07", isha: "20:02", jumuah: "—" },
      { day: "Sunday", fajr: "06:30", dhuhr: "13:31", asr: "16:47", maghrib: "18:07", isha: "20:02", jumuah: "—" },
      { day: "Monday", fajr: "06:30", dhuhr: "13:31", asr: "16:48", maghrib: "18:08", isha: "20:03", jumuah: "—" },
    ],
  };
  fs.writeFileSync(dataFile, JSON.stringify(defaultStore, null, 2));
}

// Load from JSON
let store = JSON.parse(fs.readFileSync(dataFile));

// ===== FIX: LOAD DATA FROM data.json =====
let todayData = store.todayData;
let weekTimetable = store.weekTimetable;

if (!store.masajid) {
  store.masajid = [];
}



// ---- Other in-memory data ----
let announcements = [
  { title: "Friday Khutbah Timing", text: "Khutbah starts at 1:45 PM, Salah at 2:00 PM" },
  { title: "Weekly Dars", text: "Every Saturday after Maghrib – Hadith & Tafseer class" },
  { title: "Madarsa Timings", text: "Mon–Thu: 5:00 PM – 7:00 PM (Boys & Girls)" },
];

let masjidInfo = {
  name: "SALAAH TIME, Sillod",
  addressLine: "Near [Landmark], Sillod, Maharashtra, India – 431112",
  phone: "+91-98765-43210",
  email: "info@almasjid-sillod.in",
};

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Public APIs
app.get("/api/timings/today", (req, res) => {
  // Return the todayData object directly (not wrapped in another layer)
  res.json(todayData);
});

// ---------------- PUBLIC MASJID LIST ----------------
app.get("/api/masajid", (req, res) => {
  res.json(store.masajid);
});


// ---------------- ADD MASJID (ADMIN) ----------------
app.post("/api/admin/masjid", basicAuth, (req, res) => {
  const { name, city } = req.body;

  if (!name || !city) {
    return res.status(400).json({ error: "Name and city required" });
  }

  const newMasjid = {
    id: Date.now(),
    name,
    city,
    weekTimetable: []
  };

  store.masajid.push(newMasjid);
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));

  res.json({ success: true, masjid: newMasjid });
});


app.get("/api/timings/week", (req, res) => {
  // Return the weekTimetable array directly
  res.json(weekTimetable);
});

app.get("/api/announcements", (req, res) => {
  res.json(announcements);
});

app.get("/api/masjid", (req, res) => {
  res.json(masjidInfo);
});

// Admin API – protected + saves to file
app.post("/api/admin/timings", basicAuth, (req, res) => {
  const { dateReadable, hijri, city, prayers } = req.body;
  console.log("Received admin update:", req.body);

  if (!Array.isArray(prayers)) {
    return res.status(400).json({ error: "prayers must be an array" });
  }

  todayData = {
    ...todayData,
    dateReadable: dateReadable || todayData.dateReadable,
    hijri: hijri || todayData.hijri,
    city: city || todayData.city,
    prayers,
  };

  // update store and save to disk
  store.todayData = todayData;
  store.weekTimetable = weekTimetable;

  try {
    fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error("Error writing data.json:", err);
    return res.status(500).json({ error: "Failed to save timings" });
  }

  return res.json({ ok: true, todayData });
});

// Route for /admin (login popup)
app.get("/admin", basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "admin", "admin.html"));
});


app.listen(PORT, () => {
  console.log(`SALAAH TIME Sillod app running on http://localhost:${PORT}`);
});
