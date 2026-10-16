const express = require("express");
const sql = require("mssql");
const path = require("path");
require("dotenv").config();
 
const app = express();
const PORT = Number(process.env.PORT) || 3000;
 
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
 
const sqlConfig = {
  user: process.env.DB_USER,
  domain: process.env.DB_DOMAIN,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME,
  
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: true
  },
  
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  
  connectionTimeout: 15000,
  requestTimeout: 15000
};
 
let poolPromise = null;
 
async function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(sqlConfig)
      .connect()
      .then((pool) => {
        console.log("✅ Databáze je připojena.");
        return pool;
      })
      .catch((error) => {
        poolPromise = null;
        throw error;
      });
  }
  return poolPromise;
}
 
app.get("/api/health", async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query("SELECT 1 AS connected");
    
    res.json({
      success: true,
      database: "connected"
    });
  } catch (error) {
    console.error("❌ SQL připojení selhalo:", error.message);
    res.status(500).json({
      success: false,
      database: "disconnected",
      error: error.message
    });
  }
});
 
// NOVÝ, BEZPEČNĚJŠÍ DOTAZ - Vrátí jen 1 nejnovější stav pro každý stroj
app.get("/api/lines", async (req, res) => {
  try {
    const pool = await getPool();
    
    const result = await pool.request().query(`
      SELECT t1.[id], t1.[name], t1.[status], t1.[timestamp]
      FROM [dbo].[Foundry_GravityCastingPi_Cycles_V2] t1
      INNER JOIN (
          SELECT [name], MAX([timestamp]) as max_time
          FROM [dbo].[Foundry_GravityCastingPi_Cycles_V2]
          GROUP BY [name]
      ) t2 ON t1.[name] = t2.[name] AND t1.[timestamp] = t2.max_time
      ORDER BY t1.[name] ASC
    `);
    
    res.json({
      success: true,
      count: result.recordset.length,
      data: result.recordset
    });
  } catch (error) {
    console.error("❌ Načtení dat selhalo:", error.message);
    res.status(500).json({
      success: false,
      message: "Nepodařilo se načíst data z databáze.",
      error: error.message
    });
  }
});
 
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
 
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Web běží na portu ${PORT}`);
  console.log(`📡 Lokálně: http://localhost:${PORT}`);
});
 
server.on("error", (error) => {
  console.error("❌ Chyba webového serveru:", error);
});