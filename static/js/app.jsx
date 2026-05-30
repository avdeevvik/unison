/* ===================================================================
   app.jsx — Unison main app (Django bootstrap)
   =================================================================== */

const { useState: aS, useEffect: aE, useRef: aR } = React;

function Bootstrapper() {
  const [data, setData] = aS(null);
  const [error, setError] = aS(null);

  aE(() => {
    fetch(window.UNISON_URLS.bootstrap, { credentials: "same-origin" })
      .then(r => {
        if (r.status === 403 || r.status === 302) {
          window.location.href = "/accounts/login/";
          return null;
        }
        if (!r.ok) throw new Error("bootstrap " + r.status);
        return r.json();
      })
      .then(d => { if (d) setData(d); })
      .catch(e => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div style={{ color: "#fff", padding: 40, fontFamily: "Courier Prime" }}>
        <p>Ошибка загрузки: {error}</p>
        <p><a href={window.UNISON_URLS.home} style={{ color: "#d957a6" }}>на главную</a></p>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ color: "var(--cream-warm)", padding: 60, textAlign: "center",
                    fontFamily: "IBM Plex Mono", letterSpacing: "0.2em", fontSize: 12 }}>
        НАСТРАИВАЕМ АНТЕННУ...
      </div>
    );
  }

  return <App initial={data} />;
}

function App({ initial }) {
  const tweakDefaults = window.UNISON_DEFAULTS || {};
  const [tweaks, setTweak] = useTweaks(tweakDefaults);
  const audio = useAudio(initial.tracks, { initialFavs: initial.favorites });

  const [view, setView]               = aS("player");
  const [editing, setEditing]         = aS(null);
  const [playlists, setPlaylists]     = aS(initial.playlists);
  const [activePlaylist, setActivePL] = aS(playlists[0] ? playlists[0].id : null);
  const [filterGenre, setFilterGenre] = aS("all");
  const [query, setQuery]             = aS("");
  const [sidebarHidden, setSidebarHidden] = aS(false);
  const [userMenuOpen, setUserMenuOpen] = aS(false);
  const userChipRef = aR(null);
  const user = initial.user;

  aE(() => {
    if (!userMenuOpen) return;
    const onDoc = (e) => {
      if (userChipRef.current && !userChipRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [userMenuOpen]);

  aE(() => {
    const c = (accentMap[tweaks.accent] || accentMap.magenta).hex;
    document.documentElement.style.setProperty("--accent", c);
  }, [tweaks.accent]);

  aE(() => {
    const h = (e) => {
      if (e.target.matches("input,textarea,select")) return;
      if (e.code === "Space") { e.preventDefault(); audio.toggle(); }
      if (e.code === "ArrowRight") audio.next();
      if (e.code === "ArrowLeft")  audio.prev();
      if (e.key === "/") {
        const s = document.querySelector(".main-header .search input");
        if (s) { e.preventDefault(); s.focus(); }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [audio.toggle, audio.next, audio.prev]);

  const [addTarget, setAddTarget] = aS(null);  // track being added to a playlist

  const addNew = () => { setEditing(null); setView("edit"); };
  const openEdit = (t) => { setEditing(t); setView("edit"); };

  // create + return the new playlist object (or null)
  const createPlaylist = async (name) => {
    if (!name || !name.trim()) return null;
    const res = await fetch(window.UNISON_URLS.playlists, {
      method: "POST",
      headers: window.unisonCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name: name.trim() }),
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const d = await res.json();
    setPlaylists(p => [...p, d.playlist]);
    return d.playlist;
  };

  const deletePlaylist = async (plId, pk) => {
    const res = await fetch(`/api/playlists/${pk}/`, {
      method: "DELETE",
      headers: window.unisonCsrfHeaders(),
      credentials: "same-origin",
    });
    if (res.ok) {
      setPlaylists(p => p.filter(x => x.id !== plId));
      if (activePlaylist === plId) setActivePL(null);
    }
  };

  const addToPlaylist = async (plPk, trackId) => {
    const res = await fetch(`/api/playlists/${plPk}/tracks/`, {
      method: "POST",
      headers: window.unisonCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ track_id: trackId }),
      credentials: "same-origin",
    });
    if (res.ok) {
      const d = await res.json();
      if (d.playlist) setPlaylists(p => p.map(x => x.pk === plPk ? d.playlist : x));
    }
  };

  const removeFromPlaylist = async (plPk, trackId) => {
    const res = await fetch(`/api/playlists/${plPk}/tracks/`, {
      method: "DELETE",
      headers: window.unisonCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ track_id: trackId }),
      credentials: "same-origin",
    });
    if (res.ok) {
      const d = await res.json();
      if (d.playlist) setPlaylists(p => p.map(x => x.pk === plPk ? d.playlist : x));
    }
  };

  const doLogout = () => {
    const f = document.createElement("form");
    f.method = "POST";
    f.action = window.UNISON_URLS.logout;
    const t = document.createElement("input");
    t.type = "hidden"; t.name = "csrfmiddlewaretoken"; t.value = window.UNISON_CSRF;
    f.appendChild(t);
    document.body.appendChild(f);
    f.submit();
  };

  const initial1 = (user.name || "U").trim()[0].toUpperCase();

  return (
    <div className="app" data-screen-label="02 Эфир">
      <header className="main-header">
        <div className="wordmark">UNISON<span className="dot"></span></div>
        <nav className="main-nav">
          <button className={"nav-item " + (view === "player" ? "active" : "")}
                  onClick={() => setView("player")}>
            <span className="dot"></span>эфир
          </button>
          <button className={"nav-item " + (view === "library" ? "active" : "")}
                  onClick={() => setView("library")}>
            <span className="dot"></span>фонотека
          </button>
          <button className={"nav-item " + (view === "edit" ? "active" : "")}
                  onClick={() => { setEditing(null); setView("edit"); }}>
            <span className="dot"></span>+ трек
          </button>
        </nav>
        <div className="search">
          <span style={{ color: "var(--brown-4)" }}>⌕</span>
          <input
            placeholder="поиск по фонотеке"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              if (e.target.value && view === "player") setView("library");
            }}
          />
          <span className="kbd">/</span>
        </div>
        <div className={"user-chip " + (userMenuOpen ? "open" : "")}
             ref={userChipRef}
             onClick={() => setUserMenuOpen(o => !o)}>
          <div className="avatar">{initial1}</div>
          <div className="name">{user.name}</div>
          <span className="chip-caret">▾</span>
          {userMenuOpen && (
            <div className="user-menu" onClick={e => e.stopPropagation()}>
              <a className="user-menu-item" href={window.UNISON_URLS.home}>
                <span className="ic">↩</span>на главную
              </a>
              <button className="user-menu-item danger" onClick={doLogout}>
                <span className="ic">⏻</span>выйти
              </button>
            </div>
          )}
        </div>
      </header>

      <div className={"main-stage " + (sidebarHidden ? "sidebar-hidden" : "")}>
        <Sidebar
          audio={audio}
          playlists={playlists}
          activePlaylist={activePlaylist}
          setActivePlaylist={setActivePL}
          onCreatePlaylist={createPlaylist}
          onDeletePlaylist={deletePlaylist}
          onRemoveFromPlaylist={removeFromPlaylist}
          onRequestAdd={(t) => setAddTarget(t)}
          onOpenLibrary={() => setView("library")}
          onHide={() => setSidebarHidden(true)}
          view={view}
        />

        <button className="sidebar-show" onClick={() => setSidebarHidden(false)}>
          <span className="chev">▸</span>плейлисты
        </button>

        <div className="tv-stage">
          <div className="tv-frame">
            <img className="tv-img" src="/static/assets/tv-carpet.png" alt="" />
            <div className="main-grain"
                 style={{ display: tweaks.grainEffect ? "block" : "none" }}></div>

            <TvScreen tweaks={tweaks}>
            {view === "player" && <Player audio={audio} tweaks={tweaks} onAddTrack={addNew} />}
            {view === "edit"   && <EditPane audio={audio} editing={editing}
                                            onClose={() => setView("player")} />}
            {view === "library" && (
              <LibraryPane
                audio={audio}
                onPick={(id) => { audio.playTrack(id); setView("player"); }}
                onAdd={addNew}
                onEdit={openEdit}
                onRequestAdd={(t) => setAddTarget(t)}
                filterGenre={filterGenre}
                setFilterGenre={setFilterGenre}
                query={query}
                setQuery={setQuery}
              />
            )}
          </TvScreen>
          </div>

          <div className="tv-caption">
            {view === "player"  && "канал 7 · сейчас в эфире"}
            {view === "edit"    && "канал 6 · загрузка"}
            {view === "library" && "канал 5 · фонотека"}
          </div>

          <div className="kbd-hints">
            <span><span className="k">Space</span>играть/пауза</span>
            <span><span className="k">←/→</span>трек</span>
            <span><span className="k">/</span>поиск</span>
          </div>
        </div>
      </div>

      <TweaksPanel title="Tweaks · Унисон">
        <TweakSection label="Цвет эфира">
          <TweakColor
            label="Акцент"
            value={(accentMap[tweaks.accent] || accentMap.magenta).hex}
            options={["#d957a6", "#f0a541", "#7bd95a", "#5ad9d9"]}
            onChange={(hex) => {
              const key = Object.keys(accentMap).find(k => accentMap[k].hex === hex) || "magenta";
              setTweak("accent", key);
            }}
          />
        </TweakSection>

        <TweakSection label="Визуализатор">
          <TweakRadio
            label="Стиль"
            value={tweaks.visualizerStyle}
            options={["bars", "wave", "dots"]}
            onChange={v => setTweak("visualizerStyle", v)}
          />
        </TweakSection>

        <TweakSection label="Экран">
          <TweakToggle label="CRT-эффект" value={tweaks.crtEffect}
                       onChange={v => setTweak("crtEffect", v)} />
          <TweakToggle label="Плёночное зерно" value={tweaks.grainEffect}
                       onChange={v => setTweak("grainEffect", v)} />
        </TweakSection>

        <TweakSection label="Управление">
          <TweakButton label="выйти из эфира →" onClick={doLogout} />
          <TweakButton label="сбросить эквалайзер"
                       onClick={() => audio.resetEq()} secondary />
        </TweakSection>
      </TweaksPanel>

      <AddToPlaylistModal
        track={addTarget}
        playlists={playlists}
        onAdd={addToPlaylist}
        onCreate={createPlaylist}
        onClose={() => setAddTarget(null)}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Bootstrapper />);
