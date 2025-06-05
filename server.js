const { Pool } = require("pg");
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const nodemailer = require("nodemailer");
const cors = require("cors");
const app = express();
const PORT = 80;
require("dotenv").config();
const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
const upload = multer({ dest: "temp/" });

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "https://ecommerce-prod-3iis.onrender.com",
    ],
    credentials: true,
  })
);
const isSecure = true; // devtunnel is also https

app.use(
  session({
    name: "connect.sid",
    secret: "otp-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: isSecure, // true for HTTPS/devtunnel, false for localhost
      sameSite: "lax", // Cross-site এর জন্য
      maxAge: 10 * 60 * 1000,
    },
  })
);
// ✅ Static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/data", express.static(path.join(__dirname, "public/data")));
app.use(
  "/admin/settings",
  express.static(path.join(__dirname, "admin/settings"))
);

// ✅ Login page
app.get("/admin/login", (req, res) => {
  res.sendFile(path.join(__dirname, "admin", "auth", "login.html"));
});

// ✅ Login authentication
app.post("/api/login", async (req, res) => {
  const { username, password, remember } = req.body;

  try {
    const result = await db.query(
      "SELECT * FROM admin_user WHERE username = $1 AND password = $2",
      [username, password]
    );

    if (result.rows.length > 0) {
      const options = {
        httpOnly: true,
        maxAge: remember ? 10 * 24 * 60 * 60 * 1000 : null,
      };
      res.cookie("admin_token", "valid", options);
      return res.json({ success: true });
    }

    res.json({ success: false });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false });
  }
});

// ✅ Logout
app.get("/api/logout", (req, res) => {
  res.clearCookie("admin_token");
  res.redirect("/admin/login");
});

// ✅ Protect all /admin routes (must be before /admin static serving)
app.use("/admin", (req, res, next) => {
  const token = req.cookies?.admin_token;
  if (token === "valid") return next();
  return res.redirect("/admin/login");
});

// ✅ Now serve /admin static files
app.use("/admin", express.static(path.join(__dirname, "admin")));

// ✅ Admin page loader
app.get("/admin/pages/:page", (req, res) => {
  const pageFile = path.join(
    __dirname,
    "admin",
    "pages",
    `${req.params.page}.html`
  );
  if (fs.existsSync(pageFile)) {
    res.sendFile(pageFile);
  } else {
    res.status(404).send("Page not found");
  }
});
app.get("/api/getNodemailer", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM nodemailer_credentials ORDER BY id DESC LIMIT 1"
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "No credentials found" });

    const { gmail, app_password } = result.rows[0];
    res.json({
      success: true,
      message: "Transporter is valid",
      gmail,
      app_password,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Transporter validation failed",
      details: err.message,
    });
  }
});

app.post("/api/nodemailer", async (req, res) => {
  const { gmail, app_password } = req.body;

  if (!gmail || !app_password)
    return res
      .status(400)
      .json({ error: "Both Gmail and App Password are required" });

  try {
    await db.query(
      `INSERT INTO nodemailer_credentials (id, gmail, app_password)
       VALUES (1, $1, $2)
       ON CONFLICT (id)
       DO UPDATE SET gmail = $1, app_password = $2`,
      [gmail, app_password]
    );

    res.json({ success: true, message: "Credentials saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save credentials" });
  }
});
//Transporter
let transporter = null;
let senderEmail = null;
async function initMailer() {
  if (!transporter) {
    try {
      const result = await db.query(
        "SELECT * FROM nodemailer_credentials ORDER BY id DESC LIMIT 1"
      );

      if (result.rows.length === 0) {
        console.error("❌ No email credentials found in DB.");
        return;
      }

      const { gmail, app_password } = result.rows[0];
      senderEmail = gmail;
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmail,
          pass: app_password,
        },
      });

      console.log("✅ Transporter initialized with DB credentials.");
    } catch (err) {
      console.error("❌ Error while initializing transporter:", err.message);
    }
  }
}
// ✅ Admin profile update (JSON-based)
app.post("/api/admin/updateProfile", async (req, res) => {
  try {
    const { name, email, username, password, profilePicBase64 } = req.body;

    const adminId = 1;
    const existing = await db.query("SELECT * FROM admin_user WHERE id = $1", [
      adminId,
    ]);

    if (existing.rows.length > 0) {
      // Admin exists → update
      if (profilePicBase64 && profilePicBase64.trim() !== "") {
        await db.query(
          `UPDATE admin_user 
           SET name = $1, email = $2, username = $3, password = $4, profile_pic_base64 = $5 
           WHERE id = $6`,
          [name, email, username, password, profilePicBase64, adminId]
        );
      } else {
        await db.query(
          `UPDATE admin_user 
           SET name = $1, email = $2, username = $3, password = $4 
           WHERE id = $5`,
          [name, email, username, password, adminId]
        );
      }
    } else {
      // First-time insert
      await db.query(
        `INSERT INTO admin_user (id, username, name, email, password, profile_pic_base64)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [adminId, username, name, email, password, profilePicBase64 || ""]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Admin profile update failed:", err);
    res.status(500).json({ success: false });
  }
});
app.post("/api/send-otp", async (req, res) => {
  const { email } = req.body;

  try {
    const result = await db.query("SELECT * FROM admin_user WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return res.json({ success: false, message: "Not admin email" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP

    if (!req.session) {
      return res
        .status(500)
        .json({ success: false, message: "Session not initialized" });
    }

    req.session.otp = otp;
    req.session.otpEmail = email;
    req.session.otpGeneratedAt = Date.now();
    // await transporter.verify(); // Optional but recommended
    await initMailer();
    if (!transporter) {
      return res
        .status(500)
        .json({ success: false, message: "Email transporter not initialized" });
    }
    await transporter.sendMail({
      from: `"Admin Email Verification" <${senderEmail}>`,
      to: email,
      subject: "Your OTP Code",
      html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Tahoma; background-color: #f4f4f4;">
          <div style="max-width: 560px; margin: 15px auto; background: white; padding: 5px 0; text-align: center;">
            <h2 style="color: #333">Your OTP Code</h2>
            <p style="font-size: 16px; color: #555">Please enter this OTP to verify Admin Email</p>

            <div style="background: #eb3b5a; font-size: 32px; font-weight: bold; color: #fff; margin: 5px 0; padding: 10px; display: inline-block; border-radius: 5px;">
              <h5 style="display: inline; letter-spacing: 3px">${otp}</h5>
            </div>

            <p style="font-size: 14px; color: #888">
              This code will expire in 10 minutes. Do not share it with anyone.
            </p>

            <p style="font-size: 0; color: transparent">${Date.now()}</p>
            <!-- Email generated at ${new Date().toISOString()} -->
          </div>
        </body>
      </html>
      `,
    });

    res.json({ success: true, message: "OTP sent" });
  } catch (err) {
    console.error("OTP Send Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/verify-otp", async (req, res) => {
  const { otp } = req.body;

  const savedOtp = req.session.otp;
  const email = req.session.otpEmail;
  const createdAt = req.session.otpGeneratedAt;

  const isExpired = Date.now() - createdAt > 10 * 60 * 1000;

  if (!savedOtp || !email || isExpired) {
    return res.json({ success: false, message: "OTP expired. Try again." });
  }

  if (otp !== savedOtp) {
    return res.json({ success: false, message: "Wrong OTP" });
  }

  // Fetch admin user by email
  const result = await db.query(
    "SELECT username, password FROM admin_user WHERE email = $1",
    [email]
  );

  if (result.rows.length === 0) {
    return res.json({ success: false, message: "No admin found" });
  }

  const user = result.rows[0];

  // Clear OTP from session
  req.session.otp = null;
  req.session.otpEmail = null;
  req.session.otpGeneratedAt = null;

  res.json({ success: true, username: user.username, password: user.password });
});
// ✅ Admin profile get
app.get("/api/admin/profile", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT name, email, username, password, profile_pic_base64 FROM admin_user LIMIT 1"
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false });
    }
    res.json({ success: true, profile: result.rows[0] });
  } catch (err) {
    console.error("❌ Fetch admin profile failed:", err);
    res.status(500).json({ success: false });
  }
});

// ✅ Serve profile image (base64 decode)
app.get("/api/admin/profilePic", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT profile_pic_base64 FROM admin_user LIMIT 1"
    );

    if (!result.rows.length || !result.rows[0].profile_pic_base64) {
      return res.status(404).send("No profile image found.");
    }

    const base64 = result.rows[0].profile_pic_base64;
    const matches = base64.match(/^data:(.+);base64,(.+)$/);

    if (!matches || matches.length !== 3) {
      return res.status(400).send("Invalid base64 format.");
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");

    res.setHeader("Content-Type", mimeType);
    res.send(buffer);
  } catch (err) {
    console.error("❌ Profile image load failed:", err);
    res.status(500).send("Server error.");
  }
});

// ✅ Load site settings
app.get("/api/siteSettings", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM site_settings");
    const settings = {};
    result.rows.forEach((row) => {
      settings[row.key] = row.value;
    });

    // Ensure defaults exist if not present
    if (!("show_site_name" in settings)) settings.show_site_name = "true";
    if (!("show_logo" in settings)) settings.show_logo = "true";

    res.json({ success: true, settings });
  } catch (err) {
    console.error("❌ Failed to fetch site settings:", err);
    res.status(500).json({ success: false });
  }
});

// ✅ Update site settings
app.post("/api/updateSiteSettings", async (req, res) => {
  const settings = req.body; // expects { key: value }

  try {
    const promises = Object.entries(settings).map(([key, value]) =>
      db.query(
        `INSERT INTO site_settings (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
      )
    );

    await Promise.all(promises);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to update site settings:", err);
    res.status(500).json({ success: false });
  }
});

app.post("/api/siteImage/:id", async (req, res) => {
  const { id } = req.params;
  const { imageBase64 } = req.body;

  if (!imageBase64 || !id)
    return res
      .status(400)
      .json({ success: false, message: "Missing image or ID" });

  try {
    await db.query(
      `INSERT INTO site_images (id, image_base64)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET image_base64 = EXCLUDED.image_base64`,
      [id, imageBase64]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to upload site image:", err);
    res.status(500).json({ success: false });
  }
});
app.get("/api/siteImageGet/:id", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT image_base64 FROM site_images WHERE id = $1",
      [req.params.id]
    );

    if (!result.rows.length) return res.status(404).send("Image not found");

    const base64 = result.rows[0].image_base64;
    const matches = base64.match(/^data:(.+);base64,(.+)$/);

    if (!matches || matches.length !== 3)
      return res.status(400).send("Invalid image format");

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");

    res.setHeader("Content-Type", mimeType);
    res.send(buffer);
  } catch (err) {
    console.error("❌ Image load error:", err);
    res.status(500).send("Server error");
  }
});
app.get("/api/siteHeaderButtons", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, text, link FROM site_header_buttons ORDER BY id"
    );
    res.json({ success: true, buttons: result.rows });
  } catch (err) {
    console.error("❌ Failed to fetch header buttons:", err);
    res.status(500).json({ success: false });
  }
});

// ✅ Add a new button
app.post("/api/siteHeaderButtons", async (req, res) => {
  const { text, link } = req.body;
  if (!text || !link) return res.status(400).json({ success: false });

  try {
    await db.query(
      "INSERT INTO site_header_buttons (text, link) VALUES ($1, $2)",
      [text, link]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to add button:", err);
    res.status(500).json({ success: false });
  }
});

// ✅ Delete button by id
app.delete("/api/siteHeaderButtons/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM site_header_buttons WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to delete button:", err);
    res.status(500).json({ success: false });
  }
});
// ✅ Submit Order and Send email to admin
app.post("/api/submitOrder", async (req, res) => {
  const {
    product_id,
    product_name,
    name,
    mobile,
    address,
    qty,
    total_price,
    d_charge,
    p_price,
  } = req.body;

  if (
    !name ||
    !mobile ||
    !address ||
    !product_id ||
    !product_name ||
    !qty ||
    !total_price ||
    !d_charge ||
    !p_price
  ) {
    return res.status(400).json({ success: false });
  }

  const orderId = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await db.query(
      `INSERT INTO orders (order_id, product_id, product_name, name, mobile, address, seen, qty, total_price, d_charge, p_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        orderId,
        product_id,
        product_name,
        name,
        mobile,
        address,
        false,
        qty,
        total_price,
        d_charge,
        p_price,
      ]
    );

    // Get admin email from DB
    const result = await db.query(`SELECT email FROM admin_user LIMIT 1`);
    const adminEmail = result.rows[0]?.email;

    if (!adminEmail) {
      return res
        .status(500)
        .json({ success: false, message: "No admin email found" });
    }

    await initMailer();
    if (!transporter) {
      return res
        .status(500)
        .json({ success: false, message: "Email transporter not initialized" });
    }

    await transporter.sendMail({
      from: `"New Order" <${senderEmail}>`,
      to: adminEmail,
      subject: "New Order Placed",
      html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Tahoma; background-color: #f4f4f4;">
          <div style="max-width: 560px; margin: 15px auto; background: white; padding: 5px 0; text-align: left; padding-left: 20px;">
            <h2 style="text-align: center; color: #333">New Order Placed</h2>
            <div style="margin-bottom: 3px;"><span style="font-weight: bold; font-size: 15px; color: #333;">Product Name:</span> <span style="font-size: 15px; color: #333;">${product_name}</span></div>
            <div style="margin-bottom: 3px;"><span style="font-weight: bold; font-size: 15px; color: #333;">Customer Name:</span> <span style="font-size: 15px; color: #333;">${name}</span></div>
            <div style="margin-bottom: 3px;"><span style="font-weight: bold; font-size: 15px; color: #333;">Mobile:</span> <span style="font-size: 15px; color: #333;">${mobile}</span></div>
            <div style="margin-bottom: 3px;"><span style="font-weight: bold; font-size: 15px; color: #333;">Price:</span> <span style="font-size: 15px; color: #333;">${p_price}</span></div>
            <div style="margin-bottom: 3px;"><span style="font-weight: bold; font-size: 15px; color: #333;">Quantity:</span> <span style="font-size: 15px; color: #333;">${qty}</span></div>
            <div style="margin-bottom: 3px;"><span style="font-weight: bold; font-size: 15px; color: #333;">Address:</span> <span style="font-size: 15px; color: #333;">${address}</span></div>
          </div>
          <p style="font-size: 0; color: transparent;">${Date.now()}</p>
        </body>
      </html>
      `,
    });

    res.json({ success: true, message: "Order placed and email sent" });
  } catch (err) {
    console.error("Submit or email error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/newOrderCount", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT COUNT(*) FROM orders WHERE seen = false"
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error("❌ Failed to count new orders:", err);
    res.status(500).json({ count: 0 });
  }
});
app.post("/api/markOrdersSeen", async (req, res) => {
  try {
    await db.query("UPDATE orders SET seen = true WHERE seen = false");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to mark orders as seen:", err);
    res.status(500).json({ success: false });
  }
});

// ✅ Order APIs
app.get("/api/orders/:mobile", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM orders WHERE mobile = $1 ORDER BY order_id DESC",
      [req.params.mobile]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json([]);
  }
});
app.get("/api/orderDetails/:id", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM orders WHERE order_id = $1", [
      req.params.id,
    ]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false });
    res.json({ success: true, order: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});
app.get("/api/allOrders", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM orders ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch {
    res.status(500).json([]);
  }
});
app.post("/api/updateDeliveryCharge", async (req, res) => {
  const { order_id, d_charge } = req.body;

  try {
    await db.query("UPDATE orders SET d_charge = $1 WHERE order_id = $2", [
      d_charge,
      order_id,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Update failed" });
  }
});
app.post("/api/updateStatus", async (req, res) => {
  const { order_id, status } = req.body;
  try {
    await db.query("UPDATE orders SET status = $1 WHERE order_id = $2", [
      status,
      order_id,
    ]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});
app.post("/api/deleteOrders", async (req, res) => {
  try {
    await db.query("DELETE FROM orders WHERE order_id = ANY($1::text[])", [
      req.body.ids,
    ]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});
app.post("/api/cancelOrder", async (req, res) => {
  try {
    await db.query(
      "UPDATE orders SET status = 'canceled' WHERE order_id = $1",
      [req.body.order_id]
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});

// ✅ Products
app.post("/api/addProduct", async (req, res) => {
  const { name, price, imageBase64, d_charge } = req.body;

  if (!name || !price || !imageBase64) {
    return res.status(400).json({ success: false });
  }

  try {
    const result = await db.query(
      `SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS next_id FROM products`
    );
    const newId = result.rows[0].next_id.toString().padStart(4, "0");

    await db.query(
      "INSERT INTO products (id, name, price, d_charge) VALUES ($1, $2, $3, $4)",
      [newId, name, price, d_charge]
    );
    await db.query(
      "INSERT INTO product_images (id, image_base64) VALUES ($1, $2)",
      [newId, imageBase64]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Product add failed:", err);
    res.status(500).json({ success: false });
  }
});

app.get("/api/getAllProductsWithImages", async (req, res) => {
  try {
    const query = `
      SELECT p.id, p.name, p.price, i.image_base64, d_charge
      FROM products p
      LEFT JOIN product_images i ON p.id = i.id
      ORDER BY p.id DESC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Failed to fetch products:", err);
    res.status(500).json([]);
  }
});

app.get("/api/productImage/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "SELECT image_base64 FROM product_images WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Not found");
    }

    const base64 = result.rows[0].image_base64;
    const imgBuffer = Buffer.from(base64, "base64");

    res.setHeader("Content-Type", "image/jpeg");
    res.send(imgBuffer);
  } catch (err) {
    console.error("❌ Failed to load image:", err);
    res.status(500).send("Server error");
  }
});

app.post("/api/deleteProducts", async (req, res) => {
  const { ids } = req.body;
  try {
    await db.query("DELETE FROM product_images WHERE id = ANY($1::text[])", [
      ids,
    ]);
    await db.query("DELETE FROM products WHERE id = ANY($1::text[])", [ids]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete Products Error:", err);
    res.status(500).json({ success: false });
  }
});

// ✅ Fallback
app.get("/viewOrder", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "viewOrder.html"));
});
app.get("/order/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "order.html"));
});
app.get("/viewOrder/:mobile", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "viewOrder.html"));
});
app.get("/previewOrder/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "previewOrder.html"));
});
app.get("/admin/*", (req, res) => {
  res.sendFile(path.join(__dirname, "admin", "index.html"));
});
app.get("/", (req, res) => res.redirect("/home"));
app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});
app.get("/forgot", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "forgot.html"));
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
