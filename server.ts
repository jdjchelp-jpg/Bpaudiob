import express from 'express';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { createServer as createViteServer } from 'vite';

interface CloudJob {
  id: string;
  type: 'video' | 'image';
  status: 'queued' | 'rendering' | 'completed' | 'error';
  progress: number; // 0 - 100
  stage: string;
  resolution: string;
  durationSeconds: number;
  fileName: string;
  filePath: string;
  fileSize?: number;
  downloadUrl?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

const jobs = new Map<string, CloudJob>();
const EXPORTS_DIR = path.join(process.cwd(), 'public', 'cloud_exports');
const REGISTRY_FILE = path.join(EXPORTS_DIR, 'jobs_registry.json');

// Ensure exports directory exists
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

function saveJobsRegistry() {
  try {
    const obj = Object.fromEntries(jobs.entries());
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error('Failed to save jobs registry:', err);
  }
}

function loadJobsRegistry() {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
      for (const [k, v] of Object.entries(data)) {
        jobs.set(k, v as CloudJob);
      }
    }
  } catch (err) {
    console.error('Failed to load jobs registry:', err);
  }
}

// Load persisted jobs on start
loadJobsRegistry();

// Convert seconds to ASS timestamp format: H:MM:SS.cs
function formatAssTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const cs = Math.floor((s - Math.floor(s)) * 100);
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const cc = String(cs).padStart(2, '0');
  return `${hrs}:${mm}:${ss}.${cc}`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // CORS middleware to support iframe / external reverse proxy environments
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Generous limit for high-res snapshot and cover art uploads
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Static serving for exports
  app.use('/cloud_exports', express.static(EXPORTS_DIR));

  // ----------------------------------------------------
  // API Routes
  // ----------------------------------------------------
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      cloudProcessing: true,
      ffmpeg: true,
      uptime: process.uptime(),
    });
  });

  // Export History
  app.get('/api/export/history', (req, res) => {
    const list = Array.from(jobs.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);
    res.json(list);
  });

  // Export Job Status
  app.get('/api/export/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  });

  // Direct File Download
  app.get('/api/export/download/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Render job not found' });
    }
    if (job.status !== 'completed') {
      return res.status(400).json({
        error: `Video is still encoding on the cloud server (${job.progress}% complete: ${job.stage}). Please wait for rendering to finish.`,
        progress: job.progress,
        stage: job.stage,
      });
    }
    if (!fs.existsSync(job.filePath)) {
      return res.status(404).json({ error: 'Rendered video file not found or expired' });
    }
    res.download(job.filePath, job.fileName);
  });

  // Delete Job
  app.delete('/api/export/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (job) {
      try {
        if (fs.existsSync(job.filePath)) {
          fs.unlinkSync(job.filePath);
        }
      } catch (err) {
        console.error('Failed to unlink file:', err);
      }
      jobs.delete(req.params.jobId);
      saveJobsRegistry();
    }
    res.json({ success: true });
  });

  // Cloud Image Export
  app.post('/api/export/cloud-image', async (req, res) => {
    try {
      const { imageDataUrl, resolution = '4k', title = 'audiobook-overlay' } = req.body;
      if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Valid imageDataUrl is required' });
      }

      const jobId = `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const safeTitle = (title || 'audiobook').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${safeTitle}-${resolution}-${Date.now()}.png`;
      const filePath = path.join(EXPORTS_DIR, fileName);

      fs.writeFileSync(filePath, buffer);
      const fileSize = fs.statSync(filePath).size;

      const job: CloudJob = {
        id: jobId,
        type: 'image',
        status: 'completed',
        progress: 100,
        stage: 'Completed in Cloud Storage',
        resolution,
        durationSeconds: 0,
        fileName,
        filePath,
        fileSize,
        downloadUrl: `/api/export/download/${jobId}`,
        createdAt: Date.now(),
        completedAt: Date.now(),
      };

      jobs.set(jobId, job);
      saveJobsRegistry();
      res.json(job);
    } catch (err: any) {
      console.error('Cloud image export error:', err);
      res.status(500).json({ error: err.message || 'Cloud image export failed' });
    }
  });

  // Cloud Video Render
  app.post('/api/export/cloud-render', async (req, res) => {
    try {
      const {
        resolution = '1080p',
        durationSeconds = 30,
        totalDurationSeconds = 30,
        backgroundImageDataUrl,
        audioDataUrl,
        subtitles = [],
        subtitleSettings = {},
        bookMetadata = {},
        showProgressBar = true,
        fps = 30,
      } = req.body;

      if (!backgroundImageDataUrl) {
        return res.status(400).json({ error: 'backgroundImageDataUrl is required' });
      }

      const jobId = `vid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const safeTitle = (bookMetadata.title || 'audiobook-overlay').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${safeTitle}-${resolution}-${Math.round(durationSeconds)}s.mp4`;
      const filePath = path.join(EXPORTS_DIR, fileName);

      const job: CloudJob = {
        id: jobId,
        type: 'video',
        status: 'queued',
        progress: 5,
        stage: 'Queued on Cloud Server',
        resolution,
        durationSeconds,
        fileName,
        filePath,
        downloadUrl: `/api/export/download/${jobId}`,
        createdAt: Date.now(),
      };

      jobs.set(jobId, job);
      saveJobsRegistry();
      res.json({ jobId, status: 'queued', message: 'Cloud render job initialized safely' });

      // Start background render worker asynchronously without blocking response
      processCloudVideoRender(jobId, {
        resolution,
        durationSeconds: Math.min(1800, Math.max(1, Number(durationSeconds) || 30)),
        totalDurationSeconds: Math.max(1, Number(totalDurationSeconds) || durationSeconds),
        backgroundImageDataUrl,
        audioDataUrl,
        subtitles,
        subtitleSettings,
        bookMetadata,
        showProgressBar,
        fps: Math.min(60, Math.max(24, Number(fps) || 30)),
        filePath,
        fileName,
      });
    } catch (err: any) {
      console.error('Failed to create cloud render job:', err);
      res.status(500).json({ error: err.message || 'Failed to start cloud render' });
    }
  });

  // ----------------------------------------------------
  // Vite Integration
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cloud Server running on port ${PORT}`);
  });
}

// ------------------------------------------------------
// Cloud Video Render Worker (Runs entirely on Cloud Server)
// ------------------------------------------------------
interface RenderPayload {
  resolution: string;
  durationSeconds: number;
  totalDurationSeconds: number;
  backgroundImageDataUrl: string;
  audioDataUrl?: string;
  subtitles: Array<{ id: number; start: number; end: number; text: string }>;
  subtitleSettings: any;
  bookMetadata: any;
  showProgressBar: boolean;
  fps: number;
  filePath: string;
  fileName: string;
}

async function processCloudVideoRender(jobId: string, payload: RenderPayload) {
  const job = jobs.get(jobId);
  if (!job) return;

  const tempFiles: string[] = [];

  try {
    job.status = 'rendering';
    job.stage = 'Preparing high-res cloud canvas...';
    job.progress = 10;

    // 1. Determine Dimensions
    let width = 1920;
    let height = 1080;
    if (payload.resolution === '4k') {
      width = 3840;
      height = 2160;
    } else if (payload.resolution === '1440p') {
      width = 2560;
      height = 1440;
    }

    // 2. Write Base Background Image
    const isJpeg = payload.backgroundImageDataUrl.startsWith('data:image/jpeg') || payload.backgroundImageDataUrl.startsWith('data:image/jpg');
    const bgExt = isJpeg ? 'jpg' : 'png';
    const bgPath = path.join('/tmp', `cloud_${jobId}_bg.${bgExt}`);
    tempFiles.push(bgPath);
    const bgBase64 = payload.backgroundImageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(bgPath, Buffer.from(bgBase64, 'base64'));

    job.stage = 'Configuring cloud typography & subtitles...';
    job.progress = 20;

    // 3. Generate ASS Subtitle File
    const assPath = path.join('/tmp', `cloud_${jobId}_subs.ass`);
    tempFiles.push(assPath);

    // Font size scaling
    let fontSize = Math.round(width * 0.024); // ~46px for 1080p, ~92px for 4K
    if (payload.subtitleSettings?.fontSize === 'small') fontSize = Math.round(width * 0.018);
    if (payload.subtitleSettings?.fontSize === 'large') fontSize = Math.round(width * 0.030);
    if (payload.subtitleSettings?.fontSize === 'xl') fontSize = Math.round(width * 0.038);

    // Alignment: 2 = bottom center, 5 = middle center, 8 = top center
    let alignment = 2;
    let marginV = Math.round(height * 0.12);
    if (payload.subtitleSettings?.position === 'top') {
      alignment = 8;
      marginV = Math.round(height * 0.12);
    } else if (payload.subtitleSettings?.position === 'center') {
      alignment = 5;
      marginV = 0;
    }

    const marginH = Math.round(width * 0.08);

    // Style colors: ASS uses &HAABBGGRR
    // Yellow/gold highlight: &H0000D7FF, White: &H00FFFFFF
    let primaryColour = '&H00FFFFFF&';
    let outlineColour = '&H00000000&';
    let backColour = '&H80000000&';
    let borderStyle = 1; // 1 = outline + shadow, 3 = opaque box
    let outlineSize = Math.max(2, Math.round(width * 0.0018));
    let shadowSize = Math.max(1, Math.round(width * 0.0012));

    if (payload.subtitleSettings?.style === 'box') {
      borderStyle = 3;
      backColour = '&H70000000&';
      outlineSize = 8;
    } else if (payload.subtitleSettings?.style === 'yellow') {
      primaryColour = '&H0033E5FF&'; // Vibrant warm gold
    } else if (payload.subtitleSettings?.style === 'glow') {
      primaryColour = '&H00FFFFFF&';
      outlineColour = '&H008033FF&'; // Purple ambient aura
      outlineSize = Math.round(width * 0.003);
    }

    let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: AudiobookStyle,DejaVu Sans,${fontSize},${primaryColour},&H000000FF,${outlineColour},${backColour},-1,0,0,0,100,100,0,0,${borderStyle},${outlineSize},${shadowSize},${alignment},${marginH},${marginH},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // Filter subtitle cues that fall within duration
    const validCues = payload.subtitles.filter(
      (c) => c.start < payload.durationSeconds && c.text.trim().length > 0
    );

    for (const cue of validCues) {
      const cStart = formatAssTime(cue.start);
      const cEnd = formatAssTime(Math.min(payload.durationSeconds, cue.end));
      // Escape braces and replace breaks
      const cleanText = cue.text
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\r?\n/g, '\\N');

      assContent += `Dialogue: 0,${cStart},${cEnd},AudiobookStyle,,0,0,0,,${cleanText}\n`;
    }

    fs.writeFileSync(assPath, assContent);

    // 4. Audio Input Setup
    let audioInputArgs: string[] = [];
    if (payload.audioDataUrl && payload.audioDataUrl.startsWith('data:audio/')) {
      const audioPath = path.join('/tmp', `cloud_${jobId}_audio.mp3`);
      tempFiles.push(audioPath);
      const audioBase64 = payload.audioDataUrl.replace(/^data:audio\/\w+;base64,/, '');
      fs.writeFileSync(audioPath, Buffer.from(audioBase64, 'base64'));
      audioInputArgs = ['-i', audioPath];
    } else {
      // High quality stereo silence so audio sync is solid
      audioInputArgs = ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo'];
    }

    // 5. Video Filters (Scale to target resolution + Progress Bar + ASS Subtitles)
    const filters: string[] = [];

    // Scale background cleanly to target canvas dimensions (1080p, 1440p, or 4K UHD)
    filters.push(`scale=${width}:${height}:flags=bicubic`);

    if (payload.showProgressBar) {
      const barX = Math.round(width * 0.05);
      const barY = Math.round(height * 0.94);
      const barW = Math.round(width * 0.9);
      const barH = Math.max(4, Math.round(height * 0.007));
      const totalDur = Math.max(1, payload.totalDurationSeconds);

      // Draw background track
      filters.push(`drawbox=x=${barX}:y=${barY}:w=${barW}:h=${barH}:color=0xffffff@0.2:t=fill`);
      // Draw dynamic progress bar evaluating current time `t`
      filters.push(
        `drawbox=x=${barX}:y=${barY}:w='min(${barW}, ${barW}*(t/${totalDur}))':h=${barH}:color=0xa855f7@1:t=fill`
      );
    }

    // Burn in ASS subtitles using libass
    filters.push(`ass=${assPath}`);

    const vfString = filters.join(',');

    job.stage = `Cloud FFmpeg Encoding ${payload.resolution} at ${payload.fps}fps...`;
    job.progress = 30;

    const tempPartPath = path.join(path.dirname(payload.filePath), `tmp_${jobId}.mp4`);

    // 6. Spawn FFmpeg in Cloud Container
    const ffmpegArgs = [
      '-y',
      '-loop',
      '1',
      '-t',
      String(payload.durationSeconds),
      '-r',
      String(payload.fps),
      '-i',
      bgPath,
      ...audioInputArgs,
      '-vf',
      vfString,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      payload.resolution === '4k' ? '20' : '22',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-pix_fmt',
      'yuv420p',
      '-shortest',
      '-f',
      'mp4',
      tempPartPath,
    ];

    const child = spawn('ffmpeg', ffmpegArgs);

    let lastStderr = '';
    child.stderr.on('data', (data) => {
      const str = data.toString();
      lastStderr += str;
      if (lastStderr.length > 2000) lastStderr = lastStderr.slice(-2000);

      // Match time=HH:MM:SS.ms to compute real progress
      const match = str.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
      if (match) {
        const hrs = parseFloat(match[1]);
        const mins = parseFloat(match[2]);
        const secs = parseFloat(match[3]);
        const currentSecs = hrs * 3600 + mins * 60 + secs;
        const pct = Math.min(96, Math.max(30, 30 + Math.round((currentSecs / payload.durationSeconds) * 66)));
        job.progress = pct;
        job.stage = `Cloud Encoding: ${Math.round(currentSecs)}s / ${Math.round(payload.durationSeconds)}s (${pct}%)`;
      }
    });

    child.on('close', (code) => {
      // Clean up temporary assets
      for (const f of tempFiles) {
        try {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        } catch (_) {}
      }

      if (code === 0 && fs.existsSync(tempPartPath)) {
        // Atomically finalize the video file so partial 10KB files are never served
        fs.renameSync(tempPartPath, payload.filePath);
        const stats = fs.statSync(payload.filePath);
        job.status = 'completed';
        job.progress = 100;
        job.fileSize = stats.size;
        job.stage = 'Render Completed in Cloud Storage!';
        job.completedAt = Date.now();
        saveJobsRegistry();
        console.log(`Cloud render job ${jobId} finished successfully! File: ${payload.fileName} (${stats.size} bytes)`);
      } else {
        if (fs.existsSync(tempPartPath)) {
          try { fs.unlinkSync(tempPartPath); } catch (_) {}
        }
        job.status = 'error';
        job.stage = 'Cloud render encountered an error';
        job.error = `FFmpeg error: ${lastStderr.slice(-300).trim() || `exit code ${code}`}`;
        saveJobsRegistry();
        console.error(`Cloud render job ${jobId} failed with code ${code}:`, lastStderr);
      }
    });

    child.on('error', (err) => {
      job.status = 'error';
      job.stage = 'Cloud render process error';
      job.error = err.message;
      saveJobsRegistry();
      console.error(`Cloud render spawn error for ${jobId}:`, err);
    });
  } catch (err: any) {
    // Clean up temporary assets
    for (const f of tempFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (_) {}
    }
    job.status = 'error';
    job.stage = 'Cloud render failed';
    job.error = err.message || 'Unknown cloud rendering error';
    saveJobsRegistry();
    console.error(`Error in processCloudVideoRender ${jobId}:`, err);
  }
}

startServer();
