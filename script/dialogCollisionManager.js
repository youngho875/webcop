/**
 * Keeps floating dialogs out of docking-bar areas.
 * Loaded once after dockingbar.js; dynamically created dialogs are observed.
 */
window.DialogCollisionManager = (function () {
  "use strict";

  const GAP = 10;
  let scheduled = false;
  let correcting = false;
  const initializedDialogs = new WeakSet();

  const protectedSelector = [
    "#menu",
    ".dock-bar",
    "#dockPanel",
    ".layer-dialog-container.layer-docked"
  ].join(",");

  const dialogSelector = [
    "dialog",
    "[role='dialog']",
    "[class*='dialog' i]",
    "[class*='modal' i]",
    "[class*='popup' i]",
    "[id*='dialog' i]",
    "[id*='modal' i]",
    "[id*='popup' i]",
    "[id$='InfoBox' i]",
    "[id$='Box' i]",
    "[id$='ControlPanel' i]",
    "[id$='Panel' i]",
    "[id$='-panel' i]",
    "#airspace-editor"
  ].join(",");

  const excludedSelector = [
    ".dropdown-content",
    ".layer-context-menu",
    "[class*='context-menu' i]",
    ".td-map-editor",
    ".drawing-multi-selection-box"
  ].join(",");

  function visible(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected || element.hidden) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 20 && rect.height > 20;
  }

  function protectedElements() {
    return Array.from(document.querySelectorAll(protectedSelector)).filter(visible);
  }

  function isProtectedOrChild(element) {
    return Boolean(element.closest(protectedSelector));
  }

  function dialogs() {
    return Array.from(document.querySelectorAll(dialogSelector)).filter(function (element) {
      if (!visible(element) || isProtectedOrChild(element)) return false;
      if (element.matches(excludedSelector) || element.id === "infoPane" || element.style.pointerEvents === "none") return false;
      const position = getComputedStyle(element).position;
      if (position !== "fixed" && position !== "absolute") return false;

      // Select only the outer floating window. Headers, bodies and nested panels
      // often contain "dialog" in their class name and must never be moved alone.
      const floatingAncestor = Array.from(element.parentElement?.closest(dialogSelector) ? [element.parentElement.closest(dialogSelector)] : [])
        .find(function (ancestor) {
          if (!visible(ancestor) || isProtectedOrChild(ancestor)) return false;
          const ancestorPosition = getComputedStyle(ancestor).position;
          return ancestorPosition === "fixed" || ancestorPosition === "absolute";
        });
      if (floatingAncestor) return false;
      return true;
    });
  }

  function overlaps(a, b) {
    return a.left < b.right + GAP && a.right + GAP > b.left &&
      a.top < b.bottom + GAP && a.bottom + GAP > b.top;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
  }

  function candidatePositions(dialogRect, dockRect) {
    return [
      { left: dockRect.right + GAP, top: dialogRect.top },
      { left: dockRect.left - dialogRect.width - GAP, top: dialogRect.top },
      { left: dialogRect.left, top: dockRect.bottom + GAP },
      { left: dialogRect.left, top: dockRect.top - dialogRect.height - GAP }
    ].map(function (position) {
      const left = clamp(position.left, GAP, window.innerWidth - dialogRect.width - GAP);
      const top = clamp(position.top, GAP, window.innerHeight - dialogRect.height - GAP);
      const distance = Math.abs(left - dialogRect.left) + Math.abs(top - dialogRect.top);
      return { left: left, top: top, distance: distance };
    }).sort(function (a, b) { return a.distance - b.distance; });
  }

  function rectAt(position, sourceRect) {
    return {
      left: position.left,
      top: position.top,
      right: position.left + sourceRect.width,
      bottom: position.top + sourceRect.height
    };
  }

  function usableBounds(docks) {
    const left = GAP;
    const right = window.innerWidth - GAP;
    let top = GAP;
    const bottom = window.innerHeight - GAP;

    docks.forEach(function (dock) {
      const rect = dock.getBoundingClientRect();
      if (dock.id === "menu") {
        top = Math.max(top, rect.bottom + GAP);
      }
    });

    return {
      left: left,
      right: Math.max(left + 80, right),
      top: top,
      bottom: Math.max(top + 80, bottom)
    };
  }

  function setStyle(element, property, value) {
    if (element.style[property] !== value) element.style[property] = value;
  }

  function keepAboveDockingBars(dialog, docks) {
    const dockZIndex = docks.reduce(function (highest, dock) {
      if (dock.id === "menu") return highest;
      const value = Number.parseInt(getComputedStyle(dock).zIndex, 10);
      return Number.isFinite(value) ? Math.max(highest, value) : highest;
    }, 1000);
    const current = Number.parseInt(getComputedStyle(dialog).zIndex, 10);
    const next = Math.max(Number.isFinite(current) ? current : 0, dockZIndex + 10, 2000);
    dialog.style.setProperty("z-index", String(next), "important");
  }

  function placeNewDialog(dialog, docks, placedDialogs) {
    if (initializedDialogs.has(dialog)) return;
    initializedDialogs.add(dialog);

    const bounds = usableBounds(docks);
    const availableWidth = Math.max(80, bounds.right - bounds.left);
    const availableHeight = Math.max(80, bounds.bottom - bounds.top);
    let rect = dialog.getBoundingClientRect();

    setStyle(dialog, "maxWidth", `${availableWidth}px`);
    setStyle(dialog, "maxHeight", `${availableHeight}px`);
    if (rect.width > availableWidth) {
      setStyle(dialog, "minWidth", "0px");
      setStyle(dialog, "width", `${availableWidth}px`);
    }
    if (rect.height > availableHeight) {
      setStyle(dialog, "minHeight", "0px");
      setStyle(dialog, "height", `${availableHeight}px`);
    }

    rect = dialog.getBoundingClientRect();
    const baseLeft = bounds.left + Math.max(0, (availableWidth - rect.width) / 2);
    const baseTop = bounds.top + Math.max(0, (availableHeight - rect.height) / 2);
    const offsets = [0, 28, -28, 56, -56, 84, -84];
    let choice = { left: baseLeft, top: baseTop };

    outer: for (const yOffset of offsets) {
      for (const xOffset of offsets) {
        const candidate = {
          left: clamp(baseLeft + xOffset, bounds.left, bounds.right - rect.width),
          top: clamp(baseTop + yOffset, bounds.top, bounds.bottom - rect.height)
        };
        const candidateRect = rectAt(candidate, rect);
        const blocked = docks.concat(placedDialogs).some(function (element) {
          return overlaps(candidateRect, element.getBoundingClientRect());
        });
        if (!blocked) {
          choice = candidate;
          break outer;
        }
      }
    }

    setStyle(dialog, "position", "fixed");
    setStyle(dialog, "transform", "none");
    setStyle(dialog, "right", "auto");
    setStyle(dialog, "bottom", "auto");
    setStyle(dialog, "left", `${choice.left}px`);
    setStyle(dialog, "top", `${choice.top}px`);
  }

  function moveOutside(dialog, docks) {
    let dialogRect = dialog.getBoundingClientRect();
    let changed = false;

    for (let pass = 0; pass < docks.length + 1; pass += 1) {
      const collision = docks.find(function (dock) { return overlaps(dialogRect, dock.getBoundingClientRect()); });
      if (!collision) break;

      const dockRects = docks.map(function (dock) { return dock.getBoundingClientRect(); });
      const choice = candidatePositions(dialogRect, collision.getBoundingClientRect()).find(function (candidate) {
        const candidateRect = rectAt(candidate, dialogRect);
        return !dockRects.some(function (dockRect) { return overlaps(candidateRect, dockRect); });
      }) || candidatePositions(dialogRect, collision.getBoundingClientRect())[0];

      dialog.style.position = "fixed";
      dialog.style.left = choice.left + "px";
      dialog.style.top = choice.top + "px";
      dialog.style.right = "auto";
      dialog.style.bottom = "auto";
      dialogRect = rectAt(choice, dialogRect);
      changed = true;
    }
    return changed;
  }

  function correctAll() {
    if (correcting) return;
    correcting = true;
    const docks = protectedElements();
    const floatingDialogs = dialogs();
    syncResizeObservation(docks.concat(floatingDialogs));
    const menuObstacles = docks.filter(function (dock) { return dock.id === "menu"; });
    const placedDialogs = [];
    floatingDialogs.forEach(function (dialog) {
      // Floating dialogs may use the full viewport width. A left/right docking
      // bar can be covered, but it must never cover the active dialog.
      placeNewDialog(dialog, menuObstacles, placedDialogs);
      moveOutside(dialog, menuObstacles.concat(placedDialogs));
      keepAboveDockingBars(dialog, docks);
      placedDialogs.push(dialog);
    });
    correcting = false;
  }

  function schedule() {
    if (scheduled || correcting) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      correctAll();
    });
  }

  function scheduleSettledLayout() {
    schedule();
    // Several legacy dialogs calculate their final size after opening. Check
    // again after those layout/transition steps without tying their initial
    // coordinates to a docking bar.
    window.setTimeout(schedule, 80);
    window.setTimeout(schedule, 220);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class", "hidden", "open"]
  });

  const observedElements = new Set();
  const resizeObserver = new ResizeObserver(schedule);
  function syncResizeObservation(elements) {
    elements.forEach(function (element) {
      if (observedElements.has(element)) return;
      observedElements.add(element);
      resizeObserver.observe(element);
    });
    observedElements.forEach(function (element) {
      if (element.isConnected) return;
      resizeObserver.unobserve(element);
      observedElements.delete(element);
    });
  }

  window.addEventListener("resize", scheduleSettledLayout);
  window.addEventListener("mouseup", scheduleSettledLayout, true);
  window.addEventListener("pointerup", scheduleSettledLayout, true);
  window.addEventListener("touchend", scheduleSettledLayout, true);
  document.addEventListener("DOMContentLoaded", scheduleSettledLayout);
  document.addEventListener("dialog-opened", scheduleSettledLayout);
  document.addEventListener("click", scheduleSettledLayout, true);

  return {
    correctAll: correctAll,
    schedule: schedule,
    register: function (element) {
      if (element instanceof HTMLElement) {
        element.setAttribute("role", element.getAttribute("role") || "dialog");
        schedule();
      }
    }
  };
}());
