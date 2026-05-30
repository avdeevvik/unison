/* ===================================================================
   screens.jsx — Library, Edit, Player panes
   Adapted for Django backend: tracks and playlists come from API,
   uploads go through multipart POST.
   =================================================================== */

const { useState: uS, useEffect: uE, useRef: uR, useCallback: uC, useMemo: uM } = React;

const fmtTime = (s) => {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${ss < 10 ? "0" : ""}${ss}`;
};

const accentMap = {
  magenta: { color: "#d957a6", hex: "#d957a6" },
  amber:   { color: "#f0a541", hex: "#f0a541" },
  green:   { color: "#7bd95a", hex: "#7bd95a" },
  cyan:    { color: "#5ad9d9", hex: "#5ad9d9" },
};

const GENRES = [
  "Synthwave","Ambient","Lo-fi","Drone","Folk-tronic",
  "Post","Spoken","Rock","Pop","Electronic","Jazz","Classical","Other",
];

/* -------- CSRF helper -------- */
function csrfHeaders(extra) {
  const h = { "X-CSRFToken": window.UNISON_CSRF || "" };
  if (extra) Object.assign(h, extra);
  return h;
}
window.unisonCsrfHeaders = csrfHeaders;

/* ===========================================================
   TV-SHAPED SCREEN
   =========================================================== */
function TvScreen({ children, tweaks }) {
  const accent = accentMap[tweaks.accent] || accentMap.magenta;
  // tv-carpet.png rendered at width 1060 inside .tv-frame (scale 1.274 from 832 original).
  // Image is shifted up by -40px in the frame.
  // Real cream face in original image coords (matched to /home/): x 168–554, y 127–430.
  const boxLeft = 210;
  const boxTop  = 115;
  const boxW    = 500;
  const boxH    = 404;
  return (
    <div
      className={"tv-screen " + (tweaks.crtEffect ? "crt" : "")}
      style={{
        left:   boxLeft + "px",
        top:    boxTop + "px",
        width:  boxW + "px",
        height: boxH + "px",
        ["--accent"]: accent.color,
      }}
    >
      {tweaks.crtEffect && <div className="crt-flicker"></div>}
      <div className="screen-inner">{children}</div>
      <div className="tv-mask" aria-hidden="true"></div>
    </div>
  );
}

/* ===========================================================
   PLAYER
   =========================================================== */
function Player({ audio, tweaks, onAddTrack }) {
  const t = audio.current;
  const accent = accentMap[tweaks.accent] || accentMap.magenta;
  const [eqOpen, setEqOpen] = uS(false);
  const progressRef = uR(null);
  const volRef = uR(null);

  if (!t) {
    return (
      <div className="player-empty">
        <div className="empty-tag">
          <span className="led"></span>
          <span>CH 00 · НЕТ СИГНАЛА</span>
        </div>
        <h2 className="empty-title">ФОНОТЕКА<br/>ПУСТА</h2>
        <p className="empty-sub">
          загрузи первый MP3 —<br/>и эфир откроется.
        </p>
        <button className="empty-cta" type="button" onClick={onAddTrack}>
          <span className="bullet">▸</span> ЗАГРУЗИТЬ ТРЕК
        </button>
        <div className="empty-bars" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
    );
  }

  const scrub = (e) => {
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.seek(ratio * audio.duration);
  };
  const scrubVol = (e) => {
    const rect = volRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.setVol(ratio);
  };

  const pct = (audio.time / Math.max(1, audio.duration)) * 100;
  const coverBg = t.cover
    ? `url(${t.cover}) center/cover, ${t.color || "#6e1d1d"}`
    : (t.color || "linear-gradient(135deg,#6e1d1d,#2c1a0d)");

  return (
    <div className="player">
      <div className="top">
        <div className="ch">
          <span>CH</span><span className="num">07</span><span>ЭФИР</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span>STEREO · 320 kbps</span>
          <span className="signal">
            <span></span><span></span><span></span><span></span>
          </span>
        </div>
      </div>

      <div className="now-row">
        <div className="now-cover" style={{ background: coverBg }}></div>
        <div className="now-info">
          <h3 className="title">{t.title}</h3>
          <div className="artist">{t.artist || "—"}</div>
          <div className="genre">{t.genre || "—"} · {fmtTime(audio.duration)}</div>
        </div>
      </div>

      <div className="viz-wrap">
        <span className="viz-label">VU · 16 Hz – 16 kHz</span>
        <Visualizer
          analyserRef={audio.analyser}
          isPlaying={audio.isPlaying}
          style={tweaks.visualizerStyle}
          color={accent.hex}
        />
      </div>

      <div className="progress">
        <span>{fmtTime(audio.time)}</span>
        <div className="bar" ref={progressRef} onClick={scrub}>
          <div className="fill" style={{ width: pct + "%" }}></div>
          <div className="head" style={{ left: pct + "%" }}></div>
        </div>
        <span>{fmtTime(audio.duration)}</span>
      </div>

      <div className="controls">
        <div className="left">
          <button className={"ctl small toggle " + (audio.favs.has(t.id) ? "on" : "")}
                  onClick={() => audio.toggleFav(t.id, t.pk)} title="В избранное">
            {audio.favs.has(t.id) ? "♥" : "♡"}
          </button>
          <button className={"ctl small toggle " + (eqOpen ? "on" : "")}
                  onClick={() => setEqOpen(v => !v)} title="Эквалайзер">EQ</button>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button className="ctl" onClick={audio.prev} title="Предыдущий">◀◀</button>
          <button className="ctl big" onClick={audio.toggle}
                  title={audio.isPlaying ? "Пауза" : "Играть"}>
            {audio.isPlaying ? "❚❚" : "▶"}
          </button>
          <button className="ctl" onClick={audio.next} title="Следующий">▶▶</button>
        </div>
        <div className="right">
          <div className="volume">
            <span>VOL</span>
            <div className="vbar" ref={volRef} onClick={scrubVol}>
              <div className="vfill" style={{ width: (audio.vol * 100) + "%" }}></div>
            </div>
            <span>{Math.round(audio.vol * 100)}</span>
          </div>
        </div>
      </div>

      {eqOpen && (
        <div className="eq">
          {audio.EQ_BANDS.map((f, i) => {
            const v = audio.eq[i];
            const ratioPct = ((v + 12) / 24) * 100;
            return (
              <div
                key={f}
                className="eq-band"
                onPointerDown={(e) => {
                  const target = e.currentTarget.querySelector(".slider");
                  const rect = target.getBoundingClientRect();
                  const move = (mE) => {
                    const ratio = Math.min(1, Math.max(0, (rect.bottom - mE.clientY) / rect.height));
                    audio.setEqBand(i, ratio * 24 - 12);
                  };
                  move(e);
                  const up = () => {
                    window.removeEventListener("pointermove", move);
                    window.removeEventListener("pointerup", up);
                  };
                  window.addEventListener("pointermove", move);
                  window.addEventListener("pointerup", up);
                }}
              >
                <div className="slider">
                  <div className="thumb" style={{ bottom: `calc(${ratioPct}% - 3px)` }}></div>
                </div>
                <span className="lbl">{f >= 1000 ? (f / 1000) + "k" : f}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ===========================================================
   EDIT pane — upload / edit track
   =========================================================== */
function EditPane({ audio, onClose, editing }) {
  const isNew = !editing;
  const [tab, setTab] = uS(isNew ? "add" : "edit");
  const [form, setForm] = uS(() => editing ? {
    title: editing.title, artist: editing.artist || "",
    genre: editing.genre || "Other", file: null, cover: null,
  } : {
    title: "", artist: "", genre: "Synthwave", file: null, cover: null, fileName: null,
  });
  const [drag, setDrag] = uS(false);
  const [busy, setBusy] = uS(false);
  const [err, setErr] = uS(null);
  const savingRef = uR(false);  // hard lock against double-submit races

  const handleFile = (f) => {
    if (!f) return;
    setForm(s => ({
      ...s,
      file: f,
      fileName: f.name,
      title: s.title || f.name.replace(/\.[^.]+$/, ""),
    }));
  };

  const save = async () => {
    if (savingRef.current) return;        // ignore rapid second click
    if (isNew && !form.file) {
      setErr("Сначала выбери MP3 файл.");
      return;
    }
    savingRef.current = true;
    setBusy(true); setErr(null);
    let ok = false;
    try {
      if (isNew) {
        const fd = new FormData();
        fd.append("file", form.file);
        if (form.cover) fd.append("cover", form.cover);
        fd.append("title", form.title);
        fd.append("artist", form.artist);
        fd.append("genre", form.genre);
        const res = await fetch(window.UNISON_URLS.upload, {
          method: "POST", headers: csrfHeaders(), body: fd, credentials: "same-origin",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg = data.errors
            ? Object.values(data.errors).flat().join(" / ")
            : "Не удалось загрузить трек.";
          setErr(msg);
        } else {
          const data = await res.json();
          audio.addTrack(data.track);
          ok = true;
        }
      } else {
        const res = await fetch(`/api/tracks/${editing.pk}/`, {
          method: "PATCH",
          headers: csrfHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            title: form.title, artist: form.artist, genre: form.genre,
          }),
          credentials: "same-origin",
        });
        if (!res.ok) { setErr("Не удалось сохранить."); }
        else {
          const data = await res.json();
          audio.updateTrack(editing.id, data.track);
          ok = true;
        }
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
    if (ok) onClose();
  };

  const del = async () => {
    if (!editing) return;
    if (!confirm("Удалить трек безвозвратно?")) return;
    setBusy(true);
    const res = await fetch(`/api/tracks/${editing.pk}/`, {
      method: "DELETE", headers: csrfHeaders(), credentials: "same-origin",
    });
    setBusy(false);
    if (res.ok) { audio.removeTrack(editing.id); onClose(); }
    else setErr("Не удалось удалить.");
  };

  const ready = isNew ? !!form.file : true;

  return (
    <div className="edit-pane">
      <div className="edit-head">
        <h2>{isNew ? "ЗАГРУЗКА" : "РЕДАКТОР"}</h2>
        <button className="close" onClick={onClose}>закрыть ✕</button>
      </div>

      <div className="edit-tabs">
        <button className={"tab " + (tab === "add" ? "active" : "")}
                onClick={() => setTab("add")} disabled={!isNew}>+ добавить</button>
        <button className={"tab " + (tab === "edit" ? "active" : "")}
                onClick={() => setTab("edit")} disabled={isNew}>✎ изменить</button>
      </div>

      <div className="edit-form">
        {isNew && (
          <>
            <label
              className={"dropzone " + (drag ? "over" : "") + (form.file ? " filled" : "")}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
            >
              <strong>{form.fileName || "Выбрать MP3 файл"}</strong>
              <div className="hint">
                {form.fileName
                  ? "файл выбран · нажми «ЗАГРУЗИТЬ»"
                  : "клик или перетащи сюда"}
              </div>
              <input type="file" accept="audio/*,.mp3"
                     style={{
                       position: "absolute", width: 1, height: 1,
                       padding: 0, margin: -1, overflow: "hidden",
                       clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0,
                     }}
                     onChange={e => handleFile(e.target.files[0])} />
            </label>
            <div className="full file-fallback">
              <span className="lbl-inline">или системный выбор:</span>
              <input type="file" accept="audio/*,.mp3"
                     onChange={e => handleFile(e.target.files[0])} />
            </div>
          </>
        )}

        <div className="lbl">название</div>
        <input type="text" value={form.title}
               onChange={e => setForm(s => ({ ...s, title: e.target.value }))}
               placeholder="Название трека" />

        <div className="lbl">исполнитель</div>
        <input type="text" value={form.artist}
               onChange={e => setForm(s => ({ ...s, artist: e.target.value }))}
               placeholder="—" />

        <div className="lbl">жанр</div>
        <select value={form.genre}
                onChange={e => setForm(s => ({ ...s, genre: e.target.value }))}>
          {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        {isNew && (
          <>
            <div className="lbl">обложка</div>
            <label className="btn secondary"
                   style={{ padding: "4px 10px", fontSize: 14, display: "inline-block",
                            cursor: "pointer", textAlign: "center" }}>
              {form.cover ? form.cover.name : "выбрать картинку"}
              <input type="file" accept="image/*"
                     style={{
                       position: "absolute", width: 1, height: 1,
                       padding: 0, margin: -1, overflow: "hidden",
                       clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0,
                     }}
                     onChange={e => setForm(s => ({ ...s, cover: e.target.files[0] }))} />
            </label>
          </>
        )}

        {err && (
          <div className="full edit-alert">
            <span className="dot"></span>
            <span>{err}</span>
            <button className="x" onClick={() => setErr(null)}>✕</button>
          </div>
        )}

        <div className="full">
          <div className="edit-actions">
            {!isNew && (
              <button className="btn danger" onClick={del} disabled={busy}
                      title="удалить трек">🗑</button>
            )}
            <button className="btn secondary" onClick={onClose} disabled={busy}>
              ОТМЕНА
            </button>
            <button className="btn" onClick={save} disabled={busy}>
              {busy ? "..." : (isNew ? "ЗАГРУЗИТЬ →" : "СОХРАНИТЬ →")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================
   LIBRARY pane
   =========================================================== */
function LibraryPane({ audio, onPick, onAdd, onEdit, onRequestAdd, filterGenre, setFilterGenre, query, setQuery }) {
  const filtered = audio.queue.filter(t =>
    (filterGenre === "all" || t.genre === filterGenre) &&
    (!query || (t.title + " " + (t.artist || "")).toLowerCase().includes(query.toLowerCase()))
  );
  const genres = ["all", ...Array.from(new Set(audio.queue.map(t => t.genre).filter(Boolean)))];

  return (
    <div className="lib-grid">
      <div className="lib-toolbar">
        <span>фонотека · {filtered.length} тр.</span>
        <select value={filterGenre} onChange={e => setFilterGenre(e.target.value)}>
          {genres.map(g => <option key={g} value={g}>{g === "all" ? "все жанры" : g}</option>)}
        </select>
        <button className="act" style={{
          marginLeft: "auto", fontFamily: "IBM Plex Mono", fontSize: 10,
          letterSpacing: "0.16em", color: "#1a0f06", border: "1px solid #1a0f06",
          padding: "3px 8px"
        }} onClick={onAdd}>+ добавить</button>
      </div>
      <div className="lib-rows">
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "#6e4628", padding: 28, fontSize: 12 }}>
            ничего не нашлось.<br/>
            <button onClick={onAdd}
                    style={{ color: "#1a0f06", textDecoration: "underline", marginTop: 8 }}>
              загрузить новый трек →
            </button>
          </div>
        )}
        {filtered.map((t, i) => (
          <div className="lib-row" key={t.id} onClick={() => onPick(t.id)}>
            <span className="num">{String(i + 1).padStart(2, "0")}</span>
            <div className="cv" style={{
              background: t.cover ? `url(${t.cover}) center/cover, ${t.color}` : t.color,
            }}></div>
            <div>
              <div className="nm">{t.title}</div>
              <div className="ar">{t.artist || "—"} · {t.genre || "—"}</div>
            </div>
            <span className="du">{fmtTime(t.duration)}</span>
            <button className="act"
                    onClick={(e) => { e.stopPropagation(); onRequestAdd(t); }}
                    title="в плейлист">+</button>
            <button className="act"
                    onClick={(e) => { e.stopPropagation(); onEdit(t); }}
                    title="изменить">✎</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===========================================================
   ADD-TO-PLAYLIST MODAL
   =========================================================== */
function AddToPlaylistModal({ track, playlists, onAdd, onCreate, onClose }) {
  const [newName, setNewName] = uS("");
  const [busy, setBusy] = uS(false);
  if (!track) return null;

  const inWhich = new Set(
    playlists.filter(p => p.tracks.includes(track.id)).map(p => p.id)
  );

  const createAndAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const pl = await onCreate(name);
    if (pl) await onAdd(pl.pk, track.id);
    setBusy(false);
    setNewName("");
    onClose();
  };

  return (
    <div className="pl-modal-backdrop" onClick={onClose}>
      <div className="pl-modal" onClick={e => e.stopPropagation()}>
        <div className="pl-modal-head">
          <h3>В ПЛЕЙЛИСТ</h3>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="pl-modal-track">
          <div className="cv" style={{
            background: track.cover ? `url(${track.cover}) center/cover, ${track.color}` : track.color,
          }}></div>
          <div className="meta">
            <div className="t">{track.title}</div>
            <div className="a">{track.artist || "—"}</div>
          </div>
        </div>

        <div className="pl-modal-list">
          {playlists.length === 0 && (
            <div className="pl-modal-empty">плейлистов пока нет — создай ниже</div>
          )}
          {playlists.map(pl => {
            const added = inWhich.has(pl.id);
            return (
              <button key={pl.id}
                      className={"pl-modal-row " + (added ? "added" : "")}
                      disabled={added}
                      onClick={async () => { await onAdd(pl.pk, track.id); onClose(); }}>
                <span className="cov" style={{ background: pl.cover }}></span>
                <span className="nm">{pl.name}</span>
                <span className="st">{added ? "✓ уже там" : "+ добавить"}</span>
              </button>
            );
          })}
        </div>

        <div className="pl-modal-new">
          <input type="text" placeholder="новый плейлист…" value={newName}
                 onChange={e => setNewName(e.target.value)}
                 onKeyDown={e => { if (e.key === "Enter") createAndAdd(); }} />
          <button onClick={createAndAdd} disabled={busy || !newName.trim()}>создать +</button>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================
   SIDEBAR
   =========================================================== */
function Sidebar({ audio, playlists, activePlaylist, setActivePlaylist,
                  onCreatePlaylist, onDeletePlaylist, onRemoveFromPlaylist,
                  onRequestAdd, onOpenLibrary, view, onHide }) {
  const [creating, setCreating] = uS(false);
  const [newName, setNewName] = uS("");

  const isFav = activePlaylist === "favorites";
  const playlist = (!isFav && activePlaylist)
    ? playlists.find(p => p.id === activePlaylist)
    : null;

  let sourceIds;
  if (isFav) {
    sourceIds = audio.queue.filter(t => audio.favs.has(t.id)).map(t => t.id);
  } else if (playlist) {
    sourceIds = playlist.tracks;
  } else {
    sourceIds = audio.queue.map(t => t.id);
  }
  const tracks = sourceIds
    .map(id => audio.queue.find(t => t.id === id))
    .filter(Boolean);

  const favCount = audio.queue.filter(t => audio.favs.has(t.id)).length;

  const submitNew = async () => {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    await onCreatePlaylist(name);
    setNewName("");
    setCreating(false);
  };

  const listLabel = isFav ? "избранное" : (playlist ? `"${playlist.name}"` : "все треки");

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-label">
          <span>плейлисты</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button className="add" onClick={() => setCreating(c => !c)}>+ нов</button>
            <button className="sidebar-hide" onClick={onHide} title="Свернуть панель">◂</button>
          </div>
        </div>

        {creating && (
          <div className="pl-create">
            <input type="text" autoFocus placeholder="название плейлиста"
                   value={newName}
                   onChange={e => setNewName(e.target.value)}
                   onKeyDown={e => {
                     if (e.key === "Enter") submitNew();
                     if (e.key === "Escape") { setCreating(false); setNewName(""); }
                   }} />
            <button onClick={submitNew}>ок</button>
          </div>
        )}

        {/* Favorites virtual playlist */}
        <div className={"playlist-pick " + (isFav ? "active" : "")}
             onClick={() => setActivePlaylist("favorites")}>
          <div className="cover fav-cover">♥</div>
          <div className="meta">
            <div className="name">Избранное</div>
            <div className="count">{favCount} тр.</div>
          </div>
        </div>

        {/* All tracks */}
        <div className={"playlist-pick " + (!activePlaylist ? "active" : "")}
             onClick={() => setActivePlaylist(null)}>
          <div className="cover" style={{ background: "linear-gradient(135deg,#8a5a3a,#2c1a0d)" }}></div>
          <div className="meta">
            <div className="name">Все треки</div>
            <div className="count">{audio.queue.length} тр.</div>
          </div>
        </div>

        {playlists.map(pl => (
          <div key={pl.id}
               className={"playlist-pick " + (pl.id === activePlaylist ? "active" : "")}
               onClick={() => setActivePlaylist(pl.id)}>
            <div className="cover" style={{ background: pl.cover }}></div>
            <div className="meta">
              <div className="name">{pl.name}</div>
              <div className="count">{pl.tracks.length} тр.</div>
            </div>
            <button className="pl-del"
                    title="Удалить плейлист"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Удалить плейлист "${pl.name}"?`)) onDeletePlaylist(pl.id, pl.pk);
                    }}>✕</button>
          </div>
        ))}
      </div>

      <div className="sidebar-section flex">
        <div className="sidebar-label">
          <span>{listLabel}</span>
          <button className="add" onClick={onOpenLibrary}>фонотека</button>
        </div>
        <div className="tracklist">
          {tracks.length === 0 && (
            <div style={{ color: "var(--brown-4)", padding: 14, fontSize: 11 }}>
              {isFav ? "ещё нет избранного. жми ♥ на треках."
                     : (playlist ? "плейлист пуст. добавь треки из фонотеки."
                                 : "пусто. загрузи первый трек.")}
            </div>
          )}
          {tracks.map((t, i) => {
            const isCur = audio.current && audio.current.id === t.id;
            const isPlayingNow = isCur && audio.isPlaying;
            return (
              <div key={t.id}
                   className={"track-row " + (isCur ? "active " : "") + (isPlayingNow ? "playing-now" : "")}
                   onClick={() => audio.playTrack(t.id)}>
                <span className="idx playable">{String(i + 1).padStart(2, "0")}</span>
                <span className="idx-play">
                  {isPlayingNow
                    ? <span className="playing-bars"><span></span><span></span><span></span></span>
                    : <span>▶</span>}
                </span>
                <div className="cover" style={{
                  background: t.cover ? `url(${t.cover}) center/cover, ${t.color}` : t.color,
                }}></div>
                <div className="meta">
                  <div className="title">{t.title}</div>
                  <div className="artist">{t.artist || "—"}</div>
                </div>
                <div className="right">
                  {playlist ? (
                    <span className="row-act" title="Убрать из плейлиста"
                          onClick={(e) => { e.stopPropagation(); onRemoveFromPlaylist(playlist.pk, t.id); }}>
                      ✕
                    </span>
                  ) : (
                    <span className="row-act" title="В плейлист"
                          onClick={(e) => { e.stopPropagation(); onRequestAdd(t); }}>
                      +
                    </span>
                  )}
                  <span className="fav"
                        onClick={(e) => { e.stopPropagation(); audio.toggleFav(t.id, t.pk); }}
                        title="В избранное">
                    {audio.favs.has(t.id)
                      ? <span style={{ color: "var(--accent)" }}>♥</span>
                      : "♡"}
                  </span>
                  <span>{fmtTime(t.duration)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

Object.assign(window, {
  Player, TvScreen, EditPane, LibraryPane, Sidebar, AddToPlaylistModal,
  fmtTime, accentMap, GENRES,
});
