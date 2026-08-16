import express from "express";
import cors from "cors";
import supabaseConfigRouter from "./routes/supabase-config.js";
import profileRouter from "./routes/profile.js";
import chatRouter from "./routes/chat.js";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/api/v1/health', (_req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/v1/supabase-config', supabaseConfigRouter);
app.use('/api/v1/profile', profileRouter);
app.use('/api/v1/chat', chatRouter);

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
