/* ===================================================================
   audio.jsx — Web Audio engine
   - source: HTMLAudioElement (MP3 via presigned MinIO URL)
   - chain : source → 8-band BiquadFilter EQ → Gain → Analyser → Destination
   - exposes useAudio() hook
   =================================================================== */

const { useState, useEffect, useRef, useCallback } = React;

const EQ_BANDS = [60, 170, 310, 600, 1000, 3000, 6000, 12000];

function useAudio(initialQueue, opts) {
  opts = opts || {};
  const ctxRef       = useRef(null);
  const audioElRef   = useRef(null);
  const srcNodeRef   = useRef(null);
  const eqNodesRef   = useRef([]);
  const gainRef      = useRef(null);
  const analyserRef  = useRef(null);

  const [queue, setQueue]       = useState(initialQueue || []);
  const [idx, setIdx]           = useState(0);
  const [isPlaying, setPlaying] = useState(false);
  const [time, setTime]         = useState(0);
  const [duration, setDuration] = useState(180);
  const [vol, setVolState]      = useState(0.7);
  const [eq, setEq]             = useState(() => Array(EQ_BANDS.length).fill(0));
  const [favs, setFavs]         = useState(() => new Set(opts.initialFavs || []));

  // ref to always reach the latest next() from the long-lived "ended" listener
  const nextRef = useRef(() => {});

  const ensureCtx = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    ctxRef.current = ctx;

    const audioEl = new Audio();
    audioEl.crossOrigin = "anonymous";
    audioEl.preload = "metadata";
    audioElRef.current = audioEl;

    const src = ctx.createMediaElementSource(audioEl);
    srcNodeRef.current = src;

    const filters = EQ_BANDS.map((f, i) => {
      const bq = ctx.createBiquadFilter();
      bq.type = i === 0
        ? "lowshelf"
        : (i === EQ_BANDS.length - 1 ? "highshelf" : "peaking");
      bq.frequency.value = f;
      bq.Q.value = 1.0;
      bq.gain.value = 0;
      return bq;
    });
    eqNodesRef.current = filters;

    const gain = ctx.createGain();
    gain.gain.value = vol;
    gainRef.current = gain;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.78;
    analyserRef.current = analyser;

    let node = src;
    filters.forEach(f => { node.connect(f); node = f; });
    node.connect(gain);
    gain.connect(analyser);
    analyser.connect(ctx.destination);

    audioEl.addEventListener("timeupdate", () => setTime(audioEl.currentTime));
    audioEl.addEventListener("loadedmetadata", () => {
      if (audioEl.duration && isFinite(audioEl.duration)) {
        setDuration(audioEl.duration);
      }
    });
    audioEl.addEventListener("ended", () => nextRef.current());

    return ctx;
  }, [vol]);

  const current = queue[idx] || null;

  // Load metadata when the active track changes via external means
  // (e.g. auto-advance). Playback itself is driven by playIndex().
  useEffect(() => {
    if (!current) return;
    setDuration(current.duration || 180);
  }, [current && current.id]);

  // Single source of truth for "start playing track at index i".
  // Sets idx AND wires up the audio element synchronously, so there is
  // no stale-closure mismatch between the selected and the played track.
  const playIndex = useCallback((i) => {
    const t = queue[i];
    if (!t) return;
    const ctx = ensureCtx();
    if (ctx.state === "suspended") ctx.resume();
    setIdx(i);
    setTime(0);
    setDuration(t.duration || 180);
    if (t.src) {
      const audioEl = audioElRef.current;
      if (audioEl.src !== t.src) { audioEl.src = t.src; audioEl.load(); }
      audioEl.currentTime = 0;
      audioEl.play().catch(() => {});
    }
    setPlaying(true);
  }, [queue, ensureCtx]);

  const play = useCallback(() => {
    const t = queue[idx];
    if (!t) return;
    const ctx = ensureCtx();
    if (ctx.state === "suspended") ctx.resume();
    if (t.src) {
      const audioEl = audioElRef.current;
      if (audioEl.src !== t.src) { audioEl.src = t.src; audioEl.load(); }
      audioEl.play().catch(() => {});
    }
    setPlaying(true);
  }, [idx, queue, ensureCtx]);

  const pause = useCallback(() => {
    if (audioElRef.current) audioElRef.current.pause();
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    isPlaying ? pause() : play();
  }, [isPlaying, play, pause]);

  const playTrack = useCallback((trackId) => {
    const i = queue.findIndex(t => t.id === trackId);
    if (i < 0) return;
    playIndex(i);
  }, [queue, playIndex]);

  const next = useCallback(() => {
    if (queue.length === 0) return;
    playIndex((idx + 1) % queue.length);
  }, [queue.length, idx, playIndex]);

  const prev = useCallback(() => {
    if (queue.length === 0) return;
    playIndex((idx - 1 + queue.length) % queue.length);
  }, [queue.length, idx, playIndex]);

  useEffect(() => { nextRef.current = next; }, [next]);

  const seek = useCallback((t) => {
    const audioEl = audioElRef.current;
    const cur = queue[idx];
    if (cur && cur.src && audioEl) {
      audioEl.currentTime = t;
    }
    setTime(t);
  }, [idx, queue]);

  const setVol = useCallback((v) => {
    setVolState(v);
    if (gainRef.current) gainRef.current.gain.value = v;
  }, []);

  const setEqBand = useCallback((i, gainDb) => {
    setEq(prev => {
      const next = prev.slice();
      next[i] = gainDb;
      return next;
    });
    const node = eqNodesRef.current[i];
    if (node) node.gain.value = gainDb;
  }, []);

  const resetEq = useCallback(() => {
    setEq(Array(EQ_BANDS.length).fill(0));
    eqNodesRef.current.forEach(n => n.gain.value = 0);
  }, []);

  const toggleFav = useCallback(async (id, pk) => {
    setFavs(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    if (pk && window.UNISON_CSRF) {
      try {
        await fetch(`/api/tracks/${pk}/favorite/`, {
          method: "POST",
          headers: { "X-CSRFToken": window.UNISON_CSRF },
          credentials: "same-origin",
        });
      } catch (e) { /* local state stays optimistic */ }
    }
  }, []);

  const addTrack = useCallback((track) => {
    setQueue(q => q.some(t => t.id === track.id) ? q : [track, ...q]);
  }, []);

  const removeTrack = useCallback((id) => {
    setQueue(q => {
      const i = q.findIndex(t => t.id === id);
      const next = q.filter(t => t.id !== id);
      setIdx(curIdx => {
        if (i < 0) return curIdx;
        if (curIdx > i) return Math.max(0, curIdx - 1);
        if (curIdx === i) return Math.min(next.length - 1, curIdx);
        return curIdx;
      });
      return next;
    });
    setFavs(prev => { const n = new Set(prev); n.delete(id); return n; });
  }, []);

  const updateTrack = useCallback((id, patch) => {
    setQueue(q => q.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  return {
    queue, setQueue, idx, current,
    isPlaying, time, duration,
    play, pause, toggle, next, prev, seek, playTrack,
    vol, setVol,
    eq, setEqBand, resetEq, EQ_BANDS,
    analyser: analyserRef,
    favs, toggleFav,
    addTrack, removeTrack, updateTrack,
    ensureCtx,
  };
}

/* -------------------------------------------------------------------
   <Visualizer>
   ------------------------------------------------------------------- */
function Visualizer({ analyserRef, isPlaying, style = "bars", color = "#d957a6", silent = false }) {
  const cvRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let w, h, dpr;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = cv.getBoundingClientRect();
      w = rect.width; h = rect.height;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    let data;
    const fakeBins = 64;
    const fakeData = new Uint8Array(fakeBins);
    const fillFake = (t) => {
      const bpm = 96;
      const bsec = 60 / bpm;
      const beat = (t % bsec) / bsec;
      for (let i = 0; i < fakeBins; i++) {
        const norm = i / fakeBins;
        const lowMix = Math.exp(-norm * 6);
        const midMix = Math.exp(-Math.pow((norm - 0.35) * 4, 2));
        const highMix = Math.exp(-Math.pow((norm - 0.8) * 5, 2));
        const kick = lowMix * Math.max(0, 1 - beat * 3) * 0.95;
        const mid  = midMix * (0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i * 0.7)));
        const hi   = highMix * (0.3 + 0.7 * Math.abs(Math.sin(t * 7 + i * 1.3)));
        const noise = 0.08 * Math.random();
        let v = kick + mid * 0.7 + hi * 0.5 + noise;
        v = Math.min(1, v) * 0.7 + 0.05;
        fakeData[i] = Math.floor(v * 255);
      }
    };

    const draw = () => {
      const an = analyserRef && analyserRef.current;
      ctx.clearRect(0, 0, w, h);

      let useReal = !!an && !silent;
      if (useReal) {
        if (!data || data.length !== an.frequencyBinCount) {
          data = new Uint8Array(an.frequencyBinCount);
        }
        an.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        if (sum < 2) useReal = false;
      }

      const t = performance.now() / 1000;
      if (!useReal && isPlaying) fillFake(t);
      const src = useReal ? data : fakeData;
      const len = src.length;

      if (style === "bars") {
        const bars = 48;
        const slice = Math.max(1, Math.floor(len / bars));
        const gap = 3;
        const bw = (w - (bars - 1) * gap) / bars;
        for (let i = 0; i < bars; i++) {
          let v = 0;
          for (let j = 0; j < slice; j++) v = Math.max(v, src[Math.min(len-1, i * slice + j)] || 0);
          v = isPlaying ? v / 255 : v / 255 * 0.05;
          const bh = Math.max(2, v * h * 0.92);
          const grd = ctx.createLinearGradient(0, h - bh, 0, h);
          grd.addColorStop(0, color);
          grd.addColorStop(1, hexToRgba(color, 0.4));
          ctx.fillStyle = grd;
          ctx.fillRect(i * (bw + gap), h - bh, bw, bh);
        }
      } else if (style === "wave") {
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        if (useReal) {
          const wave = new Uint8Array(an.fftSize);
          an.getByteTimeDomainData(wave);
          for (let i = 0; i < wave.length; i++) {
            const x = (i / wave.length) * w;
            const y = (wave[i] / 255) * h;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
        } else if (isPlaying) {
          const N = 200;
          for (let i = 0; i < N; i++) {
            const x = (i / N) * w;
            const norm = i / N;
            const amp = (0.3 + 0.6 * Math.sin(t * 4 + norm * 12)) * 0.5;
            const wob = Math.sin(t * 3 + norm * 30) * 0.15;
            const y = h * 0.5 + (amp + wob) * h * 0.4;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
        } else {
          ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
        }
        ctx.stroke();
      } else if (style === "dots") {
        const cols = 32, rows = 12;
        const slice = Math.max(1, Math.floor(len / cols));
        const cw = w / cols, ch = h / rows;
        for (let c = 0; c < cols; c++) {
          let v = 0;
          for (let j = 0; j < slice; j++) v = Math.max(v, src[Math.min(len-1, c * slice + j)] || 0);
          v = isPlaying ? v / 255 : 0;
          const litRows = Math.round(v * rows);
          for (let r = 0; r < rows; r++) {
            ctx.fillStyle = r < litRows ? color : "rgba(0,0,0,0.08)";
            ctx.fillRect(c * cw + cw * 0.25, h - (r + 1) * ch + ch * 0.25, cw * 0.5, ch * 0.5);
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [style, color, isPlaying, analyserRef, silent]);

  return <canvas ref={cvRef} />;
}

function hexToRgba(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

Object.assign(window, { useAudio, Visualizer, EQ_BANDS, hexToRgba });
