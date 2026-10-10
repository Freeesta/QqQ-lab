"use strict";
// Docking tabbed sidebar in Data view (LR and HR) - Block 1 of PROMPT_BARRA_LATERALE.md.
// Common tabs: File, Calculator, Neutral losses, Adducts, Lists.
// Dedicated Periodic Table button opens modal dialog #refdlg.
// In HR mode: 9 HR info bar tabs after a separator.
// Pinning (pinned: true -> occupies grid column, shrinks charts; pinned: false -> only rail visible, overlay over charts).
// Resizable width (min 220, max 560, double click resets to default: 260 for LR, 340 for HR).
// State persistence in localStorage (qqq.barra.lr and qqq.barra.hr).

const BARRA = (() => {
  const K_LR = "qqq.barra.lr";
  const K_HR = "qqq.barra.hr";

  let _curTab = "file";
  let _pinned = true;
  let _side = "left";
  let _w = 260;
  let _overlayOpen = false;
  let _mounted = false;

  const isHrMode = () => !!(window.HR && typeof BANCO !== "undefined" && BANCO.on());
  const storageKey = () => isHrMode() ? K_HR : K_LR;
  const defaultW = () => isHrMode() ? 340 : 260;

  function loadState() {
    let s = {};
    try {
      s = JSON.parse(localStorage.getItem(storageKey()) || "{}");
    } catch (_) {}
    _w = typeof s.w === "number" && s.w >= 220 && s.w <= 560 ? s.w : defaultW();
    _pinned = true;
    _side = s.side === "right" ? "right" : "left";
    _curTab = s.tab || (isHrMode() ? "hdr" : "file");
  }

  function saveState() {
    try {
      const data = {
        tab: _curTab,
        side: _side,
        pinned: _pinned,
        w: _w
      };
      localStorage.setItem(storageKey(), JSON.stringify(data));
    } catch (_) {}
  }

  function isDataView() {
    return typeof S !== "undefined" && S.view === "data" && S.sess && !S.adding && window.innerWidth >= 900;
  }

  // Set the grid column width and CSS variable
  function applyWidth() {
    const aside = document.querySelector("#dfiles");
    if (aside) {
      aside.style.setProperty("--sb-w", _w + "px");
    }
    document.documentElement.style.setProperty("--sb-w", _w + "px");
    const vdata = document.querySelector("#v-data");
    if (vdata) {
      vdata.style.setProperty("--sb-col-w", _w + "px");
    }
  }

  // Apply dock side (left / right)
  function applySide(triggerResize = false) {
    const vdata = document.querySelector("#v-data");
    if (vdata) {
      vdata.classList.toggle("sb-right", _side === "right");
    }
    const togBtn = document.querySelector("#sb-side-tog");
    if (togBtn && typeof I18N !== "undefined") {
      togBtn.title = I18N.t("side.dockTog.title");
      togBtn.setAttribute("aria-label", I18N.t("side.dockTog.aria"));
    }
    if (triggerResize && typeof fitWidth === "function" && typeof redrawAll === "function") {
      fitWidth();
      redrawAll();
    }
  }

  function toggleSide() {
    _side = _side === "left" ? "right" : "left";
    applySide(true);
    saveState();
  }

  function setSide(side) {
    if (side !== "left" && side !== "right") return;
    if (_side === side) return;
    _side = side;
    applySide(true);
    saveState();
  }

  // Update pinning visual & grid state
  function applyPin(triggerResize = false) {
    const vdata = document.querySelector("#v-data");
    if (vdata) {
      vdata.classList.remove("sb-unpinned");
      vdata.classList.remove("sb-overlay-open");
    }
    applyWidth();
    applySide(false);
    if (triggerResize && typeof fitWidth === "function" && typeof redrawAll === "function") {
      fitWidth();
      redrawAll();
    }
  }

  function getTabTitle(tabId) {
    if (typeof I18N !== "undefined") {
      if (["file", "calc", "losses", "adducts", "lists"].includes(tabId)) {
        return I18N.t(`sidebar.tab.${tabId}`);
      }
      if (["hdr", "lst", "fil", "cmp", "iso", "pks", "com", "idn", "tre"].includes(tabId)) {
        return I18N.t(`sidebar.sec.${tabId}`);
      }
    }
    return tabId;
  }


  // Switch tab
  function setTab(tabId, opt = {}) {
    if (tabId === "ptable") {
      // Periodic table is too wide for sidebar, open modal dialog #refdlg
      if (window.QQQRef && typeof QQQRef.open === "function") QQQRef.open("pt");
      return;
    }

    _curTab = tabId;
    if (!_pinned) {
      _overlayOpen = true;
    }

    // Update tab rail buttons
    document.querySelectorAll("#sidebar-tablist button[role='tab']").forEach(btn => {
      const isSel = btn.dataset.t === tabId;
      btn.classList.toggle("on", isSel);
      btn.setAttribute("aria-selected", isSel ? "true" : "false");
    });

    // Update title
    const ttlEl = document.querySelector("#sb-title");
    if (ttlEl) {
      ttlEl.textContent = getTabTitle(tabId);
    }

    // Toggle help button for tools
    const sbHelp = document.querySelector("#sb-help");
    if (sbHelp) {
      const helpKeys = { losses: "losses", adducts: "adducts", lists: "liste" };
      if (helpKeys[tabId]) {
        sbHelp.style.display = "";
        sbHelp.dataset.help = helpKeys[tabId];
      } else {
        sbHelp.style.display = "none";
        sbHelp.dataset.help = "";
      }
    }

    // Toggle actions (e.g. + button for file)
    const addf = document.querySelector("#addf");
    if (addf) {
      addf.style.display = tabId === "file" ? "" : "none";
    }

    // Show panel
    const panels = {
      file: document.querySelector("#sb-panel-file"),
      calc: document.querySelector("#sb-panel-calc"),
      losses: document.querySelector("#sb-panel-losses"),
      adducts: document.querySelector("#sb-panel-adducts"),
      lists: document.querySelector("#sb-panel-lists"),
      hr: document.querySelector("#hrinfo")
    };

    const isHrTab = ["hdr", "lst", "fil", "cmp", "iso", "pks", "com", "idn", "tre"].includes(tabId);

    // Hide all panels
    Object.values(panels).forEach(p => { if (p) p.hidden = true; });

    if (isHrTab) {
      if (panels.hr) {
        panels.hr.hidden = false;
        if (typeof BANCO !== "undefined") {
          if (typeof BANCO.setInfoTab === "function") BANCO.setInfoTab(tabId);
          if (typeof BANCO.renderInfo === "function") BANCO.renderInfo();
        }
      }
    } else if (panels[tabId]) {
      panels[tabId].hidden = false;
    }

    // Tab-specific mounts / updates
    if (tabId === "calc") {
      dockCalc(true);
      setTimeout(() => {
        const inp = document.querySelector("#calcin");
        if (inp) inp.focus();
        if (typeof calcRun === "function") calcRun();
      }, 30);
    } else if (tabId === "losses") {
      ensureLossesMounted(opt);
    } else if (tabId === "adducts") {
      ensureAdductsMounted();
    } else if (tabId === "lists") {
      ensureListsMounted(opt);
    }

    applyPin();
    saveState();
  }

  function ensureLossesMounted(opt = {}) {
    const pnl = document.querySelector("#sb-panel-losses");
    if (!pnl) return;
    if (!pnl.dataset.mounted) {
      if (window.QQQRef && typeof QQQRef.mountLosses === "function") {
        QQQRef.mountLosses(pnl, opt);
        pnl.dataset.mounted = "1";
      }
    } else if (opt.q != null && window.QQQRef && typeof QQQRef.setLossQuery === "function") {
      QQQRef.setLossQuery(opt.q);
    }
  }

  function ensureAdductsMounted() {
    const pnl = document.querySelector("#sb-panel-adducts");
    if (!pnl) return;
    if (!pnl.dataset.mounted) {
      if (window.QQQRef && typeof QQQRef.mountAdducts === "function") {
        QQQRef.mountAdducts(pnl);
        pnl.dataset.mounted = "1";
      }
    }
  }

  function ensureListsMounted(opt = {}) {
    const pnl = document.querySelector("#sb-panel-lists");
    if (!pnl) return;
    // mounted again at every opening (as the old window was): a list added meanwhile shows up
    if (window.LISTE && typeof LISTE.mount === "function") {
      LISTE.mount(pnl, opt);
      pnl.dataset.mounted = "1";
    }
  }

  function togglePin() {
    _pinned = !_pinned;
    if (_pinned) {
      _overlayOpen = false;
    } else {
      _overlayOpen = true;
    }
    applyPin(true);
    saveState();
  }

  function setPinned(p) {
    if (_pinned === p) return;
    _pinned = p;
    if (_pinned) _overlayOpen = false;
    applyPin(true);
    saveState();
  }

  function closeOverlay() {
    if (!_pinned && _overlayOpen) {
      _overlayOpen = false;
      const vdata = document.querySelector("#v-data");
      if (vdata) vdata.classList.remove("sb-overlay-open");
      document.querySelectorAll("#sidebar-tablist button[role='tab']").forEach(btn => {
        btn.classList.remove("on");
        btn.setAttribute("aria-selected", "false");
      });
    }
  }

  function setWidth(w) {
    _w = Math.max(220, Math.min(560, Math.round(w)));
    applyWidth();
    saveState();
  }

  // Dock or undock #calcdlg
  function dockCalc(inSidebar) {
    const dlg = document.querySelector("#calcdlg");
    const pnl = document.querySelector("#sb-panel-calc");
    if (!dlg || !pnl) return;
    if (inSidebar) {
      if (dlg.parentElement !== pnl) {
        pnl.appendChild(dlg);
      }
      dlg.classList.add("sb-docked");
      dlg.hidden = false;
    } else {
      if (dlg.parentElement !== document.body) {
        document.body.appendChild(dlg);
      }
      dlg.classList.remove("sb-docked");
      dlg.hidden = true;                      // outside the Dati view it is a window the student opens with its button
    }
  }

  // Drag resizer
  function bindResizer() {
    const handle = document.querySelector("#sidebar-resize-handle");
    if (!handle) return;

    let dragging = false;

    const onPointerMove = e => {
      if (!dragging) return;
      const aside = document.querySelector("#dfiles");
      if (!aside) return;
      const rect = aside.getBoundingClientRect();
      let newW;
      if (_side === "right") {
        newW = Math.max(220, Math.min(560, Math.round(rect.right - e.clientX)));
      } else {
        newW = Math.max(220, Math.min(560, Math.round(e.clientX - rect.left)));
      }
      _w = newW;
      applyWidth();
    };

    const onPointerUp = e => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove("sb-resizing");
      try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      saveState();
      if (_pinned && typeof fitWidth === "function" && typeof redrawAll === "function") {
        fitWidth();
        redrawAll();
      }
    };

    handle.onpointerdown = e => {
      if (e.button !== 0) return;
      dragging = true;
      document.body.classList.add("sb-resizing");
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      e.preventDefault();
    };

    handle.ondblclick = () => {
      _w = defaultW();
      applyWidth();
      saveState();
      if (_pinned && typeof fitWidth === "function" && typeof redrawAll === "function") {
        fitWidth();
        redrawAll();
      }
    };
  }

  // Setup click outside & Esc
  function bindGlobalEvents() {
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      // If calculator input is focused and has text, let explore.js handle clearing it
      const calcin = document.querySelector("#calcin");
      if (calcin && document.activeElement === calcin && calcin.value.trim().length > 0) {
        return;
      }
      if (!_pinned && _overlayOpen) {
        closeOverlay();
      }
    });

    document.addEventListener("pointerdown", e => {
      if (_pinned || !_overlayOpen) return;
      const aside = document.querySelector("#dfiles");
      const ctx = document.querySelector("#ctx");
      const dlg = e.target.closest && e.target.closest("dialog");
      if (aside && !aside.contains(e.target) && (!ctx || !ctx.contains(e.target)) && !dlg) {
        closeOverlay();
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth < 900 && _pinned) {
        setPinned(false);
      }
    });
  }

  // Synchronize HR mode
  function syncHR() {
    const isHr = isHrMode();
    const sep = document.querySelector("#sb-hr-sep");
    const hrTabs = document.querySelector("#hri-tabs");
    if (sep) sep.hidden = !isHr;
    if (hrTabs) hrTabs.hidden = !isHr;

    // Load HR-specific or LR-specific preferences
    loadState();
    applyPin();
  }

  // Initialize sidebar
  function init() {
    if (_mounted) return;
    _mounted = true;

    loadState();

    // Bind tablist buttons
    document.querySelectorAll("#sidebar-tablist button[role='tab'], #sidebar-tablist button.sb-act-btn").forEach(btn => {
      btn.onclick = () => {
        const t = btn.dataset.t;
        if (t === "ptable") {
          setTab("ptable");
          return;
        }
        if (!_pinned && _overlayOpen && _curTab === t) {
          closeOverlay();
        } else {
          setTab(t);
        }
      };
    });

    // Sidebar dock side toggle button (left / right)
    const sideTogBtn = document.querySelector("#sb-side-tog");
    if (sideTogBtn) {
      sideTogBtn.onclick = toggleSide;
    }

    // Drag header to drop on workspace / other side
    const sbHeader = document.querySelector("#sb-header");
    if (sbHeader) {
      sbHeader.setAttribute("draggable", "true");
      sbHeader.ondragstart = e => {
        e.dataTransfer.setData("text/plain", "sidebar");
        e.dataTransfer.effectAllowed = "move";
      };
    }
    const ws = document.querySelector("#v-workspace");
    if (ws) {
      ws.ondragover = e => {
        if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes("text/plain")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      };
      ws.ondrop = e => {
        const d = e.dataTransfer.getData("text/plain");
        if (d === "sidebar") {
          e.preventDefault();
          toggleSide();
        }
      };
    }

    // Fold/hide button
    const foldBtn = document.querySelector("#ffold");
    if (foldBtn) {
      foldBtn.onclick = () => {
        if (!_pinned && _overlayOpen) {
          closeOverlay();
        } else if (typeof setFold === "function") {
          setFold(true);
          if (typeof uiSave === "function") uiSave();
        }
      };
    }

    bindResizer();
    bindGlobalEvents();

    // Dock calculator into sidebar
    dockCalc(true);

    // Initial tab & side
    setTab(_curTab);
    applyPin();
    applySide(false);
  }

  return {
    init,
    setTab,
    togglePin,
    setPinned,
    toggleSide,
    setSide,
    setWidth,
    closeOverlay,
    dockCalc,
    syncHR,
    isDataView,
    get curTab() { return _curTab; },
    get pinned() { return _pinned; },
    get side() { return _side; },
    get width() { return _w; },
    get overlayOpen() { return _overlayOpen; }
  };
})();

if (typeof window !== "undefined") {
  window.BARRA = BARRA;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => BARRA.init());
  } else {
    BARRA.init();
  }
}
