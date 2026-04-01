import express from "express";

const app = express();
app.use(express.json());

app.post("/track", async (req, res) => {
  res.send("ok");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Ingestion running"));
