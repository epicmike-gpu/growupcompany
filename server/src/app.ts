import express from "express";
import cors from "cors";
import supabaseConfigRouter from "./routes/supabase-config.js";
import profileRouter from "./routes/profile.js";
import chatRouter from "./routes/chat.js";
import voiceRouter from "./routes/voice.js";
import englishRouter from "./routes/english.js";
import authRouter from "./routes/auth.js";
import tasksRouter from "./routes/tasks.js";
import billingRouter from "./routes/billing.js";
import diagRouter from "./routes/diag.js";

const app = express();

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
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/profile', profileRouter);
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/voice', voiceRouter);
app.use('/api/v1/english', englishRouter);
app.use('/api/v1/tasks', tasksRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/diag', diagRouter);

export default app;
