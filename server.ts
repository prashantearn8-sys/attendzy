import express from 'express';
import path from 'path';
import { parseAttendanceImageServer, parseTimetableImageServer, parseDailyScheduleServer } from './src/server/geminiService.ts';

const app = express();
const PORT = 3000;
const distPath = path.join(process.cwd(), 'dist');

app.use(express.json({ limit: '25mb' }));

// Server-side API endpoint for daily fresh schedule extraction via Gemini
app.post('/api/parse-daily-schedule', async (req, res) => {
  try {
    const { image, mimeType, date, dayName, section } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }
    const result = await parseDailyScheduleServer(image, mimeType, date, dayName, section);
    return res.json(result);
  } catch (error: any) {
    console.error('Server error in /api/parse-daily-schedule:', error);
    return res.status(500).json({ error: error?.message || 'Failed to process daily schedule image' });
  }
});

// Server-side API endpoint for timetable extraction via Gemini
app.post('/api/parse-timetable', async (req, res) => {
  try {
    const { image, mimeType, section } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }
    const result = await parseTimetableImageServer(image, mimeType, section);
    return res.json(result);
  } catch (error: any) {
    console.error('Server error in /api/parse-timetable:', error);
    return res.status(500).json({ error: error?.message || 'Failed to process timetable image' });
  }
});

// Server-side API endpoint for attendance image parsing via Gemini
app.post('/api/parse-attendance', async (req, res) => {
  try {
    const { image, mimeType, section, day } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }
    const result = await parseAttendanceImageServer(image, mimeType, section, day);
    return res.json(result);
  } catch (error: any) {
    console.error('Server error in /api/parse-attendance:', error);
    return res.status(500).json({ error: error?.message || 'Failed to process attendance image' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static assets in production
app.use(express.static(distPath));

// Fallback all other routes to SPA index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
