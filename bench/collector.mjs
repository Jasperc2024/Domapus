// The in-page collector, installed via addInitScript before any app code runs so
// no early entry is missed.
//
// EVERY OBSERVER IS OPTIONAL AND EVERY FIELD HAS A DEFAULT. The whole point of
// this file is that the same runner can measure a 2025 commit and today's HEAD
// and produce rows that line up. A browser or a build that cannot supply a metric
// yields `null`, which `run.mjs` carries into the result — never a zero, because a
// zero and "not measured" are different claims and conflating them is how an old
// era comes to look faster than it was.

export const COLLECTOR = `
window.__bench = {
  longTasks: [],     // { start, dur }        Long Tasks API, Chrome 58+
  loafs: [],         // { start, dur, blocking } Long Animation Frames, Chrome 123+
  events: [],        // { name, dur }         Event Timing, the lab stand-in for INP
  lcp: 0,
  fcp: null,
  cls: 0,
  shifts: 0,
  frames: null,      // set while a scenario is running
};

function obs(type, fn, extra) {
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) fn(e); })
      .observe(Object.assign({ type, buffered: true }, extra || {}));
    return true;
  } catch { return false; }
}

obs("longtask", (e) => window.__bench.longTasks.push({ start: e.startTime, dur: e.duration }));

// LoAF supersedes Long Tasks: it measures the whole frame — script, style, layout
// and paint — rather than just the script task, so it sees jank that long tasks
// miss entirely. Kept ALONGSIDE long tasks rather than replacing them, because
// every baseline in bench/results predates Chrome 123 and TBT is the number those
// baselines are quoted in.
window.__bench.loafSupported = obs("long-animation-frame", (e) => {
  window.__bench.loafs.push({
    start: e.startTime,
    dur: e.duration,
    blocking: e.blockingDuration || 0,
  });
});

// Event Timing gives per-interaction latency. In the field the Core Web Vital is
// INP, the ~98th percentile of these; in a lab with a scripted interaction suite
// the honest reading is the worst one observed, so that is what run.mjs reports
// and it is named worstInteractionMs rather than inp.
window.__bench.eventTimingSupported =
  obs("event", (e) => window.__bench.events.push({ name: e.name, dur: e.duration }),
      { durationThreshold: 16 });

obs("largest-contentful-paint", (e) => { window.__bench.lcp = e.startTime; });
obs("paint", (e) => { if (e.name === "first-contentful-paint") window.__bench.fcp = e.startTime; });
obs("layout-shift", (e) => {
  if (!e.hadRecentInput) { window.__bench.cls += e.value; window.__bench.shifts++; }
});

// Frame timing for a scripted interaction. rAF deltas are the only cross-version
// way to see dropped frames; LoAF explains WHY a frame was slow but is not
// available on the older builds this harness still has to measure.
window.__benchFrames = {
  start() {
    const rec = { t: [], raf: 0, stopped: false };
    window.__bench.frames = rec;
    const tick = (now) => {
      if (rec.stopped) return;
      rec.t.push(now);
      rec.raf = requestAnimationFrame(tick);
    };
    rec.raf = requestAnimationFrame(tick);
  },
  stop() {
    const rec = window.__bench.frames;
    if (!rec) return null;
    rec.stopped = true;
    cancelAnimationFrame(rec.raf);
    window.__bench.frames = null;
    const d = [];
    for (let i = 1; i < rec.t.length; i++) d.push(rec.t[i] - rec.t[i - 1]);
    if (d.length === 0) return { frames: 0, dropped: null, longestFrameMs: null, p95FrameMs: null };
    const sorted = d.slice().sort((a, b) => a - b);
    // A frame is "dropped" when it took longer than one and a half 60 Hz frames.
    // Not two: at 16.7 ms nominal, a 25 ms frame is already a visible hitch.
    return {
      frames: d.length,
      dropped: d.filter((x) => x > 25).length,
      longestFrameMs: sorted[sorted.length - 1],
      p95FrameMs: sorted[Math.min(sorted.length - 1, Math.floor(0.95 * (sorted.length - 1)))],
    };
  },
};
`;
